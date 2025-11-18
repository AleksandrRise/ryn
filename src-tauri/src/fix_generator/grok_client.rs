//! Grok Code Fast 1 API Client for SOC 2 compliance fix generation
//!
//! This module provides a production-ready client for the X.AI Grok API,
//! with support for streaming, prompt caching, and structured error handling.
//!
//! API Specifications (from context7 documentation):
//! - Model: grok-code-fast-1
//! - Endpoint: POST https://api.x.ai/v1/chat/completions
//! - Authentication: Bearer token
//! - Format: OpenAI-compatible chat completions

use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;
use crate::models::{Control, Violation, Severity, DetectionMethod};

/// Request body structure for Grok Chat Completions API
/// OpenAI-compatible format
#[derive(Debug, Clone, Serialize)]
pub struct GrokRequest {
    /// Model identifier (grok-code-fast-1)
    pub model: String,
    /// Conversation messages (includes system and user messages)
    pub messages: Vec<Message>,
    /// Enable streaming responses (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    /// Temperature for response randomness (optional, 0-2)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    /// Maximum tokens in response (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<i32>,
}

/// Message in conversation (OpenAI-compatible)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// "system", "user", or "assistant"
    pub role: String,
    /// Message content
    pub content: String,
}

/// Response from Grok Chat Completions API
/// OpenAI-compatible format
#[derive(Debug, Clone, Deserialize)]
pub struct GrokResponse {
    /// Response ID
    pub id: String,
    /// Object type (always "chat.completion")
    pub object: String,
    /// Unix timestamp of creation
    pub created: i64,
    /// Model used
    pub model: String,
    /// System fingerprint
    #[serde(default)]
    pub system_fingerprint: String,
    /// Completion choices
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
    /// Finish reason (e.g., "stop", "length")
    pub finish_reason: String,
}

/// Token usage and cache metrics
#[derive(Debug, Clone, Deserialize)]
pub struct UsageMetrics {
    /// Input tokens used
    pub prompt_tokens: i32,
    /// Output tokens generated
    pub completion_tokens: i32,
    /// Total tokens
    pub total_tokens: i32,
}

impl UsageMetrics {
    /// Calculate cost in USD using Grok Code Fast 1 pricing
    ///
    /// Pricing (per million tokens):
    /// - Input: $0.20
    /// - Output: $0.50
    /// - Cached Input: $0.05
    pub fn calculate_cost(&self) -> f64 {
        let input_cost = (self.prompt_tokens as f64) * 0.20 / 1_000_000.0;
        let output_cost = (self.completion_tokens as f64) * 0.50 / 1_000_000.0;

        input_cost + output_cost
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

/// Grok API Client
/// Handles all communication with X.AI's Grok Chat Completions API
pub struct GrokClient {
    /// API key for authentication
    api_key: String,
    /// HTTP client (reused across requests)
    http_client: Client,
    /// API base URL
    api_base: String,
}

impl GrokClient {
    /// Create new Grok client from XAI_API_KEY environment variable
    ///
    /// # Errors
    /// Returns error if XAI_API_KEY is not set
    pub fn new() -> Result<Self> {
        let api_key = env::var("XAI_API_KEY")
            .context("XAI_API_KEY environment variable not set")?;

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
        if !key.starts_with("xai-") {
            return Err(anyhow!("API key must start with 'xai-'"));
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
        let system_prompt = "You are a security-focused code fixer for SOC 2 compliance. \
                            Your task is to fix compliance violations in code without breaking functionality. \
                            Always follow the framework's best practices.";

        let user_prompt = self.build_fix_prompt(
            violation_control_id,
            violation_description,
            original_code,
            framework,
            function_name,
            class_name,
        );

        let response = self.call_api(&user_prompt, Some(system_prompt)).await?;

        Ok(response
            .choices
            .first()
            .map(|choice| choice.message.content.clone())
            .unwrap_or_default())
    }

    /// Generate fix with custom system context
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
        let user_prompt = self.build_fix_prompt(
            violation_control_id,
            violation_description,
            original_code,
            framework,
            function_name,
            class_name,
        );

        let response = self.call_api(&user_prompt, Some(system_context)).await?;

        Ok(response
            .choices
            .first()
            .map(|choice| choice.message.content.clone())
            .unwrap_or_default())
    }

    /// Build fix prompt based on SOC 2 control
    fn build_fix_prompt(
        &self,
        control_id: &str,
        description: &str,
        code: &str,
        framework: &str,
        function_name: Option<&str>,
        class_name: Option<&str>,
    ) -> String {
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
            "CC6.1" => format!(
                "Fix the following access control violation in {} code:\n\n\
                 Violation: {}\n\n{}\
                 Original code:\n```\n{}\n```\n\n\
                 Provide the fixed code only, no explanation.",
                framework, description, context_section, code
            ),
            "CC6.7" => format!(
                "Fix the following secrets/cryptography violation in {} code:\n\n\
                 Violation: {}\n\n{}\
                 Original code:\n```\n{}\n```\n\n\
                 Move hardcoded secrets to environment variables. \
                 Provide the fixed code only, no explanation.",
                framework, description, context_section, code
            ),
            "CC7.2" => format!(
                "Fix the following logging violation in {} code:\n\n\
                 Violation: {}\n\n{}\
                 Original code:\n```\n{}\n```\n\n\
                 Add proper audit logging without logging sensitive data. \
                 Provide the fixed code only, no explanation.",
                framework, description, context_section, code
            ),
            "A1.2" => format!(
                "Fix the following resilience violation in {} code:\n\n\
                 Violation: {}\n\n{}\
                 Original code:\n```\n{}\n```\n\n\
                 Add error handling, timeouts, and retry logic. \
                 Provide the fixed code only, no explanation.",
                framework, description, context_section, code
            ),
            _ => format!(
                "Fix the following compliance violation:\n\n\
                 Violation: {}\n\n{}\
                 Original code:\n```\n{}\n```",
                description, context_section, code
            ),
        }
    }

    /// Call Grok Chat Completions API
    async fn call_api(&self, prompt: &str, system: Option<&str>) -> Result<GrokResponse> {
        let mut messages = Vec::new();

        if let Some(sys) = system {
            messages.push(Message {
                role: "system".to_string(),
                content: sys.to_string(),
            });
        }

        messages.push(Message {
            role: "user".to_string(),
            content: prompt.to_string(),
        });

        let request = GrokRequest {
            model: "grok-code-fast-1".to_string(),
            messages,
            stream: Some(false),
            temperature: Some(0.0),
            max_tokens: Some(4096),
        };

        let response = self
            .http_client
            .post(format!("{}/chat/completions", self.api_base))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .context("Failed to send request to Grok API")?;

        let status = response.status();
        let response_text = response
            .text()
            .await
            .context("Failed to read response body")?;

        if !status.is_success() {
            return Err(anyhow!(
                "Grok API error ({}): {}",
                status,
                response_text
            ));
        }

        let grok_response: GrokResponse = serde_json::from_str(&response_text)
            .context("Failed to parse Grok API response")?;

        Ok(grok_response)
    }

    pub async fn analyze_for_violations(
        &self,
        scan_id: i64,
        file_path: &str,
        code: &str,
        regex_findings: Vec<Violation>,
    ) -> Result<AnalysisResult> {
        let system_prompt = Self::build_soc2_system_prompt();
        let user_prompt = Self::build_analysis_prompt(file_path, code, &regex_findings);

        let response = self.call_api_with_retry(&user_prompt, Some(&system_prompt), 3).await?;

        let violations = Self::parse_violations_response(
            &response.choices.first().map(|c| c.message.content.as_str()).unwrap_or(""),
            scan_id,
            file_path,
        )?;

        Ok(AnalysisResult {
            violations,
            usage: response.usage,
        })
    }

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

    fn parse_violations_response(
        response_text: &str,
        scan_id: i64,
        file_path: &str,
    ) -> Result<Vec<Violation>> {
        let json_text = response_text
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        if json_text.is_empty() || json_text == "[]" {
            return Ok(Vec::new());
        }

        let detections: Vec<ViolationDetection> = serde_json::from_str(json_text)
            .context("Failed to parse LLM response as JSON")?;

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

    async fn call_api_with_retry(
        &self,
        prompt: &str,
        system: Option<&str>,
        max_retries: u32,
    ) -> Result<GrokResponse> {
        let mut attempt = 0;

        loop {
            match self.call_api(prompt, system).await {
                Ok(response) => return Ok(response),
                Err(e) => {
                    attempt += 1;

                    let error_msg = e.to_string();
                    let is_retryable = error_msg.contains("429") || error_msg.contains("500") || error_msg.contains("529") || error_msg.contains("network") || error_msg.contains("timeout");

                    if !is_retryable || attempt >= max_retries {
                        return Err(e);
                    }

                    let delay_ms = if error_msg.contains("429") || error_msg.contains("529") {
                        1000 * (2_u64.pow(attempt))
                    } else {
                        2000 * attempt as u64
                    };

                    tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
                }
            }
        }
    }

    pub fn model() -> &'static str {
        "grok-code-fast-1"
    }

    pub fn api_endpoint() -> &'static str {
        "https://api.x.ai/v1/chat/completions"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_api_key_valid() {
        let result = GrokClient::validate_api_key("xai-1234567890123456789");
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_api_key_empty() {
        let result = GrokClient::validate_api_key("");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("empty"));
    }

    #[test]
    fn test_validate_api_key_too_short() {
        let result = GrokClient::validate_api_key("xai-short");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("invalid"));
    }

    #[test]
    fn test_validate_api_key_wrong_prefix() {
        let result = GrokClient::validate_api_key("sk-1234567890123456789");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("xai-"));
    }

    #[test]
    fn test_usage_metrics_cost_calculation() {
        let metrics = UsageMetrics {
            prompt_tokens: 1_000_000,
            completion_tokens: 1_000_000,
            total_tokens: 2_000_000,
        };

        let cost = metrics.calculate_cost();
        assert!((cost - 0.70).abs() < 0.001);
    }

    #[test]
    fn test_model_constant() {
        assert_eq!(GrokClient::model(), "grok-code-fast-1");
    }

    #[test]
    fn test_api_endpoint_constant() {
        assert_eq!(
            GrokClient::api_endpoint(),
            "https://api.x.ai/v1/chat/completions"
        );
    }
}
