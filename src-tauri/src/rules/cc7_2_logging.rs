//! CC7.2: System Monitoring & Logging
//!
//! SOC 2 Requirement: All sensitive operations must be logged without exposing secrets.
//! Audit logs should capture who, what, when for data modifications and authentication events.
//!
//! This rule detects:
//! - Missing audit logs on sensitive operations (save, delete, update, create)
//! - Logging sensitive data (passwords, tokens, SSN, credit cards)
//! - Missing transaction logging
//! - Insufficient error logging
//! - Missing authentication event logging

use anyhow::Context;
use anyhow::Result;
use crate::models::{Severity, Violation};
use regex::Regex;

/// CC7.2 Logging & Monitoring Rule Engine
///
/// Detects violations of logging and monitoring requirements in code.
/// Ensures sensitive operations are audited and sensitive data is not logged.
pub struct CC72LoggingRule;

impl CC72LoggingRule {
    /// Analyzes code for logging and monitoring violations
    ///
    /// # Arguments
    /// * `code` - The source code to analyze
    /// * `file_path` - The path to the file being analyzed
    /// * `scan_id` - The ID of the current scan
    ///
    /// # Returns
    /// A vector of violations found in the code
    pub fn analyze(code: &str, file_path: &str, scan_id: i64) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Pattern 1: Sensitive operations without audit logging
        violations.extend(Self::detect_missing_audit_log(code, file_path, scan_id)?);

        // Pattern 2: Logging sensitive data
        violations.extend(Self::detect_sensitive_data_logging(code, file_path, scan_id)?);

        // Pattern 3: Authentication events without logging
        violations.extend(Self::detect_missing_auth_logging(code, file_path, scan_id)?);

        // Pattern 4: Database modifications without transaction logging
        violations.extend(Self::detect_missing_transaction_logging(code, file_path, scan_id)?);

        Ok(violations)
    }

    /// Detects sensitive operations (save, delete, update, create) without audit logging
    fn detect_missing_audit_log(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Pattern: sensitive operations like .save(), .delete(), .update(), INSERT, UPDATE, DELETE
        let sensitive_ops = Regex::new(r"(\.save\(\)|\.delete\(\)|\.create\(|\.update\(|\.remove\(|UPDATE\s+|INSERT\s+|DELETE\s+FROM)")
            .context("Failed to compile sensitive operations pattern")?;

        let logging_keywords = Regex::new(
            r"(logger|logging|log\(|console\.log|print\(|audit|syslog|trace|debug|info|warn)",
        )
        .context("Failed to compile logging keywords pattern")?;

        let lines: Vec<&str> = code.lines().collect();

        for (idx, line) in lines.iter().enumerate() {
            if sensitive_ops.is_match(line) && !line.trim().starts_with("#") && !line.trim().starts_with("//") {
                // Check if logging exists in current or next 3 lines
                let check_start = if idx > 1 { idx - 1 } else { 0 };
                let check_end = std::cmp::min(idx + 3, lines.len());
                let context_lines = lines[check_start..check_end].join(" ");

                if !logging_keywords.is_match(&context_lines) {
                    violations.push(Violation::new(
                        scan_id,
                        "CC7.2".to_string(),
                        Severity::Medium,
                        "Sensitive operation without audit logging".to_string(),
                        file_path.to_string(),
                        (idx + 1) as i64,
                        line.trim().to_string(),
                    ));
                }
            }
        }

        Ok(violations)
    }

    /// Detects logging statements that expose sensitive data
    fn detect_sensitive_data_logging(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Detect logging calls that include sensitive keywords
        // Matches: logger.info(), logger.debug(), print(), console.log(), log()
        let logging_func = Regex::new(r"(logger|print|console|log)\s*(\.\w+)?\s*\(")
            .context("Failed to compile logging function pattern")?;

        let sensitive_patterns = [
            ("password", "password"),
            ("pwd", "password"),
            ("secret", "secret"),
            ("api_key", "API key"),
            ("apikey", "API key"),
            ("token", "token"),
            ("ssn", "SSN"),
            ("social", "social security"),
            ("card_number", "credit card"),
            ("card", "credit card"),
            ("cvv", "CVV"),
        ];

        for (idx, line) in code.lines().enumerate() {
            if line.trim().starts_with("#") || line.trim().starts_with("//") {
                continue;
            }

            // Check if this line has a logging function
            if logging_func.is_match(line) {
                // Check for sensitive keywords
                let line_lower = line.to_lowercase();
                for (keyword, display_name) in sensitive_patterns.iter() {
                    if line_lower.contains(keyword) {
                        violations.push(Violation::new(
                            scan_id,
                            "CC7.2".to_string(),
                            Severity::Critical,
                            format!("Sensitive data ({}) in logging statement", display_name),
                            file_path.to_string(),
                            (idx + 1) as i64,
                            line.trim().to_string(),
                        ));
                        break; // Report once per line
                    }
                }
            }
        }

        Ok(violations)
    }

    /// Detects authentication events without logging
    fn detect_missing_auth_logging(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Pattern: authentication function definitions (not calls)
        let auth_def = Regex::new(
            r"^\s*def\s+(login|authenticate|verify_token|verify_password|validate_credentials)\b"
        )
        .context("Failed to compile auth definition pattern")?;

        let logging_keywords = Regex::new(
            r"(logger|logging|log\(|console\.log|print\(|audit)",
        )
        .context("Failed to compile logging keywords pattern")?;

        let lines: Vec<&str> = code.lines().collect();

        for (idx, line) in lines.iter().enumerate() {
            if auth_def.is_match(line) && !line.trim().starts_with("#") && !line.trim().starts_with("//") {
                // Look for logging in the next few lines
                let check_end = std::cmp::min(idx + 4, lines.len());
                let next_lines = lines[idx + 1..check_end].join(" ");

                if !logging_keywords.is_match(&next_lines) {
                    violations.push(Violation::new(
                        scan_id,
                        "CC7.2".to_string(),
                        Severity::High,
                        "Authentication event without logging".to_string(),
                        file_path.to_string(),
                        (idx + 1) as i64,
                        line.trim().to_string(),
                    ));
                }
            }
        }

        Ok(violations)
    }

    /// Detects database modifications without transaction logging
    fn detect_missing_transaction_logging(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Pattern: database transaction operations
        let db_transaction = Regex::new(
            r"\b(BEGIN|COMMIT|ROLLBACK|START TRANSACTION|begin_transaction|commit|rollback)\b"
        )
        .context("Failed to compile transaction pattern")?;

        let logging_keywords = Regex::new(
            r"(logger|logging|log\(|console\.log|print\(|audit|transaction.log)",
        )
        .context("Failed to compile logging keywords pattern")?;

        // Only flag if there are transactions but no logging in the file
        if db_transaction.is_match(code) && !logging_keywords.is_match(code) {
            let lines: Vec<&str> = code.lines().collect();

            for (idx, line) in lines.iter().enumerate() {
                if db_transaction.is_match(line) {
                    violations.push(Violation::new(
                        scan_id,
                        "CC7.2".to_string(),
                        Severity::Medium,
                        "Database transaction without logging mechanism".to_string(),
                        file_path.to_string(),
                        (idx + 1) as i64,
                        line.trim().to_string(),
                    ));
                    break; // Only report once per file
                }
            }
        }

        Ok(violations)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_missing_audit_log_on_save() {
        let code = "user.save()";
        let violations = CC72LoggingRule::analyze(code, "models.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect missing audit log on save()"
        );
        assert_eq!(violations[0].severity, "medium");
        assert_eq!(violations[0].control_id, "CC7.2");
    }

    #[test]
    fn test_with_audit_log_on_save() {
        let code = "logger.info('User saved')\nuser.save()";
        let violations = CC72LoggingRule::analyze(code, "models.py", 1).unwrap();
        assert!(violations.is_empty(), "Should allow save with logging");
    }

    #[test]
    fn test_detect_missing_audit_log_on_delete() {
        let code = "user.delete()";
        let violations = CC72LoggingRule::analyze(code, "models.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect missing audit log on delete()"
        );
    }

    #[test]
    fn test_detect_missing_audit_log_on_update() {
        let code = "user.update(name='John')";
        let violations = CC72LoggingRule::analyze(code, "models.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect missing audit log on update()"
        );
    }

    #[test]
    fn test_detect_logging_password_in_logger() {
        let code = "logger.info(f'password: {password}')";
        let violations = CC72LoggingRule::analyze(code, "auth.py", 1).unwrap();
        assert!(!violations.is_empty(), "Should detect password in logging");
        assert_eq!(violations[0].severity, "critical");
    }

    #[test]
    fn test_detect_logging_token() {
        let code = "print(f'auth token: {token}')";
        let violations = CC72LoggingRule::analyze(code, "auth.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect token in logging statement"
        );
        assert_eq!(violations[0].severity, "critical");
    }

    #[test]
    fn test_detect_logging_api_key() {
        let code = "console.log('API Key: ' + apikey)";
        let violations = CC72LoggingRule::analyze(code, "service.js", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect API key in logging"
        );
        assert_eq!(violations[0].severity, "critical");
    }

    #[test]
    fn test_detect_logging_ssn() {
        let code = "logger.info(f'SSN: {ssn}')";
        let violations = CC72LoggingRule::analyze(code, "user.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect SSN in logging statement"
        );
        assert_eq!(violations[0].severity, "critical");
    }

    #[test]
    fn test_detect_logging_credit_card() {
        let code = "print(f'Card Number: {card_number}')";
        let violations = CC72LoggingRule::analyze(code, "payment.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect credit card in logging"
        );
    }

    #[test]
    fn test_detect_missing_auth_logging() {
        let code = "def authenticate(username, password):\n    return check_password(username, password)";
        let violations = CC72LoggingRule::analyze(code, "auth.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect missing auth event logging"
        );
        assert_eq!(violations[0].severity, "high");
    }

    #[test]
    fn test_auth_with_logging() {
        let code = "def authenticate(username, password):\n    logger.info('Auth attempt')\n    return check_password(username, password)";
        let violations = CC72LoggingRule::analyze(code, "auth.py", 1).unwrap();
        // The check_password call should not trigger a violation if logging is nearby
        let auth_violations: Vec<_> = violations.iter().filter(|v| v.description.contains("Authentication event")).collect();
        assert!(auth_violations.is_empty(), "Should allow auth with logging nearby");
    }

    #[test]
    fn test_detect_missing_transaction_logging() {
        let code = "BEGIN\nUPDATE users SET active=1\nCOMMIT";
        let violations = CC72LoggingRule::analyze(code, "schema.sql", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect transaction without logging"
        );
        assert_eq!(violations[0].severity, "medium");
    }

    #[test]
    fn test_transaction_with_logging() {
        let code = "logger.info('Starting transaction')\nBEGIN\nUPDATE users SET active=1\nCOMMIT\nlogger.info('Transaction complete')";
        let violations = CC72LoggingRule::analyze(code, "schema.sql", 1).unwrap();
        assert!(violations.is_empty(), "Should allow transaction with logging");
    }

    #[test]
    fn test_ignore_commented_operations() {
        let code = "# user.save()\nuser = None";
        let violations = CC72LoggingRule::analyze(code, "models.py", 1).unwrap();
        assert!(
            violations.is_empty(),
            "Should ignore commented sensitive operations"
        );
    }

    #[test]
    fn test_multiple_violations() {
        let code = "user.save()\nlogger.info(f'password: {pwd}')\nauthenticate()";
        let violations = CC72LoggingRule::analyze(code, "app.py", 1).unwrap();
        // Should detect at least the password in logging and the authenticate without logging
        assert!(violations.len() >= 1, "Should detect violations");
        let has_password = violations.iter().any(|v| v.description.contains("password") || v.description.contains("Sensitive data"));
        assert!(has_password, "Should detect password logging");
    }

    #[test]
    fn test_insert_without_logging() {
        let code = "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')";
        let violations = CC72LoggingRule::analyze(code, "schema.sql", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect INSERT without logging"
        );
    }

    #[test]
    fn test_delete_from_without_logging() {
        let code = "DELETE FROM users WHERE id = 42";
        let violations = CC72LoggingRule::analyze(code, "schema.sql", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect DELETE FROM without logging"
        );
    }

    #[test]
    fn test_secret_in_format_string() {
        let code = "logger.info(f'Secret: {secret}')";
        let violations = CC72LoggingRule::analyze(code, "config.py", 1).unwrap();
        // This may or may not trigger depending on whether "secret" is in the password list
        let secret_violations: Vec<_> = violations.iter().filter(|v| v.description.contains("Sensitive data")).collect();
        assert!(
            !secret_violations.is_empty(),
            "Should detect secret in logging statement"
        );
    }

    #[test]
    fn test_verify_token_without_logging() {
        let code = "def verify_token(token):\n    return token_valid(token)";
        let violations = CC72LoggingRule::analyze(code, "auth.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect verify_token without logging"
        );
    }
}
