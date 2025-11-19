//! Grok API Client for SOC 2 compliance fix generation
//!
//! This module provides a production-ready client for the xAI Grok API,
//! with support for streaming and structured error handling.
//!
//! API Specifications:
//! - Model: grok-code-fast-1 (fast coding model)
//! - Endpoint: POST https://api.x.ai/v1/chat/completions
//! - Format: OpenAI-compatible
//! - Streaming: Supported via stream: true

use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;
use crate::models::{Control, Violation, Severity, DetectionMethod};

/// Request body structure for Grok API
/// Matches OpenAI-compatible API specification
#[derive(Debug, Clone, Serialize)]
pub struct ClaudeRequest {
    /// Model identifier (grok-code-fast-1 for fast coding model)
    pub model: String,
    /// Maximum tokens in response
    pub max_tokens: i32,
    /// Conversation messages
    pub messages: Vec<Message>,
    /// Temperature for response randomness (0.0-2.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    /// Enable streaming responses (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
}

/// Message in conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// "user" or "assistant"
    pub role: String,
    /// Message content
    pub content: String,
}

/// System prompt block with optional caching
#[derive(Debug, Clone, Serialize)]
pub struct SystemBlock {
    /// Always "text"
    #[serde(rename = "type")]
    pub block_type: String,
    /// Block content
    pub text: String,
    /// Cache control settings (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_control: Option<CacheControl>,
}

/// Cache control configuration for system blocks
/// Only "ephemeral" type is supported by Anthropic
#[derive(Debug, Clone, Serialize)]
pub struct CacheControl {
    /// Cache type: "ephemeral" (only supported type)
    #[serde(rename = "type")]
    pub control_type: String,
}

/// Response from Grok API (OpenAI-compatible format)
#[derive(Debug, Clone, Deserialize)]
pub struct ClaudeResponse {
    /// Response ID
    pub id: String,
    /// Object type (always "chat.completion")
    pub object: String,
    /// Creation timestamp
    pub created: i64,
    /// Model used
    pub model: String,
    /// Response choices
    pub choices: Vec<Choice>,
    /// Token usage metrics
    pub usage: UsageMetrics,
}

/// Choice in response
#[derive(Debug, Clone, Deserialize)]
pub struct Choice {
    /// Choice index
    pub index: i32,
    /// Message content
    pub message: Message,
    /// Finish reason (e.g., "stop")
    pub finish_reason: String,
}

/// Content block in response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentBlock {
    /// Block type (usually "text")
    #[serde(rename = "type")]
    pub block_type: String,
    /// Content text
    pub text: String,
}

/// Token usage and cache metrics
#[derive(Debug, Clone, Deserialize)]
pub struct UsageMetrics {
    /// Input tokens used
    pub input_tokens: i32,
    /// Output tokens generated
    pub output_tokens: i32,
    /// Tokens created in cache (prompt caching)
    #[serde(default)]
    pub cache_creation_input_tokens: i32,
    /// Tokens read from cache (prompt caching)
    #[serde(default)]
    pub cache_read_input_tokens: i32,
}

impl UsageMetrics {
    /// Calculate cost in USD using Claude Haiku 4.5 November 2025 pricing
    ///
    /// Pricing (per million tokens):
    /// - Input: $1.00
    /// - Output: $5.00
    /// - Cache write: $1.25
    /// - Cache read: $0.10
    pub fn calculate_cost(&self) -> f64 {
        let input_cost = (self.input_tokens as f64) * 1.00 / 1_000_000.0;
        let output_cost = (self.output_tokens as f64) * 5.00 / 1_000_000.0;
        let cache_write_cost = (self.cache_creation_input_tokens as f64) * 1.25 / 1_000_000.0;
        let cache_read_cost = (self.cache_read_input_tokens as f64) * 0.10 / 1_000_000.0;

        input_cost + output_cost + cache_write_cost + cache_read_cost
    }
}

/// Result of LLM analysis for violations
#[derive(Debug, Clone)]
pub struct AnalysisResult {
    /// Detected violations
    pub violations: Vec<Violation>,
    /// Token usage metrics
    pub usage: UsageMetrics,
}

/// Violation detection from LLM (JSON deserialization)
#[derive(Debug, Clone, Deserialize)]
struct ViolationDetection {
    control_id: String,
    severity: String,
    description: String,
    line_number: i64,
    code_snippet: String,
    confidence_score: i64,
    reasoning: String,
}

/// Claude API Client
/// Handles all communication with Anthropic's Claude Messages API
pub struct ClaudeClient {
    /// API key for authentication
    api_key: String,
    /// HTTP client (reused across requests)
    http_client: Client,
    /// API base URL
    api_base: String,
}

impl ClaudeClient {
    /// Create new Claude client from ANTHROPIC_API_KEY environment variable
    ///
    /// # Errors
    /// Returns error if ANTHROPIC_API_KEY is not set
    pub fn new() -> Result<Self> {
        let api_key = env::var("ANTHROPIC_API_KEY")
            .context("ANTHROPIC_API_KEY environment variable not set")?;

        Self::validate_api_key(&api_key)?;

        Ok(Self {
            api_key,
            http_client: Client::new(),
            api_base: "https://api.x.ai/v1".to_string(),
        })
    }

    /// Create client with custom API key (for testing)
    pub fn with_key(api_key: String) -> Result<Self> {
        Self::validate_api_key(&api_key)?;

        Ok(Self {
            api_key,
            http_client: Client::new(),
            api_base: "https://api.x.ai/v1".to_string(),
        })
    }

    /// Create client with custom API base URL (for testing/staging)
    pub fn with_url(api_key: String, api_base: String) -> Result<Self> {
        Self::validate_api_key(&api_key)?;

        Ok(Self {
            api_key,
            http_client: Client::new(),
            api_base,
        })
    }

    /// Validate API key format
    fn validate_api_key(key: &str) -> Result<()> {
        if key.is_empty() {
            return Err(anyhow!("API key cannot be empty"));
        }
        if key.len() < 20 {
            return Err(anyhow!("API key appears invalid (too short)"));
        }
        Ok(())
    }

    /// Generate a fix for a SOC 2 compliance violation
    ///
    /// # Arguments
    /// * `violation_control_id` - Control ID (e.g., "CC6.1", "CC7.2")
    /// * `violation_description` - Description of the violation
    /// * `original_code` - Code snippet with the violation
    /// * `framework` - Framework type (e.g., "django", "express")
    /// * `function_name` - Function name where violation was found (from tree-sitter)
    /// * `class_name` - Class name where violation was found (from tree-sitter)
    ///
    /// # Returns
    /// Fixed code as a string
    pub async fn generate_fix(
        &self,
        violation_control_id: &str,
        violation_description: &str,
        original_code: &str,
        framework: &str,
        function_name: Option<&str>,
        class_name: Option<&str>,
    ) -> Result<String> {
        let prompt = self.build_fix_prompt(
            violation_control_id,
            violation_description,
            original_code,
            framework,
            function_name,
            class_name,
        );

        let response = self.call_api(&prompt, None).await?;

        Ok(response
            .choices
            .first()
            .map(|choice| choice.message.content.clone())
            .unwrap_or_default())
    }

    /// Generate fix with system context
    ///
    /// Adds framework-specific best practices to system context for better fixes
    pub async fn generate_fix_with_context(
        &self,
        violation_control_id: &str,
        violation_description: &str,
        original_code: &str,
        framework: &str,
        function_name: Option<&str>,
        class_name: Option<&str>,
        system_context: &str,
    ) -> Result<String> {
        let prompt = self.build_fix_prompt(
            violation_control_id,
            violation_description,
            original_code,
            framework,
            function_name,
            class_name,
        );

        let response = self.call_api(&prompt, Some(system_context.to_string())).await?;

        Ok(response
            .choices
            .first()
            .map(|choice| choice.message.content.clone())
            .unwrap_or_default())
    }

    /// Build fix prompt based on SOC 2 control
    ///
    /// Constructs specialized prompts for different control types to ensure
    /// consistent, high-quality fixes. Includes tree-sitter context (function_name, class_name)
    /// when available for better understanding of code structure.
    fn build_fix_prompt(
        &self,
        control_id: &str,
        description: &str,
        code: &str,
        framework: &str,
        function_name: Option<&str>,
        class_name: Option<&str>,
    ) -> String {
        // Build context section if tree-sitter data is available
        let mut context_section = String::new();
        if function_name.is_some() || class_name.is_some() {
            context_section.push_str("Context:\n");
            if let Some(func) = function_name {
                context_section.push_str(&format!("- Function: {}\n", func));
            }
            if let Some(cls) = class_name {
                context_section.push_str(&format!("- Class: {}\n", cls));
            }
            context_section.push_str("\n");
        }

        match control_id {
            "CC6.1" => {
                format!(
                    "Fix the following access control violation in {} code:\n\n\
                     Violation: {}\n\n\
                     {}\
                     Original code:\n```\n{}\n```\n\n\
                     Provide the fixed code only, no explanation.",
                    framework, description, context_section, code
                )
            }
            "CC6.7" => {
                format!(
                    "Fix the following secrets/cryptography violation in {} code:\n\n\
                     Violation: {}\n\n\
                     {}\
                     Original code:\n```\n{}\n```\n\n\
                     Move hardcoded secrets to environment variables. \
                     Provide the fixed code only, no explanation.",
                    framework, description, context_section, code
                )
            }
            "CC7.2" => {
                format!(
                    "Fix the following logging violation in {} code:\n\n\
                     Violation: {}\n\n\
                     {}\
                     Original code:\n```\n{}\n```\n\n\
                     Add proper audit logging without logging sensitive data. \
                     Provide the fixed code only, no explanation.",
                    framework, description, context_section, code
                )
            }
            "A1.2" => {
                format!(
                    "Fix the following resilience violation in {} code:\n\n\
                     Violation: {}\n\n\
                     {}\
                     Original code:\n```\n{}\n```\n\n\
                     Add error handling, timeouts, and retry logic. \
                     Provide the fixed code only, no explanation.",
                    framework, description, context_section, code
                )
            }
            _ => {
                format!(
                    "Fix the following compliance violation:\n\n\
                     Violation: {}\n\n\
                     {}\
                     Original code:\n```\n{}\n```",
                    description, context_section, code
                )
            }
        }
    }

    /// Call Claude Messages API
    ///
    /// Sends request to API with proper headers, error handling, and response parsing
    async fn call_api(&self, prompt: &str, system: Option<String>) -> Result<ClaudeResponse> {
        // Build system prompt for OpenAI-compatible format (Grok)
        let mut system_content = "You are a security-focused code fixer for SOC 2 compliance. \
                   Your task is to fix compliance violations in code without breaking functionality. \
                   Always follow the framework's best practices.".to_string();

        // Add system context if provided
        if let Some(ctx) = system {
            system_content.push_str("\n\n");
            system_content.push_str(&ctx);
        }

        // Build request with OpenAI-compatible format
        let messages = vec![
            Message {
                role: "system".to_string(),
                content: system_content,
            },
            Message {
                role: "user".to_string(),
                content: prompt.to_string(),
            },
        ];

        let request = ClaudeRequest {
            model: "grok-code-fast-1".to_string(),
            max_tokens: 4096,
            messages,
            temperature: Some(0.0),
            stream: Some(false),
        };

        // Send request
        let response = self
            .http_client
            .post(format!("{}/chat/completions", self.api_base))
            .header("Authorization", format!("Bearer {}", &self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .context("Failed to send request to Claude API")?;

        let status = response.status();
        let response_text = response
            .text()
            .await
            .context("Failed to read response body")?;

        if !status.is_success() {
            return Err(anyhow!(
                "Claude API error ({}): {}",
                status,
                response_text
            ));
        }

        let claude_response: ClaudeResponse = serde_json::from_str(&response_text)
            .context("Failed to parse Grok API response")?;

        Ok(claude_response)
    }

    // ============================================================
    // LLM-BASED VIOLATION ANALYSIS (Hybrid Scanning)
    // ============================================================

    /// Analyze code for SOC 2 violations using Claude Haiku
    ///
    /// # Arguments
    /// * `scan_id` - ID of the scan this analysis belongs to
    /// * `file_path` - Path to file being analyzed
    /// * `code` - Full file contents
    /// * `regex_findings` - Violations already found by regex (optional)
    ///
    /// # Returns
    /// AnalysisResult with detected violations and token usage
    ///
    /// # Errors
    /// - API rate limits (429)
    /// - Server errors (500, 529)
    /// - Network failures (with retry)
    pub async fn analyze_for_violations(
        &self,
        scan_id: i64,
        file_path: &str,
        code: &str,
        regex_findings: Vec<Violation>,
    ) -> Result<AnalysisResult> {
        let system_prompt = Self::build_soc2_system_prompt();
        let user_prompt = Self::build_analysis_prompt(file_path, code, &regex_findings);

        // Call API with retry logic for transient errors
        let response = self.call_api_with_retry(&user_prompt, Some(system_prompt), 3).await?;

        // Parse violations from response (Grok uses OpenAI format with choices)
        let response_text = response.choices.first()
            .map(|choice| choice.message.content.as_str())
            .unwrap_or("");

        let violations = Self::parse_violations_response(
            response_text,
            scan_id,
            file_path,
        )?;

        Ok(AnalysisResult {
            violations,
            usage: response.usage,
        })
    }

    /// Build SOC 2 controls system prompt with caching
    ///
    /// Creates a comprehensive system prompt with all SOC 2 control definitions.
    /// This prompt is cacheable (>2048 tokens) and will be reused across files.
    fn build_soc2_system_prompt() -> String {
        let controls = Control::all_controls();

        let mut prompt = String::from(
            "You are a SOC 2 compliance expert analyzing application code for security violations.\n\n\
            Your task is to identify violations of the following SOC 2 controls:\n\n"
        );

        for control in controls {
            prompt.push_str(&format!(
                "## {} - {}\n\
                **Description**: {}\n\
                **Requirement**: {}\n\
                **Category**: {}\n\n",
                control.id, control.name, control.description, control.requirement, control.category
            ));
        }

        prompt.push_str(
            "\n**Analysis Guidelines**:\n\
            1. Focus on semantic violations that regex patterns might miss\n\
            2. Consider context and intent, not just keywords\n\
            3. Assign confidence scores (0-100) based on certainty\n\
            4. Provide clear, actionable reasoning\n\
            5. Avoid duplicate findings with existing regex detections\n\n\
            **Response Format**:\n\
            Respond with a JSON array of violations only, no explanation:\n\
            ```json\n\
            [\n\
              {\n\
                \"control_id\": \"CC6.1\",\n\
                \"severity\": \"high\",\n\
                \"description\": \"Brief description\",\n\
                \"line_number\": 42,\n\
                \"code_snippet\": \"relevant code\",\n\
                \"confidence_score\": 85,\n\
                \"reasoning\": \"Why this is a violation\"\n\
              }\n\
            ]\n\
            ```\n\
            If no violations found, respond with: `[]`"
        );

        prompt
    }

    /// Build analysis prompt with code and existing regex findings
    ///
    /// # Arguments
    /// * `file_path` - Path to file being analyzed
    /// * `code` - Full file contents
    /// * `regex_findings` - Violations already detected by regex patterns
    fn build_analysis_prompt(file_path: &str, code: &str, regex_findings: &[Violation]) -> String {
        let mut prompt = format!(
            "Analyze this file for SOC 2 compliance violations:\n\n\
            **File**: {}\n\n\
            **Code**:\n```\n{}\n```\n\n",
            file_path, code
        );

        if !regex_findings.is_empty() {
            prompt.push_str("**Regex Pattern Detections** (already found):\n");
            for finding in regex_findings {
                prompt.push_str(&format!(
                    "- Line {}: {} ({})\n",
                    finding.line_number, finding.description, finding.control_id
                ));
            }
            prompt.push_str("\nFocus on finding violations that regex patterns missed.\n\n");
        }

        prompt.push_str(
            "Respond with JSON array of violations (or [] if none found). \
            Consider semantic issues, not just keyword matching."
        );

        prompt
    }

    /// Parse Claude's JSON response into Violation objects
    ///
    /// # Arguments
    /// * `response_text` - Claude's response (should be JSON array)
    /// * `scan_id` - Scan ID to associate violations with
    /// * `file_path` - File path for violations
    ///
    /// # Returns
    /// Vec of Violation objects
    ///
    /// # Errors
    /// Returns error if JSON parsing fails or format is invalid
    fn parse_violations_response(
        response_text: &str,
        scan_id: i64,
        file_path: &str,
    ) -> Result<Vec<Violation>> {
        // Strip markdown code blocks if present
        let json_text = response_text
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        // Handle empty response
        if json_text.is_empty() || json_text == "[]" {
            return Ok(Vec::new());
        }

        // Parse JSON array of detections
        let detections: Vec<ViolationDetection> = serde_json::from_str(json_text)
            .context("Failed to parse LLM response as JSON")?;

        // Convert to Violation objects
        let violations: Vec<Violation> = detections
            .into_iter()
            .map(|det| {
                let severity = Severity::from_str(&det.severity)
                    .unwrap_or(Severity::Medium);

                Violation {
                    id: 0,
                    scan_id,
                    control_id: det.control_id,
                    severity: severity.as_str().to_string(),
                    description: det.description,
                    file_path: file_path.to_string(),
                    line_number: det.line_number,
                    code_snippet: det.code_snippet,
                    status: "open".to_string(),
                    detected_at: chrono::Utc::now().to_rfc3339(),
                    detection_method: DetectionMethod::Llm.as_str().to_string(),
                    confidence_score: Some(det.confidence_score),
                    llm_reasoning: Some(det.reasoning),
                    regex_reasoning: None,
                    function_name: None,
                    class_name: None,
                }
            })
            .collect();

        Ok(violations)
    }

    /// Call API with retry logic for transient errors
    ///
    /// Retries on:
    /// - 429 (rate limit): Exponential backoff
    /// - 500 (server error): Linear backoff
    /// - 529 (overloaded): Exponential backoff
    /// - Network errors: Linear backoff
    ///
    /// # Arguments
    /// * `prompt` - User prompt
    /// * `system` - System prompt (optional)
    /// * `max_retries` - Maximum retry attempts (default: 3)
    async fn call_api_with_retry(
        &self,
        prompt: &str,
        system: Option<String>,
        max_retries: u32,
    ) -> Result<ClaudeResponse> {
        let mut attempt = 0;

        loop {
            match self.call_api(prompt, system.clone()).await {
                Ok(response) => return Ok(response),
                Err(e) => {
                    attempt += 1;

                    // Check if error is retryable
                    let error_msg = e.to_string();
                    let is_retryable = error_msg.contains("429") || error_msg.contains("500") || error_msg.contains("529") || error_msg.contains("network") || error_msg.contains("timeout");

                    if !is_retryable || attempt >= max_retries {
                        return Err(e);
                    }

                    // Calculate backoff delay
                    let delay_ms = if error_msg.contains("429") || error_msg.contains("529") {
                        // Exponential backoff for rate limits
                        1000 * (2_u64.pow(attempt))
                    } else {
                        // Linear backoff for server errors
                        2000 * attempt as u64
                    };

                    tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
                }
            }
        }
    }

    /// Get the model name (for validation/debugging)
    pub fn model() -> &'static str {
        "grok-code-fast-1"
    }

    /// Get the API version (for validation/debugging)
    pub fn api_version() -> &'static str {
        "2023-06-01"
    }

    /// Get the API endpoint (for validation/debugging)
    pub fn api_endpoint() -> &'static str {
        "https://api.x.ai/v1/chat/completions"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ============= Prompt Generation Tests =============

    #[test]
    fn test_build_cc6_1_access_control_prompt() {
        let client = ClaudeClient {
            api_key: "test".to_string(),
            http_client: Client::new(),
            api_base: "https://api.anthropic.com/v1".to_string(),
        };

        let prompt = client.build_fix_prompt(
            "CC6.1",
            "Missing @login_required decorator",
            "def view(request): pass",
            "django",
            None,
            None,
        );

        assert!(prompt.contains("access control"));
        assert!(prompt.contains("django"));
        assert!(prompt.contains("def view(request): pass"));
        assert!(prompt.contains("fixed code only"));
    }

    #[test]
    fn test_build_cc6_7_secrets_prompt() {
        let client = ClaudeClient {
            api_key: "test".to_string(),
            http_client: Client::new(),
            api_base: "https://api.anthropic.com/v1".to_string(),
        };

        let prompt = client.build_fix_prompt(
            "CC6.7",
            "Hardcoded API key in source",
            "API_KEY = 'sk_live_12345'",
            "python",
            None,
            None,
        );

        assert!(prompt.contains("secrets/cryptography"));
        assert!(prompt.contains("environment variables"));
        assert!(prompt.contains("API_KEY = 'sk_live_12345'"));
    }

    #[test]
    fn test_build_cc7_2_logging_prompt() {
        let client = ClaudeClient {
            api_key: "test".to_string(),
            http_client: Client::new(),
            api_base: "https://api.anthropic.com/v1".to_string(),
        };

        let prompt = client.build_fix_prompt(
            "CC7.2",
            "Missing audit log for user creation",
            "user.save()",
            "django",
            None,
            None,
        );

        assert!(prompt.contains("logging violation"));
        assert!(prompt.contains("audit logging"));
        assert!(prompt.contains("sensitive data"));
        assert!(prompt.contains("user.save()"));
    }

    #[test]
    fn test_build_a1_2_resilience_prompt() {
        let client = ClaudeClient {
            api_key: "test".to_string(),
            http_client: Client::new(),
            api_base: "https://api.anthropic.com/v1".to_string(),
        };

        let prompt = client.build_fix_prompt(
            "A1.2",
            "Unhandled network request with no timeout",
            "requests.get(url)",
            "python",
            None,
            None,
        );

        assert!(prompt.contains("resilience violation"));
        assert!(prompt.contains("error handling"));
        assert!(prompt.contains("timeouts"));
        assert!(prompt.contains("retry"));
    }

    #[test]
    fn test_build_generic_control_prompt() {
        let client = ClaudeClient {
            api_key: "test".to_string(),
            http_client: Client::new(),
            api_base: "https://api.anthropic.com/v1".to_string(),
        };

        let prompt = client.build_fix_prompt(
            "UNKNOWN",
            "Some violation",
            "code here",
            "nodejs",
            None,
            None,
        );

        assert!(prompt.contains("compliance violation"));
        assert!(prompt.contains("Some violation"));
        assert!(prompt.contains("code here"));
    }

    // ============= Request Serialization Tests =============

    #[test]
    fn test_claude_request_serialization_minimal() {
        let request = ClaudeRequest {
            model: "grok-code-fast-1".to_string(),
            max_tokens: 4096,
            messages: vec![Message {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            temperature: None,
            stream: Some(false),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("\"model\":\"grok-beta\""));
        assert!(json.contains("\"max_tokens\":4096"));
        assert!(json.contains("\"role\":\"user\""));
        assert!(json.contains("\"content\":\"Hello\""));
        assert!(json.contains("\"stream\":false"));
    }

    // Test removed: Grok uses OpenAI format with system message in messages array,
    // not separate system field like Claude

    #[test]
    fn test_system_block_without_cache_control() {
        let block = SystemBlock {
            block_type: "text".to_string(),
            text: "System prompt".to_string(),
            cache_control: None,
        };

        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"text\""));
        assert!(json.contains("\"text\":\"System prompt\""));
        assert!(!json.contains("\"cache_control\""));
    }

    #[test]
    fn test_system_block_with_ephemeral_cache() {
        let block = SystemBlock {
            block_type: "text".to_string(),
            text: "Large cacheable content".to_string(),
            cache_control: Some(CacheControl {
                control_type: "ephemeral".to_string(),
            }),
        };

        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"cache_control\""));
        assert!(json.contains("\"type\":\"ephemeral\""));
    }

    #[test]
    fn test_cache_control_serialization() {
        let cache = CacheControl {
            control_type: "ephemeral".to_string(),
        };

        let json = serde_json::to_string(&cache).unwrap();
        assert_eq!(json, "{\"type\":\"ephemeral\"}");
    }

    // ============= Response Parsing Tests =============

    #[test]
    fn test_claude_response_parsing() {
        let json = r#"{
            "id": "chatcmpl-123",
            "object": "chat.completion",
            "created": 1677652288,
            "model": "grok-code-fast-1",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Fixed code here"
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "input_tokens": 100,
                "output_tokens": 50,
                "cache_creation_input_tokens": 0,
                "cache_read_input_tokens": 0
            }
        }"#;

        let response: ClaudeResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.id, "chatcmpl-123");
        assert_eq!(response.choices[0].message.content, "Fixed code here");
        assert_eq!(response.usage.input_tokens, 100);
        assert_eq!(response.usage.output_tokens, 50);
    }

    #[test]
    fn test_usage_metrics_with_cache() {
        let json = r#"{
            "input_tokens": 100,
            "output_tokens": 50,
            "cache_creation_input_tokens": 1000,
            "cache_read_input_tokens": 500
        }"#;

        let metrics: UsageMetrics = serde_json::from_str(json).unwrap();
        assert_eq!(metrics.input_tokens, 100);
        assert_eq!(metrics.cache_creation_input_tokens, 1000);
        assert_eq!(metrics.cache_read_input_tokens, 500);
    }

    #[test]
    fn test_usage_metrics_defaults_to_zero() {
        let json = r#"{
            "input_tokens": 100,
            "output_tokens": 50
        }"#;

        let metrics: UsageMetrics = serde_json::from_str(json).unwrap();
        assert_eq!(metrics.input_tokens, 100);
        assert_eq!(metrics.cache_creation_input_tokens, 0);
        assert_eq!(metrics.cache_read_input_tokens, 0);
    }

    // ============= Client Initialization Tests =============

    #[test]
    fn test_validate_api_key_valid() {
        let result = ClaudeClient::validate_api_key("sk_1234567890123456789");
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_api_key_empty() {
        let result = ClaudeClient::validate_api_key("");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("empty"));
    }

    #[test]
    fn test_validate_api_key_too_short() {
        let result = ClaudeClient::validate_api_key("short");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("invalid"));
    }

    #[test]
    fn test_create_client_with_valid_key() {
        let result = ClaudeClient::with_key("sk_1234567890123456789".to_string());
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_client_with_invalid_key() {
        let result = ClaudeClient::with_key("short".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_create_client_with_custom_url() {
        let result = ClaudeClient::with_url(
            "sk_1234567890123456789".to_string(),
            "https://custom.api.com/v1".to_string(),
        );
        assert!(result.is_ok());
        let client = result.unwrap();
        assert_eq!(client.api_base, "https://custom.api.com/v1");
    }

    // ============= Constants Tests =============

    #[test]
    fn test_model_constant() {
        assert_eq!(ClaudeClient::model(), "grok-beta");
    }

    #[test]
    fn test_api_version_constant() {
        assert_eq!(ClaudeClient::api_version(), "2023-06-01");
    }

    #[test]
    fn test_api_endpoint_constant() {
        assert_eq!(
            ClaudeClient::api_endpoint(),
            "https://api.x.ai/v1/chat/completions"
        );
    }

    // ============= Message Structure Tests =============

    #[test]
    fn test_message_structure() {
        let msg = Message {
            role: "user".to_string(),
            content: "Hello, Claude!".to_string(),
        };

        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"role\":\"user\""));
        assert!(json.contains("\"content\":\"Hello, Claude!\""));
    }

    #[test]
    fn test_content_block_structure() {
        let block = ContentBlock {
            block_type: "text".to_string(),
            text: "Some response text".to_string(),
        };

        let json = serde_json::to_string(&block).unwrap();
        assert!(json.contains("\"type\":\"text\""));
        assert!(json.contains("\"text\":\"Some response text\""));
    }

    // ============= Integration-like Tests =============

    #[test]
    fn test_full_request_structure() {
        let request = ClaudeRequest {
            model: "grok-code-fast-1".to_string(),
            max_tokens: 4096,
            messages: vec![
                Message {
                    role: "system".to_string(),
                    content: "You are helpful".to_string(),
                },
                Message {
                    role: "user".to_string(),
                    content: "Fix this code".to_string(),
                },
            ],
            temperature: Some(0.0),
            stream: Some(false),
        };

        let json = serde_json::to_value(&request).unwrap();
        assert_eq!(json["model"], "grok-beta");
        assert_eq!(json["max_tokens"], 4096);
        assert_eq!(json["messages"][0]["role"], "system");
        assert_eq!(json["messages"][1]["role"], "user");
    }

    #[test]
    fn test_multiple_choices_in_response() {
        let json = r#"{
            "id": "chatcmpl-123",
            "object": "chat.completion",
            "created": 1677652288,
            "model": "grok-code-fast-1",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "First response"
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "input_tokens": 100,
                "output_tokens": 50,
                "cache_creation_input_tokens": 0,
                "cache_read_input_tokens": 0
            }
        }"#;

        let response: ClaudeResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.choices.len(), 1);
        assert_eq!(response.choices[0].message.content, "First response");
    }

    #[test]
    fn test_skip_serializing_optional_fields() {
        let request = ClaudeRequest {
            model: "grok-code-fast-1".to_string(),
            max_tokens: 4096,
            messages: vec![Message {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            temperature: None,
            stream: None,
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(!json.contains("\"temperature\""));
        assert!(!json.contains("\"stream\""));
    }
}
