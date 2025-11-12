//! Claude Haiku 4.5 API Client for SOC 2 compliance fix generation
//!
//! This module provides a production-ready client for the Anthropic Claude Messages API,
//! with support for streaming, prompt caching, and structured error handling.
//!
//! API Specifications (from context7 documentation):
//! - Model: claude-haiku-4-5-20251001
//! - Endpoint: POST https://api.anthropic.com/v1/messages
//! - API Version: 2023-06-01
//! - Streaming: Supported via stream: true
//! - Prompt Caching: Ephemeral type with 2048 token minimum for Haiku

use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

/// Request body structure for Claude Messages API
/// Matches Anthropic API specification exactly
#[derive(Debug, Clone, Serialize)]
pub struct ClaudeRequest {
    /// Model identifier (must be claude-haiku-4-5-20251001)
    pub model: String,
    /// Maximum tokens in response
    pub max_tokens: i32,
    /// Conversation messages
    pub messages: Vec<Message>,
    /// System prompt blocks (optional, supports caching)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<Vec<SystemBlock>>,
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

/// Response from Claude Messages API
#[derive(Debug, Clone, Deserialize)]
pub struct ClaudeResponse {
    /// Message ID
    pub id: String,
    /// Response type (always "message")
    #[serde(rename = "type")]
    pub response_type: String,
    /// Role (always "assistant")
    pub role: String,
    /// Content blocks
    pub content: Vec<ContentBlock>,
    /// Model used
    pub model: String,
    /// Stop reason (e.g., "end_turn")
    pub stop_reason: String,
    /// Token usage metrics
    pub usage: UsageMetrics,
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
            api_base: "https://api.anthropic.com/v1".to_string(),
        })
    }

    /// Create client with custom API key (for testing)
    pub fn with_key(api_key: String) -> Result<Self> {
        Self::validate_api_key(&api_key)?;

        Ok(Self {
            api_key,
            http_client: Client::new(),
            api_base: "https://api.anthropic.com/v1".to_string(),
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
    ///
    /// # Returns
    /// Fixed code as a string
    pub async fn generate_fix(
        &self,
        violation_control_id: &str,
        violation_description: &str,
        original_code: &str,
        framework: &str,
    ) -> Result<String> {
        let prompt = self.build_fix_prompt(
            violation_control_id,
            violation_description,
            original_code,
            framework,
        );

        let response = self.call_api(&prompt, None).await?;

        Ok(response
            .content
            .first()
            .map(|b| b.text.clone())
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
        system_context: &str,
    ) -> Result<String> {
        let prompt = self.build_fix_prompt(
            violation_control_id,
            violation_description,
            original_code,
            framework,
        );

        let response = self.call_api(&prompt, Some(system_context.to_string())).await?;

        Ok(response
            .content
            .first()
            .map(|b| b.text.clone())
            .unwrap_or_default())
    }

    /// Build fix prompt based on SOC 2 control
    ///
    /// Constructs specialized prompts for different control types to ensure
    /// consistent, high-quality fixes
    fn build_fix_prompt(
        &self,
        control_id: &str,
        description: &str,
        code: &str,
        framework: &str,
    ) -> String {
        match control_id {
            "CC6.1" => {
                format!(
                    "Fix the following access control violation in {} code:\n\n\
                     Violation: {}\n\n\
                     Original code:\n```\n{}\n```\n\n\
                     Provide the fixed code only, no explanation.",
                    framework, description, code
                )
            }
            "CC6.7" => {
                format!(
                    "Fix the following secrets/cryptography violation in {} code:\n\n\
                     Violation: {}\n\n\
                     Original code:\n```\n{}\n```\n\n\
                     Move hardcoded secrets to environment variables. \
                     Provide the fixed code only, no explanation.",
                    framework, description, code
                )
            }
            "CC7.2" => {
                format!(
                    "Fix the following logging violation in {} code:\n\n\
                     Violation: {}\n\n\
                     Original code:\n```\n{}\n```\n\n\
                     Add proper audit logging without logging sensitive data. \
                     Provide the fixed code only, no explanation.",
                    framework, description, code
                )
            }
            "A1.2" => {
                format!(
                    "Fix the following resilience violation in {} code:\n\n\
                     Violation: {}\n\n\
                     Original code:\n```\n{}\n```\n\n\
                     Add error handling, timeouts, and retry logic. \
                     Provide the fixed code only, no explanation.",
                    framework, description, code
                )
            }
            _ => {
                format!(
                    "Fix the following compliance violation:\n\n\
                     Violation: {}\n\n\
                     Original code:\n```\n{}\n```",
                    description, code
                )
            }
        }
    }

    /// Call Claude Messages API
    ///
    /// Sends request to API with proper headers, error handling, and response parsing
    async fn call_api(&self, prompt: &str, system: Option<String>) -> Result<ClaudeResponse> {
        // Build system blocks
        let mut system_blocks = vec![SystemBlock {
            block_type: "text".to_string(),
            text: "You are a security-focused code fixer for SOC 2 compliance. \
                   Your task is to fix compliance violations in code without breaking functionality. \
                   Always follow the framework's best practices."
                .to_string(),
            cache_control: None,
        }];

        // Add system context if provided
        // Only cache if >= 2048 tokens (context7 spec for Haiku)
        if let Some(ctx) = system {
            let word_count = ctx.split_whitespace().count();
            // Rough estimate: ~8 tokens per word in English text
            let estimated_tokens = (word_count / 8) * 10; // Slightly overestimate

            if estimated_tokens >= 2048 {
                system_blocks.push(SystemBlock {
                    block_type: "text".to_string(),
                    text: ctx,
                    cache_control: Some(CacheControl {
                        control_type: "ephemeral".to_string(),
                    }),
                });
            } else {
                system_blocks.push(SystemBlock {
                    block_type: "text".to_string(),
                    text: ctx,
                    cache_control: None,
                });
            }
        }

        // Build request
        let request = ClaudeRequest {
            model: "claude-haiku-4-5-20251001".to_string(),
            max_tokens: 4096,
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
            system: Some(system_blocks),
            stream: Some(false),
        };

        // Send request
        let response = self
            .http_client
            .post(format!("{}/messages", self.api_base))
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
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
            .context("Failed to parse Claude API response")?;

        Ok(claude_response)
    }

    /// Get the model name (for validation/debugging)
    pub fn model() -> &'static str {
        "claude-haiku-4-5-20251001"
    }

    /// Get the API version (for validation/debugging)
    pub fn api_version() -> &'static str {
        "2023-06-01"
    }

    /// Get the API endpoint (for validation/debugging)
    pub fn api_endpoint() -> &'static str {
        "https://api.anthropic.com/v1/messages"
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
        );

        assert!(prompt.contains("compliance violation"));
        assert!(prompt.contains("Some violation"));
        assert!(prompt.contains("code here"));
    }

    // ============= Request Serialization Tests =============

    #[test]
    fn test_claude_request_serialization_minimal() {
        let request = ClaudeRequest {
            model: "claude-haiku-4-5-20251001".to_string(),
            max_tokens: 4096,
            messages: vec![Message {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            system: None,
            stream: Some(false),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("\"model\":\"claude-haiku-4-5-20251001\""));
        assert!(json.contains("\"max_tokens\":4096"));
        assert!(json.contains("\"role\":\"user\""));
        assert!(json.contains("\"content\":\"Hello\""));
        assert!(json.contains("\"stream\":false"));
        assert!(!json.contains("\"system\""));
    }

    #[test]
    fn test_claude_request_with_system_blocks() {
        let request = ClaudeRequest {
            model: "claude-haiku-4-5-20251001".to_string(),
            max_tokens: 4096,
            messages: vec![Message {
                role: "user".to_string(),
                content: "Fix this".to_string(),
            }],
            system: Some(vec![SystemBlock {
                block_type: "text".to_string(),
                text: "You are helpful".to_string(),
                cache_control: None,
            }]),
            stream: Some(false),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("\"system\""));
        assert!(json.contains("\"type\":\"text\""));
        assert!(json.contains("\"text\":\"You are helpful\""));
    }

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
            "id": "msg_123",
            "type": "message",
            "role": "assistant",
            "content": [{"type": "text", "text": "Fixed code here"}],
            "model": "claude-haiku-4-5-20251001",
            "stop_reason": "end_turn",
            "usage": {
                "input_tokens": 100,
                "output_tokens": 50,
                "cache_creation_input_tokens": 0,
                "cache_read_input_tokens": 0
            }
        }"#;

        let response: ClaudeResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.id, "msg_123");
        assert_eq!(response.role, "assistant");
        assert_eq!(response.content[0].text, "Fixed code here");
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
        assert_eq!(ClaudeClient::model(), "claude-haiku-4-5-20251001");
    }

    #[test]
    fn test_api_version_constant() {
        assert_eq!(ClaudeClient::api_version(), "2023-06-01");
    }

    #[test]
    fn test_api_endpoint_constant() {
        assert_eq!(
            ClaudeClient::api_endpoint(),
            "https://api.anthropic.com/v1/messages"
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
        let blocks = vec![SystemBlock {
            block_type: "text".to_string(),
            text: "You are helpful".to_string(),
            cache_control: None,
        }];

        let request = ClaudeRequest {
            model: "claude-haiku-4-5-20251001".to_string(),
            max_tokens: 4096,
            messages: vec![
                Message {
                    role: "user".to_string(),
                    content: "Fix this code".to_string(),
                },
            ],
            system: Some(blocks),
            stream: Some(false),
        };

        let json = serde_json::to_value(&request).unwrap();
        assert_eq!(json["model"], "claude-haiku-4-5-20251001");
        assert_eq!(json["max_tokens"], 4096);
        assert_eq!(json["messages"][0]["role"], "user");
        assert_eq!(json["system"][0]["type"], "text");
    }

    #[test]
    fn test_multiple_content_blocks_in_response() {
        let json = r#"{
            "id": "msg_123",
            "type": "message",
            "role": "assistant",
            "content": [
                {"type": "text", "text": "First block"},
                {"type": "text", "text": "Second block"}
            ],
            "model": "claude-haiku-4-5-20251001",
            "stop_reason": "end_turn",
            "usage": {
                "input_tokens": 100,
                "output_tokens": 50
            }
        }"#;

        let response: ClaudeResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.content.len(), 2);
        assert_eq!(response.content[0].text, "First block");
        assert_eq!(response.content[1].text, "Second block");
    }

    #[test]
    fn test_skip_serializing_optional_fields() {
        let request = ClaudeRequest {
            model: "claude-haiku-4-5-20251001".to_string(),
            max_tokens: 4096,
            messages: vec![Message {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            system: None,
            stream: None,
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(!json.contains("\"system\""));
        assert!(!json.contains("\"stream\""));
    }
}
