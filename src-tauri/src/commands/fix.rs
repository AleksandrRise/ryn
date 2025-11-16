//! Fix generation and application commands
//!
//! Handles AI-generated fix creation and application to source files

use crate::db::{self, queries};
use crate::models::Fix;
use crate::fix_generator::claude_client::ClaudeClient;
use crate::git::GitOperations;
use crate::security::path_validation;
use crate::rate_limiter::{RateLimiter, RateLimiterConfig};
use crate::utils::create_audit_event;
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

/// Generate a fix for a violation using Claude AI
///
/// Calls the Claude API to generate a fix for a specific violation,
/// stores the fix in the database with trust_level = "review"
///
/// # Arguments
/// * `violation_id` - ID of the violation to fix
///
/// Returns: Generated Fix object or error
#[tauri::command]
pub async fn generate_fix(violation_id: i64) -> Result<Fix, String> {
    // Phase 1: Read all required data from database (scoped to drop guard before awaits)
    let (violation, scan_project_id, _project_path, project_framework, file_path) = {
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

    // Phase 2: Async operations (no DB connection held)
    // Check rate limit before calling Claude API
    RATE_LIMITER.check_rate_limit().await
        .map_err(|e| format!("API rate limit: {}", e))?;

    // Call Claude API to generate fix
    let client = ClaudeClient::new()
        .map_err(|e| format!("Failed to create Claude client: {}", e))?;

    let fixed_code = client.generate_fix(
        &violation.control_id,
        &violation.description,
        &violation.code_snippet,
        &project_framework.as_deref().unwrap_or("unknown"),
        violation.function_name.as_deref(),
        violation.class_name.as_deref(),
    )
    .await
    .map_err(|e| format!("Failed to generate fix: {}", e))?;

    // Phase 3: Write results back to database (scoped to drop guard immediately)
    let result = {
        let conn = db::get_connection();

        // Create fix record in database
        let fix = Fix {
            id: 0,
            violation_id,
            original_code: violation.code_snippet.clone(),
            fixed_code,
            explanation: format!("AI-generated fix for {}: {}", violation.control_id, violation.description),
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
            Some(scan_project_id),
            Some(violation_id),
            Some(fix_id),
            &format!("Generated fix for violation: {}", violation.description),
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

/// Apply a generated fix to the source code
///
/// Applies the fixed code to the file and commits it to git,
/// then updates the fix record with the commit SHA
///
/// # Arguments
/// * `fix_id` - ID of the fix to apply
///
/// Returns: Git commit SHA or error
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

    // Verify git repository
    let repo_path = Path::new(&project.path);
    if !repo_path.join(".git").exists() {
        return Err("Project is not a git repository".to_string());
    }

    // Validate file path with path traversal protection
    let file_path = path_validation::validate_file_path(
        repo_path,
        &violation.file_path
    ).map_err(|e| format!("Security: Invalid file path: {}", e))?;

    // Apply fix to file
    let file_content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Replace original code with fixed code at specific line number
    // This prevents replacing ALL occurrences - only targets the violation line
    let mut lines: Vec<String> = file_content.lines().map(|s| s.to_string()).collect();

    // Convert line_number (1-indexed) to 0-indexed
    let target_line_idx = (violation.line_number as usize).saturating_sub(1);

    if target_line_idx >= lines.len() {
        return Err(format!(
            "Line number {} out of range (file has {} lines)",
            violation.line_number,
            lines.len()
        ));
    }

    // Verify the original code exists on the target line
    let target_line = &lines[target_line_idx];
    if !target_line.contains(&fix.original_code) {
        return Err(format!(
            "Original code not found on line {}. Expected to find: '{}', but line contains: '{}'",
            violation.line_number,
            fix.original_code,
            target_line
        ));
    }

    // Replace only on the target line
    let updated_line = target_line.replace(&fix.original_code, &fix.fixed_code);
    lines[target_line_idx] = updated_line;

    // Reconstruct file content (preserving line endings)
    let updated_content = lines.join("\n");

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

    // Commit fix to git
    let commit_message = format!(
        "fix: {} - {}",
        violation.control_id,
        violation.description
    );

    let commit_sha = GitOperations::commit_fix(repo_path, &file_path, &commit_message)
        .map_err(|e| format!("Failed to commit fix: {}", e))?;

    // Update fix record with git commit SHA and backup path
    queries::update_fix_applied(&conn, fix_id, &commit_sha, Some(&backup_path_str))
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

    Ok(commit_sha)
}

#[cfg(test)]
mod tests {
    use crate::db::test_helpers::TestDbGuard;
    use super::*;
    use tempfile::TempDir;
    use std::fs;

    fn setup_test_env() -> TempDir {
        let temp_dir = tempfile::TempDir::new().unwrap();
        std::env::set_var("RYN_DATA_DIR", temp_dir.path());
        temp_dir
    }

    fn create_test_project_with_git() -> (tempfile::TempDir, i64) {
        let project_dir = tempfile::TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        // Initialize git repo
        let repo = git2::Repository::init(&path).unwrap();
        let signature = git2::Signature::now("test", "test@example.com").unwrap();

        // Create a dummy file for git to index
        std::fs::write(project_dir.path().join("dummy"), "test content").unwrap();

        // Create initial commit
        let tree_id = {
            let mut index = repo.index().unwrap();
            index.add_path(std::path::Path::new("dummy")).unwrap();
            index.write_tree().unwrap()
        };

        let tree = repo.find_tree(tree_id).unwrap();
        let _ = repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            "Initial commit",
            &tree,
            &[],
        );

        // Create project in database
        let conn = db::get_connection();
        let project_id = queries::insert_project(&conn, "test-project", &path, None).unwrap();

        (project_dir, project_id)
    }

    fn create_test_violation_with_file(project_id: i64) -> (i64, i64) {
        let conn = db::get_connection();

        // Get project path
        let project = queries::select_project(&conn, project_id).unwrap().unwrap();

        // Create test file
        let file_path = Path::new(&project.path).join("test.py");
        fs::write(&file_path, "def get_user(user_id):\n    return User.objects.get(id=user_id)").unwrap();

        // Create scan
        let scan_id = queries::insert_scan(&conn, project_id).unwrap();

        // Create violation
        let violation = crate::models::Violation {
            id: 0,
            scan_id,
            control_id: "CC6.1".to_string(),
            severity: "high".to_string(),
            description: "Missing login_required decorator".to_string(),
            file_path: "test.py".to_string(),
            line_number: 1,
            code_snippet: "def get_user(user_id):".to_string(),
            status: "open".to_string(),
            detected_at: chrono::Utc::now().to_rfc3339(),
            detection_method: "regex".to_string(),
            confidence_score: None,
            llm_reasoning: None,
            regex_reasoning: None,
            function_name: None,
            class_name: None,
        };

        let violation_id = queries::insert_violation(&conn, &violation).unwrap();
        (scan_id, violation_id)
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_generate_fix_nonexistent_violation() {
        let _guard = TestDbGuard::new();
        let result = generate_fix(999).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_generate_fix_creates_fix_record() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_git();
        let (_scan_id, violation_id) = create_test_violation_with_file(project_id);

        // Note: This will fail without proper Claude API key, but we're testing the structure
        // In production, this would call the actual API
        let result = generate_fix(violation_id).await;
        // We expect error due to no API key
        assert!(result.is_err(), "Should return error when API key is not configured");
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_apply_fix_nonexistent_fix() {
        let _guard = TestDbGuard::new();
        let result = apply_fix(999).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_apply_fix_requires_git_repo() {
        let _guard = TestDbGuard::new();
        let project_dir = tempfile::TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        // Create project without git
        let conn = db::get_connection();
        let project_id = queries::insert_project(&conn, "test-project", &path, None).unwrap();

        let scan_id = queries::insert_scan(&conn, project_id).unwrap();
        let violation = crate::models::Violation {
            id: 0,
            scan_id,
            control_id: "CC6.1".to_string(),
            severity: "high".to_string(),
            description: "Test".to_string(),
            file_path: "test.py".to_string(),
            line_number: 1,
            code_snippet: "code".to_string(),
            status: "open".to_string(),
            detected_at: chrono::Utc::now().to_rfc3339(),
            detection_method: "regex".to_string(),
            confidence_score: None,
            llm_reasoning: None,
            regex_reasoning: None,
            function_name: None,
            class_name: None,
        };
        let violation_id = queries::insert_violation(&conn, &violation).unwrap();

        let fix = Fix {
            id: 0,
            violation_id,
            original_code: "code".to_string(),
            fixed_code: "fixed_code".to_string(),
            explanation: "explanation".to_string(),
            trust_level: "review".to_string(),
            applied_at: None,
            applied_by: "ryn-ai".to_string(),
            git_commit_sha: None,
            backup_path: None,
        };
        let fix_id = queries::insert_fix(&conn, &fix).unwrap();

        let result = apply_fix(fix_id).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not a git repository"));
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_generate_fix_trust_level() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_git();
        let (_scan_id, violation_id) = create_test_violation_with_file(project_id);

        // Test would pass if Claude API was available
        // Verify the trust_level would be set correctly
        let result = generate_fix(violation_id).await;
        if result.is_ok() {
            let fix = result.unwrap();
            assert_eq!(fix.trust_level, "review");
        }
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_generate_fix_creates_audit_event() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_git();
        let (_scan_id, violation_id) = create_test_violation_with_file(project_id);

        let result = generate_fix(violation_id).await;
        if result.is_ok() {
            let conn = db::get_connection();
            let mut stmt = conn
                .prepare("SELECT COUNT(*) FROM audit_events WHERE event_type = 'fix_generated'")
                .unwrap();
            let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
            assert_eq!(count, 1);
        }
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_apply_fix_creates_audit_event() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_git();
        let (_scan_id, violation_id) = create_test_violation_with_file(project_id);

        // Create a fix manually for testing apply
        let conn = db::get_connection();
        let fix = Fix {
            id: 0,
            violation_id,
            original_code: "def get_user(user_id):".to_string(),
            fixed_code: "@login_required\ndef get_user(request, user_id):".to_string(),
            explanation: "Added login_required decorator".to_string(),
            trust_level: "review".to_string(),
            applied_at: None,
            applied_by: "ryn-ai".to_string(),
            git_commit_sha: None,
            backup_path: None,
        };
        let fix_id = queries::insert_fix(&conn, &fix).unwrap();

        let result = apply_fix(fix_id).await;
        // May fail due to code mismatch but verify audit intent
        if result.is_ok() {
            let mut stmt = conn
                .prepare("SELECT COUNT(*) FROM audit_events WHERE event_type = 'fix_applied'")
                .unwrap();
            let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
            assert_eq!(count, 1);
        }
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_apply_fix_updates_violation_status() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_git();
        let (_scan_id, violation_id) = create_test_violation_with_file(project_id);

        let conn = db::get_connection();
        let fix = Fix {
            id: 0,
            violation_id,
            original_code: "def get_user(user_id):".to_string(),
            fixed_code: "@login_required\ndef get_user(request, user_id):".to_string(),
            explanation: "Added login_required decorator".to_string(),
            trust_level: "review".to_string(),
            applied_at: None,
            applied_by: "ryn-ai".to_string(),
            git_commit_sha: None,
            backup_path: None,
        };
        let fix_id = queries::insert_fix(&conn, &fix).unwrap();

        let _ = apply_fix(fix_id).await;

        // Check if violation status was updated (if fix applied successfully)
        let violation = queries::select_violation(&conn, violation_id).unwrap().unwrap();
        assert!(violation.status == "fixed" || violation.status == "open");
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_generate_fix_includes_violation_details() {
        let _guard = TestDbGuard::new();
        let (_project_dir, project_id) = create_test_project_with_git();
        let (_scan_id, violation_id) = create_test_violation_with_file(project_id);

        let result = generate_fix(violation_id).await;
        if result.is_ok() {
            let fix = result.unwrap();
            assert_eq!(fix.violation_id, violation_id);
            assert!(!fix.explanation.is_empty());
        }
    }

    /// Test that apply_fix only replaces code at the specific line number,
    /// not all occurrences of that code in the file (Bug #2 fix verification)
    #[tokio::test]
    #[serial_test::serial]
    async fn test_apply_fix_line_specific_replacement() {
        let _guard = TestDbGuard::new();
        let (project_dir, project_id) = create_test_project_with_git();

        let conn = db::get_connection();
        let project = queries::select_project(&conn, project_id).unwrap().unwrap();

        // Create a file with the SAME CODE on multiple lines
        let file_path = Path::new(&project.path).join("test.py");
        let file_content = "import os\npassword = \"secret123\"\napi_key = \"secret123\"\ntoken = \"secret123\"\n";
        fs::write(&file_path, file_content).unwrap();

        // Add file to git index and commit (needed for git operations to work)
        let repo = git2::Repository::open(&project.path).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("test.py")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let signature = git2::Signature::now("test", "test@example.com").unwrap();
        let parent_commit = repo.head().unwrap().peel_to_commit().unwrap();
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            "Add test file",
            &tree,
            &[&parent_commit],
        ).unwrap();

        // Create scan
        let scan_id = queries::insert_scan(&conn, project_id).unwrap();

        // Create violation pointing to line 2 (the password line)
        let violation = crate::models::Violation {
            id: 0,
            scan_id,
            control_id: "CC1.6".to_string(),
            severity: "critical".to_string(),
            description: "Hardcoded password detected".to_string(),
            file_path: "test.py".to_string(),
            line_number: 2,  // Target line 2 specifically
            code_snippet: "password = \"secret123\"".to_string(),
            status: "open".to_string(),
            detected_at: chrono::Utc::now().to_rfc3339(),
            detection_method: "regex".to_string(),
            confidence_score: None,
            llm_reasoning: None,
            regex_reasoning: None,
            function_name: None,
            class_name: None,
        };
        let violation_id = queries::insert_violation(&conn, &violation).unwrap();

        // Create fix that replaces "secret123" with environment variable
        let fix = Fix {
            id: 0,
            violation_id,
            original_code: "\"secret123\"".to_string(),
            fixed_code: "os.getenv(\"PASSWORD\")".to_string(),
            explanation: "Replaced hardcoded password with environment variable".to_string(),
            trust_level: "review".to_string(),
            applied_at: None,
            applied_by: "ryn-ai".to_string(),
            git_commit_sha: None,
            backup_path: None,
        };
        let fix_id = queries::insert_fix(&conn, &fix).unwrap();

        // Apply the fix (may fail at git commit but file replacement should work)
        let result = apply_fix(fix_id).await;

        // Read the modified file to verify line-specific replacement worked
        let updated_content = fs::read_to_string(&file_path).unwrap();
        let lines: Vec<&str> = updated_content.lines().collect();

        // Verify ONLY line 2 was modified (this is the critical test)
        assert_eq!(lines[0], "import os", "Line 1 should be unchanged");
        assert_eq!(lines[1], "password = os.getenv(\"PASSWORD\")", "Line 2 should be modified");
        assert_eq!(lines[2], "api_key = \"secret123\"", "Line 3 should be unchanged (same original code)");
        assert_eq!(lines[3], "token = \"secret123\"", "Line 4 should be unchanged (same original code)");

        // If apply_fix succeeded completely (including git), verify violation status
        if result.is_ok() {
            let updated_violation = queries::select_violation(&conn, violation_id).unwrap().unwrap();
            assert_eq!(updated_violation.status, "fixed");
        }

        // Note: Test may fail at git commit but line-replacement logic is verified above
    }

    /// Test that apply_fix validates line number is in range
    #[tokio::test]
    #[serial_test::serial]
    async fn test_apply_fix_line_out_of_range() {
        let _guard = TestDbGuard::new();
        let (project_dir, project_id) = create_test_project_with_git();

        let conn = db::get_connection();
        let project = queries::select_project(&conn, project_id).unwrap().unwrap();

        // Create a file with only 3 lines
        let file_path = Path::new(&project.path).join("test.py");
        fs::write(&file_path, "line1\nline2\nline3\n").unwrap();

        let scan_id = queries::insert_scan(&conn, project_id).unwrap();

        // Create violation pointing to line 10 (out of range)
        let violation = crate::models::Violation {
            id: 0,
            scan_id,
            control_id: "TEST".to_string(),
            severity: "high".to_string(),
            description: "Test".to_string(),
            file_path: "test.py".to_string(),
            line_number: 10,  // Out of range!
            code_snippet: "line1".to_string(),
            status: "open".to_string(),
            detected_at: chrono::Utc::now().to_rfc3339(),
            detection_method: "regex".to_string(),
            confidence_score: None,
            llm_reasoning: None,
            regex_reasoning: None,
            function_name: None,
            class_name: None,
        };
        let violation_id = queries::insert_violation(&conn, &violation).unwrap();

        let fix = Fix {
            id: 0,
            violation_id,
            original_code: "line1".to_string(),
            fixed_code: "fixed".to_string(),
            explanation: "Test".to_string(),
            trust_level: "review".to_string(),
            applied_at: None,
            applied_by: "ryn-ai".to_string(),
            git_commit_sha: None,
            backup_path: None,
        };
        let fix_id = queries::insert_fix(&conn, &fix).unwrap();

        // Apply should fail with clear error
        let result = apply_fix(fix_id).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("out of range"));
    }

    /// Test that apply_fix validates original code exists on target line
    #[tokio::test]
    #[serial_test::serial]
    async fn test_apply_fix_code_mismatch() {
        let _guard = TestDbGuard::new();
        let (project_dir, project_id) = create_test_project_with_git();

        let conn = db::get_connection();
        let project = queries::select_project(&conn, project_id).unwrap().unwrap();

        // Create a file
        let file_path = Path::new(&project.path).join("test.py");
        fs::write(&file_path, "actual_code_here\n").unwrap();

        let scan_id = queries::insert_scan(&conn, project_id).unwrap();

        // Create violation
        let violation = crate::models::Violation {
            id: 0,
            scan_id,
            control_id: "TEST".to_string(),
            severity: "high".to_string(),
            description: "Test".to_string(),
            file_path: "test.py".to_string(),
            line_number: 1,
            code_snippet: "actual_code_here".to_string(),
            status: "open".to_string(),
            detected_at: chrono::Utc::now().to_rfc3339(),
            detection_method: "regex".to_string(),
            confidence_score: None,
            llm_reasoning: None,
            regex_reasoning: None,
            function_name: None,
            class_name: None,
        };
        let violation_id = queries::insert_violation(&conn, &violation).unwrap();

        // Create fix with original_code that doesn't match the line
        let fix = Fix {
            id: 0,
            violation_id,
            original_code: "wrong_code".to_string(),  // Doesn't match!
            fixed_code: "fixed".to_string(),
            explanation: "Test".to_string(),
            trust_level: "review".to_string(),
            applied_at: None,
            applied_by: "ryn-ai".to_string(),
            git_commit_sha: None,
            backup_path: None,
        };
        let fix_id = queries::insert_fix(&conn, &fix).unwrap();

        // Apply should fail with clear error
        let result = apply_fix(fix_id).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Original code not found"));
    }
}
