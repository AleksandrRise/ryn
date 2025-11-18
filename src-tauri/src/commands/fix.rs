//! Fix generation and application commands
//!
//! Handles AI-generated fix creation and application to source files

use crate::db::{self, queries};
use crate::models::Fix;
use crate::security::path_validation;
use crate::rate_limiter::{RateLimiter, RateLimiterConfig};
use crate::utils::create_audit_event;
use crate::fix_generator::grok_client::GrokClient;
use std::path::Path;
use std::sync::Arc;
use once_cell::sync::Lazy;

// Global rate limiter instance (shared across all fix generation calls)
static RATE_LIMITER: Lazy<Arc<RateLimiter>> = Lazy::new(|| {
    // Load config from environment or use defaults
    let config = if let Ok(val) = std::env::var("RYN_DISABLE_RATE_LIMIT") {
        if val == "true" {
            RateLimiterConfig {
                enabled: false,
                ..Default::default()
            }
        } else {
            RateLimiterConfig::default()
        }
    } else {
        RateLimiterConfig::default()
    };

    Arc::new(RateLimiter::with_config(config))
});

/// Generate a fix for a violation using the AI agent (langchain-rust + Claude)
///
/// Calls Claude API directly via langchain-rust to generate a fix for a specific violation,
/// stores the fix in the database with trust_level = "review"
///
/// # Arguments
/// * `violation_id` - ID of the violation to fix
///
/// Returns: Generated Fix object or error
#[tauri::command]
pub async fn generate_fix(
    violation_id: i64,
) -> Result<Fix, String> {
    // Phase 1: Read all required data from database (scoped to drop guard before awaits)
    let (_violation, _scan_project_id, _project_path, _project_framework, file_path) = {
        let conn = db::get_connection();

        // Get violation from database
        let violation = queries::select_violation(&conn, violation_id)
            .map_err(|e| format!("Failed to fetch violation: {}", e))?
            .ok_or_else(|| format!("Violation not found: {}", violation_id))?;

        // Get scan and project info
        let scan = queries::select_scan(&conn, violation.scan_id)
            .map_err(|e| format!("Failed to fetch scan: {}", e))?
            .ok_or_else(|| "Scan not found".to_string())?;

        let project = queries::select_project(&conn, scan.project_id)
            .map_err(|e| format!("Failed to fetch project: {}", e))?
            .ok_or_else(|| "Project not found".to_string())?;

        // Validate and save file path
        let file_path = path_validation::validate_file_path(
            Path::new(&project.path),
            &violation.file_path
        ).map_err(|e| format!("Security: Invalid file path: {}", e))?;

        (violation.clone(), scan.project_id, project.path, project.framework, file_path)
    }; // MutexGuard dropped here

    // Validate file exists (doesn't need DB connection)
    let _file_content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Phase 2: Invoke AI fix generation (no DB connection held)
    // Check rate limit before calling agent
    RATE_LIMITER.check_rate_limit().await
        .map_err(|e| format!("API rate limit: {}", e))?;

    // Call Claude API to generate fix
    let grok_client = GrokClient::new()
        .map_err(|e| format!("Failed to create Claude client: {}", e))?;

    let framework_str = _project_framework.as_deref().unwrap_or("unknown");

    let fixed_code = grok_client.generate_fix(
        &_violation.control_id,
        &_violation.description,
        &_violation.code_snippet,
        framework_str,
        _violation.function_name.as_deref(),
        _violation.class_name.as_deref(),
    )
    .await
    .map_err(|e| format!("Claude API error: {}", e))?;

    // Generate explanation based on control ID
    let explanation = match _violation.control_id.as_str() {
        "CC6.1" => "Added access control protection to ensure only authorized users can access this resource.",
        "CC6.7" => "Moved hardcoded secret to environment variable. Use secure secret management in production.",
        "CC7.2" => "Added audit logging to track this sensitive operation for compliance monitoring.",
        "A1.2" => "Added error handling with proper recovery logic to improve system resilience.",
        _ => "Applied security fix to address compliance violation.",
    }.to_string();

    // Phase 3: Write results back to database (scoped to drop guard immediately)
    let result = {
        let conn = db::get_connection();

        // Create fix record in database
        let fix = Fix {
            id: 0,
            violation_id,
            original_code: _violation.code_snippet.clone(),
            fixed_code,
            explanation,
            trust_level: "review".to_string(),
            applied_at: None,
            applied_by: "ryn-ai".to_string(),
            git_commit_sha: None,
            backup_path: None,
        };

        let fix_id = queries::insert_fix(&conn, &fix)
            .map_err(|e| format!("Failed to save fix: {}", e))?;

        // Log audit event
        if let Ok(event) = create_audit_event(
            &conn,
            "fix_generated",
            Some(_scan_project_id),
            Some(violation_id),
            Some(fix_id),
            &format!("Generated fix for violation: {}", _violation.description),
        ) {
            let _ = queries::insert_audit_event(&conn, &event);
        }

        // Fetch and return created fix
        queries::select_fix(&conn, fix_id)
            .map_err(|e| format!("Failed to fetch created fix: {}", e))?
            .ok_or_else(|| "Fix was created but could not be retrieved".to_string())?
    }; // MutexGuard dropped here

    Ok(result)
}

/// Apply a fix to file content at a specific line number (pure function)
///
/// Takes file content and fix parameters, returns modified content without side effects.
/// This is a pure function with no database, filesystem, or git operations.
///
/// # Arguments
/// * `file_content` - The original file content as a string
/// * `original_code` - The code snippet to replace
/// * `fixed_code` - The replacement code snippet
/// * `line_number` - 1-indexed line number where the original code should be found
///
/// # Returns
/// * `Ok(String)` - Modified file content with fix applied
/// * `Err(String)` - Error if line number is out of range or code doesn't match
///
/// # Algorithm
/// 1. Parse file content into lines
/// 2. Convert 1-indexed line_number to 0-indexed array position
/// 3. Validate line number is within bounds
/// 4. Verify original_code exists on the target line
/// 5. Replace original_code with fixed_code on that line only
/// 6. Reconstruct file content with newline separators
///
/// # Example
/// ```rust
/// use ryn::commands::fix::apply_fix_to_content;
///
/// let content = "line1\npassword = \"secret\"\nline3\n";
/// let result = apply_fix_to_content(
///     content,
///     "\"secret\"",
///     "os.getenv(\"PASSWORD\")",
///     2  // Line 2
/// );
/// assert_eq!(result.unwrap(), "line1\npassword = os.getenv(\"PASSWORD\")\nline3");
/// ```
pub fn apply_fix_to_content(
    file_content: &str,
    original_code: &str,
    fixed_code: &str,
    line_number: i64,
) -> Result<String, String> {
    // Validate inputs: reject newlines in original_code or fixed_code
    // These would break the single-line replacement model
    if original_code.contains('\n') || original_code.contains('\r') {
        return Err(
            "Invalid original_code: contains newline characters. \
             This function operates on single lines only. \
             Use separate replacements for multi-line changes.".to_string()
        );
    }
    if fixed_code.contains('\n') || fixed_code.contains('\r') {
        return Err(
            "Invalid fixed_code: contains newline characters. \
             This function operates on single lines only. \
             Use separate replacements for multi-line changes.".to_string()
        );
    }

    // Parse lines
    let mut lines: Vec<String> = file_content.lines().map(|s| s.to_string()).collect();

    // Convert 1-indexed to 0-indexed
    let target_line_idx = (line_number as usize).saturating_sub(1);

    // Validate line number
    if target_line_idx >= lines.len() {
        return Err(format!(
            "Line number {} out of range (file has {} lines)",
            line_number,
            lines.len()
        ));
    }

    // Verify original code exists on target line
    let target_line = &lines[target_line_idx];
    if !target_line.contains(original_code) {
        return Err(format!(
            "Original code not found on line {}. Expected to find: '{}', but line contains: '{}'",
            line_number,
            original_code,
            target_line
        ));
    }

    // Replace only on the target line
    let updated_line = target_line.replace(original_code, fixed_code);
    lines[target_line_idx] = updated_line;

    // Reconstruct file content
    let updated_content = lines.join("\n");

    Ok(updated_content)
}

/// Apply a generated fix to the source code
///
/// NOTE: Git integration removed. This command now only applies fixes to files
/// without creating git commits.
///
/// # Arguments
/// * `fix_id` - ID of the fix to apply
///
/// Returns: Success message or error
#[tauri::command]
pub async fn apply_fix(fix_id: i64) -> Result<String, String> {
    let conn = db::get_connection();

    // Get fix
    let fix = queries::select_fix(&conn, fix_id)
        .map_err(|e| format!("Failed to fetch fix: {}", e))?
        .ok_or_else(|| format!("Fix not found: {}", fix_id))?;

    // Get violation and project info
    let violation = queries::select_violation(&conn, fix.violation_id)
        .map_err(|e| format!("Failed to fetch violation: {}", e))?
        .ok_or_else(|| "Violation not found".to_string())?;

    let scan = queries::select_scan(&conn, violation.scan_id)
        .map_err(|e| format!("Failed to fetch scan: {}", e))?
        .ok_or_else(|| "Scan not found".to_string())?;

    let project = queries::select_project(&conn, scan.project_id)
        .map_err(|e| format!("Failed to fetch project: {}", e))?
        .ok_or_else(|| "Project not found".to_string())?;

    let repo_path = Path::new(&project.path);

    // Validate file path with path traversal protection
    let file_path = path_validation::validate_file_path(
        repo_path,
        &violation.file_path
    ).map_err(|e| format!("Security: Invalid file path: {}", e))?;

    // Apply fix to file content using pure function
    let file_content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let updated_content = apply_fix_to_content(
        &file_content,
        &fix.original_code,
        &fix.fixed_code,
        violation.line_number,
    )?;

    // BACKUP: Create backup before modifying file
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let backup_dir = repo_path.join(format!(".ryn-backups/{}", timestamp));
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;

    let backup_file_name = file_path.file_name()
        .ok_or_else(|| "Failed to extract filename from path".to_string())?;
    let backup_path = backup_dir.join(backup_file_name);

    std::fs::copy(&file_path, &backup_path)
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    let backup_path_str = backup_path.to_string_lossy().to_string();

    // Write updated file (path already validated)
    std::fs::write(&file_path, &updated_content)
        .map_err(|e| format!("Failed to write fixed file: {}", e))?;

    // Update fix record with backup path (no git commit SHA)
    queries::update_fix_applied(&conn, fix_id, "", Some(&backup_path_str))
        .map_err(|e| format!("Failed to update fix: {}", e))?;

    // Update violation status to fixed
    queries::update_violation_status(&conn, fix.violation_id, "fixed")
        .map_err(|e| format!("Failed to update violation status: {}", e))?;

    // Log audit event
    if let Ok(event) = create_audit_event(
        &conn,
        "fix_applied",
        Some(scan.project_id),
        Some(fix.violation_id),
        Some(fix_id),
        &format!("Applied fix for violation: {}", violation.description),
    ) {
        let _ = queries::insert_audit_event(&conn, &event);
    }

    Ok(format!("Fix applied successfully to {}", violation.file_path))
}

#[cfg(test)]
mod tests {
    use crate::db::test_helpers::TestDbGuard;
    use super::*;

    #[tokio::test]
    #[serial_test::serial]
    async fn test_generate_fix_nonexistent_violation() {
        let _guard = TestDbGuard::new();
        let result = generate_fix(999).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_apply_fix_nonexistent_fix() {
        let _guard = TestDbGuard::new();
        let result = apply_fix(999).await;
        assert!(result.is_err());
    }

    // === UNIT TESTS: Pure function tests (fast, no git/DB) ===

    /// Test apply_fix_to_content line-specific replacement (pure function, no git)
    #[test]
    fn test_apply_fix_to_content_line_specific() {
        // File with SAME code on multiple lines
        let content = "import os\npassword = \"secret123\"\napi_key = \"secret123\"\ntoken = \"secret123\"\n";

        // Replace ONLY line 2
        let result = apply_fix_to_content(
            content,
            "\"secret123\"",
            "os.getenv(\"PASSWORD\")",
            2
        );

        assert!(result.is_ok());
        let updated = result.unwrap();
        let lines: Vec<&str> = updated.lines().collect();

        // Verify ONLY line 2 was modified
        assert_eq!(lines[0], "import os");
        assert_eq!(lines[1], "password = os.getenv(\"PASSWORD\")");
        assert_eq!(lines[2], "api_key = \"secret123\""); // Unchanged
        assert_eq!(lines[3], "token = \"secret123\"");   // Unchanged
    }

    /// Test apply_fix_to_content line out of range (pure function, no git)
    #[test]
    fn test_apply_fix_to_content_line_out_of_range() {
        let content = "line1\nline2\nline3\n";

        // Line 10 is out of range (file has 3 lines)
        let result = apply_fix_to_content(
            content,
            "line1",
            "fixed",
            10
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("out of range"));
    }

    /// Test apply_fix_to_content code mismatch (pure function, no git)
    #[test]
    fn test_apply_fix_to_content_code_mismatch() {
        let content = "actual_code_here\n";

        // Original code doesn't match line content
        let result = apply_fix_to_content(
            content,
            "wrong_code",
            "fixed",
            1
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Original code not found"));
    }

    /// Test empty file content
    #[test]
    fn test_apply_fix_to_content_empty_file() {
        let content = "";
        let result = apply_fix_to_content(content, "code", "fixed", 1);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("out of range"));
    }

    /// Test line 0 - saturating_sub makes it access first line
    #[test]
    fn test_apply_fix_to_content_line_zero() {
        let content = "first line\nsecond line\nthird line";
        let result = apply_fix_to_content(content, "first", "FIRST", 0);
        // Line 0 with saturating_sub(1) becomes index 0 (first line)
        assert!(result.is_ok());
        let updated = result.unwrap();
        assert!(updated.starts_with("FIRST line"));
    }

    /// Test line 1 (first line) explicitly
    #[test]
    fn test_apply_fix_to_content_line_one() {
        let content = "first line\nsecond line\nthird line";
        let result = apply_fix_to_content(content, "first", "FIRST", 1);
        assert!(result.is_ok());
        let updated = result.unwrap();
        let lines: Vec<&str> = updated.lines().collect();
        assert_eq!(lines[0], "FIRST line");
        assert_eq!(lines[1], "second line");
        assert_eq!(lines[2], "third line");
    }

    /// Test last line of file
    #[test]
    fn test_apply_fix_to_content_last_line() {
        let content = "first line\nsecond line\nthird line";
        let result = apply_fix_to_content(content, "third", "THIRD", 3);
        assert!(result.is_ok());
        let updated = result.unwrap();
        let lines: Vec<&str> = updated.lines().collect();
        assert_eq!(lines[0], "first line");
        assert_eq!(lines[1], "second line");
        assert_eq!(lines[2], "THIRD line");
    }

    /// Test single line file
    #[test]
    fn test_apply_fix_to_content_single_line() {
        let content = "only line here";
        let result = apply_fix_to_content(content, "only", "the only", 1);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "the only line here");
    }

    /// Test multiple occurrences on same line (all replaced)
    #[test]
    fn test_apply_fix_to_content_multiple_on_line() {
        let content = "var x = x + x;";
        let result = apply_fix_to_content(content, "x", "y", 1);
        assert!(result.is_ok());
        // .replace() replaces ALL occurrences
        assert_eq!(result.unwrap(), "var y = y + y;");
    }

    /// Test empty original_code
    #[test]
    fn test_apply_fix_to_content_empty_original() {
        let content = "some code here";
        let result = apply_fix_to_content(content, "", "new", 1);
        // Empty string is "found" on every line, but this is likely unintended
        // The function will succeed but behavior is odd
        assert!(result.is_ok());
    }

    /// Test empty fixed_code (deletion)
    #[test]
    fn test_apply_fix_to_content_empty_fixed() {
        let content = "console.log('debug');";
        let result = apply_fix_to_content(content, "console.log('debug');", "", 1);
        assert!(result.is_ok());
        // Entire line content is replaced with empty string
        assert_eq!(result.unwrap(), "");
    }

    /// Test special characters (quotes, backslashes)
    #[test]
    fn test_apply_fix_to_content_special_chars() {
        let content = "const regex = /\\d+/g;";
        let result = apply_fix_to_content(content, "/\\d+/g", "/[0-9]+/g", 1);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "const regex = /[0-9]+/g;");
    }

    /// Test Unicode characters
    #[test]
    fn test_apply_fix_to_content_unicode() {
        let content = "message = \"你好世界\"";
        let result = apply_fix_to_content(content, "你好世界", "Hello World", 1);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "message = \"Hello World\"");
    }

    /// Test tabs and mixed indentation
    #[test]
    fn test_apply_fix_to_content_tabs() {
        let content = "\tif (true) {\n\t\treturn false;\n\t}";
        let result = apply_fix_to_content(content, "false", "true", 2);
        assert!(result.is_ok());
        let updated = result.unwrap();
        let lines: Vec<&str> = updated.lines().collect();
        assert_eq!(lines[0], "\tif (true) {");
        assert_eq!(lines[1], "\t\treturn true;");
        assert_eq!(lines[2], "\t}");
    }

    /// Test no trailing newline in input
    #[test]
    fn test_apply_fix_to_content_no_trailing_newline() {
        let content = "line1\nline2\nline3";  // No \n at end
        let result = apply_fix_to_content(content, "line2", "LINE2", 2);
        assert!(result.is_ok());
        let updated = result.unwrap();
        let lines: Vec<&str> = updated.lines().collect();
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[1], "LINE2");
        // Note: .join("\n") does NOT add trailing newline
    }

    /// Test trailing newline in input (gets stripped by .lines())
    #[test]
    fn test_apply_fix_to_content_trailing_newline() {
        let content = "line1\nline2\nline3\n";  // Trailing \n
        let result = apply_fix_to_content(content, "line2", "LINE2", 2);
        assert!(result.is_ok());
        let updated = result.unwrap();
        let lines: Vec<&str> = updated.lines().collect();
        // .lines() strips trailing newline, so we get 3 lines not 4
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[1], "LINE2");
        // Output has NO trailing newline (.join doesn't add it)
        assert!(!updated.ends_with('\n'));
    }

    /// Test multiple trailing newlines
    #[test]
    fn test_apply_fix_to_content_multiple_trailing_newlines() {
        let content = "line1\nline2\n\n\n";  // Multiple trailing newlines
        let result = apply_fix_to_content(content, "line1", "LINE1", 1);
        assert!(result.is_ok());
        let updated = result.unwrap();
        let lines: Vec<&str> = updated.lines().collect();
        // .lines() keeps empty strings from intermediate newlines but strips final ones
        assert_eq!(lines.len(), 3);  // "line1", "line2", "" - only last trailing \n\n stripped
        assert_eq!(lines[0], "LINE1");
        assert_eq!(lines[1], "line2");
        assert_eq!(lines[2], "");  // One empty line from \n\n
    }

    /// Test whitespace-only lines
    #[test]
    fn test_apply_fix_to_content_whitespace_lines() {
        let content = "code\n   \t\nmore code";
        let result = apply_fix_to_content(content, "code", "CODE", 1);
        assert!(result.is_ok());
        let updated = result.unwrap();
        let lines: Vec<&str> = updated.lines().collect();
        assert_eq!(lines[0], "CODE");
        assert_eq!(lines[1], "   \t");  // Whitespace preserved
        assert_eq!(lines[2], "more code");
    }

    /// Test original code is entire line
    #[test]
    fn test_apply_fix_to_content_full_line_replacement() {
        let content = "old_function()";
        let result = apply_fix_to_content(content, "old_function()", "new_function()", 1);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "new_function()");
    }

    /// Test original code is substring at start of line
    #[test]
    fn test_apply_fix_to_content_substring_start() {
        let content = "password = get_password()";
        let result = apply_fix_to_content(content, "password", "secret", 1);
        assert!(result.is_ok());
        // .replace() replaces ALL occurrences on the line
        assert_eq!(result.unwrap(), "secret = get_secret()");
    }

    /// Test original code is substring at end of line
    #[test]
    fn test_apply_fix_to_content_substring_end() {
        let content = "return get_password()";
        let result = apply_fix_to_content(content, "get_password()", "get_secret()", 1);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "return get_secret()");
    }

    /// Test original code is substring in middle of line
    #[test]
    fn test_apply_fix_to_content_substring_middle() {
        let content = "const value = old_value + 1;";
        let result = apply_fix_to_content(content, "old_value", "new_value", 1);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "const value = new_value + 1;");
    }

    /// Test very long line (>1000 characters)
    #[test]
    fn test_apply_fix_to_content_long_line() {
        let long_line = "x".repeat(1000) + " secret " + &"y".repeat(1000);
        let result = apply_fix_to_content(&long_line, "secret", "REDACTED", 1);
        assert!(result.is_ok());
        let updated = result.unwrap();
        assert!(updated.contains("REDACTED"));
        assert!(!updated.contains("secret"));
    }

    /// Test case sensitivity
    #[test]
    fn test_apply_fix_to_content_case_sensitive() {
        let content = "Password = 'secret'";
        let result = apply_fix_to_content(content, "password", "secret", 1);
        // .contains() is case-sensitive, so this should fail
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Original code not found"));
    }

    /// Test with line that only contains whitespace and target code
    #[test]
    fn test_apply_fix_to_content_whitespace_and_code() {
        let content = "  password  ";
        let result = apply_fix_to_content(content, "password", "secret", 1);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "  secret  ");
    }

    /// Test replacing code that appears on different lines (only target line modified)
    #[test]
    fn test_apply_fix_to_content_multi_line_same_code() {
        let content = "function foo() {\n  return 42;\n}\nfunction bar() {\n  return 42;\n}";
        // Replace "return 42" only on line 2
        let result = apply_fix_to_content(content, "return 42", "return 100", 2);
        assert!(result.is_ok());
        let updated = result.unwrap();
        let lines: Vec<&str> = updated.lines().collect();
        assert_eq!(lines[1], "  return 100;");
        assert_eq!(lines[4], "  return 42;");  // Line 5 unchanged
    }

    /// Test with file containing only newlines
    #[test]
    fn test_apply_fix_to_content_only_newlines() {
        let content = "\n\n\n";
        // This creates 3 empty lines
        let result = apply_fix_to_content(content, "", "code", 1);
        // Empty string is found on every line
        assert!(result.is_ok());
    }

    /// Test line number exactly at boundary (last valid line)
    #[test]
    fn test_apply_fix_to_content_boundary_last_line() {
        let content = "line1\nline2\nline3";
        let result = apply_fix_to_content(content, "line3", "LINE3", 3);
        assert!(result.is_ok());
        let updated = result.unwrap();
        let lines: Vec<&str> = updated.lines().collect();
        assert_eq!(lines[2], "LINE3");
    }

    /// Test line number just past boundary
    #[test]
    fn test_apply_fix_to_content_boundary_past_last() {
        let content = "line1\nline2\nline3";
        let result = apply_fix_to_content(content, "line", "LINE", 4);  // File has 3 lines
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("out of range"));
    }

    /// Test negative line number (will saturate to 0, then access first line)
    #[test]
    fn test_apply_fix_to_content_negative_line() {
        let content = "first\nsecond";
        // Negative i64 cast to usize behavior is platform-dependent,
        // but saturating_sub(1) on 0 gives 0 (first line)
        let result = apply_fix_to_content(content, "first", "FIRST", -1);
        // Behavior depends on how negative is cast to usize
        // On most platforms, large negative becomes huge positive (out of range)
        // Let's just verify it doesn't crash
        let _ = result;  // Either error or success is acceptable
    }

    /// Test input validation: reject newline in original_code
    #[test]
    fn test_apply_fix_to_content_newline_in_original() {
        let content = "line1\nline2\nline3\n";
        let result = apply_fix_to_content(content, "line1\nline2", "BOTH", 1);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("Invalid original_code"));
        assert!(err.contains("newline"));
        assert!(err.contains("single lines only"));
    }

    /// Test input validation: reject newline in fixed_code
    #[test]
    fn test_apply_fix_to_content_newline_in_fixed() {
        let content = "password = \"secret\"\n";
        // Use actual newline character (not escaped \\n)
        let fixed_with_newline = "\"foo\nbar\"";
        let result = apply_fix_to_content(content, "\"secret\"", fixed_with_newline, 1);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("Invalid fixed_code"));
        assert!(err.contains("newline"));
        assert!(err.contains("single lines only"));
    }
}
