//! Environment variable management
//!
//! Handles loading and validation of environment variables for API keys and configuration.

use anyhow::{anyhow, Context, Result};
use std::env;

/// Load environment variables from .env file
///
/// Uses dotenv crate to load variables from .env file in project root.
/// Does not fail if .env file doesn't exist (optional configuration).
pub fn load_env() -> Result<()> {
    dotenv::dotenv().ok();
    Ok(())
}

/// Get XAI_API_KEY from environment
///
/// # Errors
/// Returns error if XAI_API_KEY environment variable is not set
pub fn get_xai_key() -> Result<String> {
    env::var("XAI_API_KEY")
        .context("XAI_API_KEY environment variable not set. Please set it in .env or your environment.")
}

/// Validate API key format
///
/// Checks that API key meets minimum requirements:
/// - Not empty
/// - At least 20 characters long
///
/// # Arguments
/// * `key` - API key to validate
///
/// # Errors
/// Returns error if key doesn't meet validation requirements
pub fn validate_api_key(key: &str) -> Result<()> {
    if key.is_empty() {
        return Err(anyhow!("API key cannot be empty"));
    }
    if key.len() < 20 {
        return Err(anyhow!(
            "API key appears invalid (too short). Expected >= 20 characters, got {}",
            key.len()
        ));
    }
    Ok(())
}

/// Get and validate XAI_API_KEY
///
/// Combines get_xai_key and validate_api_key into single operation
pub fn get_and_validate_api_key() -> Result<String> {
    let key = get_xai_key()?;
    validate_api_key(&key)?;
    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_api_key_valid_length() {
        let result = validate_api_key("xai-1234567890123456789");
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_api_key_empty() {
        let result = validate_api_key("");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("empty"));
    }

    #[test]
    fn test_validate_api_key_too_short() {
        let result = validate_api_key("short");
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .to_lowercase()
            .contains("invalid"));
    }

    #[test]
    fn test_validate_api_key_exactly_20_chars() {
        let key = "a".repeat(20);
        let result = validate_api_key(&key);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_api_key_19_chars() {
        let key = "a".repeat(19);
        let result = validate_api_key(&key);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_api_key_very_long() {
        let key = "a".repeat(1000);
        let result = validate_api_key(&key);
        assert!(result.is_ok());
    }

    #[test]
    fn test_load_env_doesnt_fail_on_missing_file() {
        // Should not panic or error even if .env doesn't exist
        let result = load_env();
        assert!(result.is_ok());
    }
}
