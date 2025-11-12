//! A1.2: Resilience & Error Handling
//!
//! SOC 2 Requirement: Systems must handle failures gracefully with appropriate error
//! handling, timeouts, retry logic, and circuit breaker patterns to ensure availability.
//!
//! This rule detects:
//! - External service calls without try/catch error handling
//! - Missing timeouts on network requests
//! - No retry logic on transient failures
//! - Missing circuit breaker patterns
//! - Unhandled database query failures

use anyhow::Context;
use anyhow::Result;
use crate::models::{Severity, Violation};
use regex::Regex;

/// A1.2 Resilience & Error Handling Rule Engine
///
/// Detects violations of resilience and error handling requirements in code.
/// Ensures external calls, database operations, and network requests are properly handled.
pub struct A12ResilienceRule;

impl A12ResilienceRule {
    /// Analyzes code for resilience and error handling violations
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

        // Pattern 1: External calls without error handling
        violations.extend(Self::detect_unhandled_external_calls(code, file_path, scan_id)?);

        // Pattern 2: Requests without timeout
        violations.extend(Self::detect_missing_timeout(code, file_path, scan_id)?);

        // Pattern 3: No retry logic
        violations.extend(Self::detect_missing_retry_logic(code, file_path, scan_id)?);

        // Pattern 4: Database operations without error handling
        violations.extend(Self::detect_unhandled_database_ops(code, file_path, scan_id)?);

        // Pattern 5: Missing circuit breaker patterns
        violations.extend(Self::detect_missing_circuit_breaker(code, file_path, scan_id)?);

        Ok(violations)
    }

    /// Detects external service calls without try/catch or error handling
    fn detect_unhandled_external_calls(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Pattern: External calls like requests.get, urllib.request, httpx, fetch, axios
        let external_call = Regex::new(
            r"(requests\.(get|post|put|delete|patch|request)|urllib\.|httpx\.|aiohttp\.|fetch\(|axios\.|\.query\()"
        )
        .context("Failed to compile external call pattern")?;

        let try_pattern =
            Regex::new(r"(try:|try\s*\{|try\(|with\s+)")
                .context("Failed to compile try pattern")?;

        let except_pattern = Regex::new(r"(except|catch\s*\(|except\s+|\.catch\()")
            .context("Failed to compile except pattern")?;

        let lines: Vec<&str> = code.lines().collect();

        for (idx, line) in lines.iter().enumerate() {
            if line.trim().starts_with("#") || line.trim().starts_with("//") {
                continue;
            }

            if external_call.is_match(line) {
                // Check if there's try/except in the surrounding context
                let check_start = if idx > 3 { idx - 3 } else { 0 };
                let check_end = std::cmp::min(idx + 5, lines.len());
                let context = lines[check_start..check_end].join(" ");

                // Check if error handling exists
                let has_try = try_pattern.is_match(&context);
                let has_except = except_pattern.is_match(&context);
                let has_with_statement = context.contains("with ");

                // Check the current line also
                let line_has_with = line.contains("with ");

                // Flag as violation if no error handling at all
                // Allow if: (try AND except) OR (with statement) OR (.catch() pattern)
                if !((has_try && has_except) || has_with_statement || line_has_with) {
                    violations.push(Violation::new(
                        scan_id,
                        "A1.2".to_string(),
                        Severity::High,
                        "External service call without error handling".to_string(),
                        file_path.to_string(),
                        (idx + 1) as i64,
                        line.trim().to_string(),
                    ));
                }
            }
        }

        Ok(violations)
    }

    /// Detects requests without timeout configuration
    fn detect_missing_timeout(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Pattern: HTTP requests
        let request_pattern = Regex::new(
            r"(requests\.(get|post|put|delete|patch)|fetch|\.query|aiohttp\.get|axios\.(get|post)|httpx\.(get|post|AsyncClient)|http\.request)\s*\("
        )
        .context("Failed to compile request pattern")?;

        let timeout_pattern =
            Regex::new(r"(timeout\s*=|timeout:|\.timeout\(|timeout\s*:|timeout\s*,)")
                .context("Failed to compile timeout pattern")?;

        let lines: Vec<&str> = code.lines().collect();

        for (idx, line) in lines.iter().enumerate() {
            if line.trim().starts_with("#") || line.trim().starts_with("//") {
                continue;
            }

            if request_pattern.is_match(line) {
                // Check if timeout is present in current or next 3 lines
                let check_end = std::cmp::min(idx + 3, lines.len());
                let next_lines = lines[idx..check_end].join(" ");

                if !timeout_pattern.is_match(&next_lines) {
                    violations.push(Violation::new(
                        scan_id,
                        "A1.2".to_string(),
                        Severity::High,
                        "External request without timeout configuration".to_string(),
                        file_path.to_string(),
                        (idx + 1) as i64,
                        line.trim().to_string(),
                    ));
                }
            }
        }

        Ok(violations)
    }

    /// Detects external calls without retry logic
    fn detect_missing_retry_logic(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Pattern: API calls that need retry
        let api_call = Regex::new(
            r"(requests\.(get|post)|\.query\(|http\.request|fetch|axios\.)"
        )
        .context("Failed to compile API call pattern")?;

        let retry_pattern = Regex::new(
            r"(@retry|retry|Retry|@tenacity|backoff|exponential|max_retries|retry_count|attempt|retries\s*=)"
        )
        .context("Failed to compile retry pattern")?;

        // Only flag once per file if there are API calls but no retry mechanisms
        if api_call.is_match(code) && !retry_pattern.is_match(code) {
            for (idx, line) in code.lines().enumerate() {
                if api_call.is_match(line) && !line.trim().starts_with("#")
                    && !line.trim().starts_with("//")
                {
                    violations.push(Violation::new(
                        scan_id,
                        "A1.2".to_string(),
                        Severity::Medium,
                        "No retry logic for transient failures".to_string(),
                        file_path.to_string(),
                        (idx + 1) as i64,
                        line.trim().to_string(),
                    ));
                    break; // Report once per file
                }
            }
        }

        Ok(violations)
    }

    /// Detects database operations without error handling
    fn detect_unhandled_database_ops(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Pattern: Database operations
        let db_op = Regex::new(
            r"(\.execute\(|\.query\(|cursor\.execute|db\.query|connection\.execute|database\.query)"
        )
        .context("Failed to compile database operation pattern")?;

        let error_handling = Regex::new(r"(except|catch|try|error|Error)")
            .context("Failed to compile error handling pattern")?;

        let lines: Vec<&str> = code.lines().collect();

        for (idx, line) in lines.iter().enumerate() {
            if line.trim().starts_with("#") || line.trim().starts_with("//") {
                continue;
            }

            if db_op.is_match(line) {
                // Check if error handling exists in next 3 lines or previous line
                let check_start = if idx > 0 { idx - 1 } else { 0 };
                let check_end = std::cmp::min(idx + 3, lines.len());
                let context_lines = lines[check_start..check_end].join(" ");

                if !error_handling.is_match(&context_lines) {
                    violations.push(Violation::new(
                        scan_id,
                        "A1.2".to_string(),
                        Severity::High,
                        "Database operation without error handling".to_string(),
                        file_path.to_string(),
                        (idx + 1) as i64,
                        line.trim().to_string(),
                    ));
                }
            }
        }

        Ok(violations)
    }

    /// Detects missing circuit breaker patterns
    fn detect_missing_circuit_breaker(
        code: &str,
        file_path: &str,
        scan_id: i64,
    ) -> Result<Vec<Violation>> {
        let mut violations = Vec::new();

        // Pattern: External service calls (indicates need for circuit breaker)
        let external_service = Regex::new(
            r"(requests\.(get|post)|http\.(get|post)|fetch|axios\.)"
        )
        .context("Failed to compile external service pattern")?;

        let circuit_breaker_pattern = Regex::new(
            r"(circuit_breaker|CircuitBreaker|@circuit_breaker|Hystrix|bulkhead|breaker)"
        )
        .context("Failed to compile circuit breaker pattern")?;

        // Only flag if there are multiple external service calls without circuit breaker
        let external_call_count = external_service.find_iter(code).count();

        if external_call_count > 1 && !circuit_breaker_pattern.is_match(code) {
            for (idx, line) in code.lines().enumerate() {
                if external_service.is_match(line) && !line.trim().starts_with("#")
                    && !line.trim().starts_with("//")
                {
                    violations.push(Violation::new(
                        scan_id,
                        "A1.2".to_string(),
                        Severity::Medium,
                        "Multiple external calls without circuit breaker pattern".to_string(),
                        file_path.to_string(),
                        (idx + 1) as i64,
                        line.trim().to_string(),
                    ));
                    break; // Report once per file
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
    fn test_detect_unhandled_request() {
        let code = "response = requests.get('http://api.example.com')";
        let violations = A12ResilienceRule::analyze(code, "api.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect unhandled external request"
        );
        assert_eq!(violations[0].severity, "high");
        assert!(violations[0]
            .description
            .contains("error handling"));
    }

    #[test]
    fn test_with_try_catch_handling() {
        let code = "try:\n    response = requests.get('http://api.example.com')\nexcept Exception as e:\n    pass";
        let violations = A12ResilienceRule::analyze(code, "api.py", 1).unwrap();
        // Should not flag error handling violations, but may flag other issues (timeout, retry)
        let error_handling_violations: Vec<_> = violations.iter().filter(|v| v.description.contains("error handling")).collect();
        assert!(error_handling_violations.is_empty(), "Should allow request with error handling");
    }

    #[test]
    fn test_with_context_manager_handling() {
        let code = "with requests.get('http://api.example.com') as response:\n    data = response.json()";
        let violations = A12ResilienceRule::analyze(code, "api.py", 1).unwrap();
        // With context manager provides resource management but not exception handling per se
        // Should not flag error handling, but may flag missing timeout
        let error_handling_violations: Vec<_> = violations.iter().filter(|v| v.description.contains("error handling")).collect();
        assert!(error_handling_violations.is_empty(), "Should allow with context manager");
    }

    #[test]
    fn test_detect_missing_timeout() {
        let code = "requests.get('http://api.example.com')";
        let violations = A12ResilienceRule::analyze(code, "api.py", 1).unwrap();
        let timeout_violations: Vec<_> = violations
            .iter()
            .filter(|v| v.description.contains("timeout"))
            .collect();
        assert!(
            !timeout_violations.is_empty(),
            "Should detect missing timeout"
        );
        assert_eq!(timeout_violations[0].severity, "high");
    }

    #[test]
    fn test_with_timeout_configured() {
        let code = "requests.get('http://api.example.com', timeout=5)";
        let violations = A12ResilienceRule::analyze(code, "api.py", 1).unwrap();
        let timeout_violations: Vec<_> = violations
            .iter()
            .filter(|v| v.description.contains("timeout"))
            .collect();
        assert!(
            timeout_violations.is_empty(),
            "Should not flag when timeout is present"
        );
    }

    #[test]
    fn test_timeout_with_multiline() {
        let code = "requests.post(\n    'http://api.example.com',\n    timeout=30\n)";
        let violations = A12ResilienceRule::analyze(code, "api.py", 1).unwrap();
        let timeout_violations: Vec<_> = violations
            .iter()
            .filter(|v| v.description.contains("timeout"))
            .collect();
        assert!(timeout_violations.is_empty(), "Should detect timeout in multiline");
    }

    #[test]
    fn test_detect_no_retry_logic() {
        let code = "def call_api():\n    response = requests.get('http://api.example.com')";
        let violations = A12ResilienceRule::analyze(code, "api.py", 1).unwrap();
        let retry_violations: Vec<_> = violations
            .iter()
            .filter(|v| v.description.contains("retry"))
            .collect();
        assert!(!retry_violations.is_empty(), "Should detect missing retry logic");
        assert_eq!(retry_violations[0].severity, "medium");
    }

    #[test]
    fn test_with_retry_decorator() {
        let code = "@retry(max_retries=3)\ndef call_api():\n    response = requests.get('http://api.example.com')";
        let violations = A12ResilienceRule::analyze(code, "api.py", 1).unwrap();
        let retry_violations: Vec<_> = violations
            .iter()
            .filter(|v| v.description.contains("retry"))
            .collect();
        assert!(
            retry_violations.is_empty(),
            "Should not flag retry when decorator present"
        );
    }

    #[test]
    fn test_with_tenacity_retry() {
        let code = "from tenacity import retry, stop_after_attempt\n@retry(stop=stop_after_attempt(3))\ndef call_api():\n    response = requests.get('http://api.example.com')";
        let violations = A12ResilienceRule::analyze(code, "api.py", 1).unwrap();
        let retry_violations: Vec<_> = violations
            .iter()
            .filter(|v| v.description.contains("retry"))
            .collect();
        assert!(
            retry_violations.is_empty(),
            "Should allow tenacity retry pattern"
        );
    }

    #[test]
    fn test_detect_unhandled_database_query() {
        let code = "cursor.execute('SELECT * FROM users')";
        let violations = A12ResilienceRule::analyze(code, "db.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect unhandled database query"
        );
        assert!(violations[0].description.contains("Database") || violations[0].description.contains("database"));
        assert_eq!(violations[0].severity, "high");
    }

    #[test]
    fn test_database_with_error_handling() {
        let code = "try:\n    cursor.execute('SELECT * FROM users')\nexcept Exception as e:\n    logger.error(e)";
        let violations = A12ResilienceRule::analyze(code, "db.py", 1).unwrap();
        assert!(violations.is_empty(), "Should allow database with error handling");
    }

    #[test]
    fn test_database_query_with_catch() {
        let code = "try {\n    connection.execute('SELECT * FROM users')\n} catch (err) {\n    console.error(err)\n}";
        let violations = A12ResilienceRule::analyze(code, "db.ts", 1).unwrap();
        assert!(violations.is_empty(), "Should recognize catch block");
    }

    #[test]
    fn test_detect_missing_circuit_breaker() {
        let code = "response1 = requests.get('http://api1.example.com')\nresponse2 = requests.post('http://api2.example.com')";
        let violations = A12ResilienceRule::analyze(code, "integrations.py", 1).unwrap();
        let breaker_violations: Vec<_> = violations
            .iter()
            .filter(|v| v.description.contains("circuit breaker"))
            .collect();
        assert!(
            !breaker_violations.is_empty(),
            "Should detect missing circuit breaker with multiple calls"
        );
    }

    #[test]
    fn test_with_circuit_breaker_pattern() {
        let code = "@circuit_breaker(failure_threshold=5, timeout=60)\ndef call_api():\n    response = requests.get('http://api1.example.com')\n    return response";
        let violations = A12ResilienceRule::analyze(code, "integrations.py", 1).unwrap();
        let breaker_violations: Vec<_> = violations
            .iter()
            .filter(|v| v.description.contains("circuit breaker"))
            .collect();
        assert!(
            breaker_violations.is_empty(),
            "Should allow circuit breaker pattern"
        );
    }

    #[test]
    fn test_single_external_call_no_breaker_needed() {
        let code = "response = requests.get('http://api.example.com')";
        let violations = A12ResilienceRule::analyze(code, "api.py", 1).unwrap();
        let breaker_violations: Vec<_> = violations
            .iter()
            .filter(|v| v.description.contains("circuit breaker"))
            .collect();
        assert!(
            breaker_violations.is_empty(),
            "Should not require circuit breaker for single call"
        );
    }

    #[test]
    fn test_ignore_commented_calls() {
        let code = "# response = requests.get('http://api.example.com')\ndata = None";
        let violations = A12ResilienceRule::analyze(code, "api.py", 1).unwrap();
        assert!(
            violations.is_empty(),
            "Should ignore commented external calls"
        );
    }

    #[test]
    fn test_fetch_without_error_handling() {
        let code = "fetch('http://api.example.com').then(r => r.json())";
        let violations = A12ResilienceRule::analyze(code, "api.js", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect unhandled fetch call"
        );
    }

    #[test]
    fn test_axios_without_timeout() {
        let code = "axios.get('http://api.example.com')";
        let violations = A12ResilienceRule::analyze(code, "api.ts", 1).unwrap();
        let timeout_violations: Vec<_> = violations
            .iter()
            .filter(|v| v.description.contains("timeout"))
            .collect();
        assert!(!timeout_violations.is_empty(), "Should detect axios without timeout");
    }

    #[test]
    fn test_database_with_try_block_above() {
        let code = "try:\n    connection.execute('SELECT * FROM users')\n    process_results()";
        let violations = A12ResilienceRule::analyze(code, "db.py", 1).unwrap();
        assert!(violations.is_empty(), "Should recognize error handling context");
    }

    #[test]
    fn test_httpx_without_timeout() {
        let code = "async with httpx.AsyncClient() as client:\n    response = await client.get('http://api.example.com')";
        let violations = A12ResilienceRule::analyze(code, "api.py", 1).unwrap();
        let timeout_violations: Vec<_> = violations
            .iter()
            .filter(|v| v.description.contains("timeout"))
            .collect();
        assert!(!timeout_violations.is_empty(), "Should detect httpx without timeout");
    }

    #[test]
    fn test_multiple_database_operations_without_error_handling() {
        let code = "db.query('INSERT INTO users VALUES(...)')\ndb.query('SELECT * FROM users')\ndb.query('DELETE FROM logs')";
        let violations = A12ResilienceRule::analyze(code, "schema.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect multiple unhandled database operations"
        );
    }

    #[test]
    fn test_cursor_execute_without_error_handling() {
        let code = "cursor.execute('CREATE TABLE users (id INT)')";
        let violations = A12ResilienceRule::analyze(code, "init.py", 1).unwrap();
        assert!(
            !violations.is_empty(),
            "Should detect unhandled cursor.execute"
        );
    }
}
