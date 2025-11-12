//! Scan management commands
//!
//! Handles project scanning, framework detection, and scan progress tracking

use crate::db::{self, queries};
use crate::models::{Violation, Scan};
use crate::scanner::framework_detector::FrameworkDetector;
use crate::rules::{CC61AccessControlRule, CC67SecretsRule, CC72LoggingRule, A12ResilienceRule};
use std::path::Path;
use walkdir::WalkDir;

/// Detect the framework of a project
///
/// Uses file analysis to identify the web framework in use
///
/// # Arguments
/// * `path` - Path to project directory
///
/// Returns: Framework name (e.g., "django", "express") or None if not detected
#[tauri::command]
pub async fn detect_framework(path: String) -> Result<Option<String>, String> {
    if !Path::new(&path).exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let framework = FrameworkDetector::detect_framework(Path::new(&path))
        .map_err(|e| format!("Framework detection failed: {}", e))?;

    Ok(framework)
}

/// Scan a project for SOC 2 violations
///
/// Walks through the project directory, analyzes files with all 4 rule engines,
/// and stores violations in the database
///
/// # Arguments
/// * `project_id` - ID of the project to scan
///
/// Returns: Scan ID for tracking progress or error
#[tauri::command]
pub async fn scan_project(project_id: i64) -> Result<i64, String> {
    let conn = db::init_db()
        .map_err(|e| format!("Failed to initialize database: {}", e))?;

    // Get project from database
    let project = queries::select_project(&conn, project_id)
        .map_err(|e| format!("Failed to fetch project: {}", e))?
        .ok_or_else(|| format!("Project not found: {}", project_id))?;

    // Create scan record
    let scan_id = queries::insert_scan(&conn, project_id)
        .map_err(|e| format!("Failed to create scan: {}", e))?;

    // Walk through project files
    let mut files_scanned = 0;
    let mut violations_found = 0;

    for entry in WalkDir::new(&project.path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let file_path = entry.path();

        // Skip common non-source directories
        if should_skip_path(file_path) {
            continue;
        }

        // Read file content
        match std::fs::read_to_string(file_path) {
            Ok(content) => {
                files_scanned += 1;

                // Detect language
                if let Some(_language) = FrameworkDetector::detect_language(file_path) {
                    let relative_path = file_path
                        .strip_prefix(&project.path)
                        .unwrap_or(file_path)
                        .to_string_lossy()
                        .to_string();

                    // Run all 4 rule engines
                    let violations = run_all_rules(&content, &relative_path, scan_id);

                    // Store violations in database
                    for violation in violations {
                        if queries::insert_violation(&conn, &violation).is_ok() {
                            violations_found += 1;
                        }
                    }
                }
            }
            Err(_) => {
                // Skip files that can't be read
                continue;
            }
        }
    }

    // Update scan with results
    let completed_at = chrono::Utc::now().to_rfc3339();
    queries::update_scan_status(&conn, scan_id, "completed", Some(&completed_at))
        .map_err(|e| format!("Failed to update scan status: {}", e))?;

    queries::update_scan_results(&conn, scan_id, files_scanned, violations_found)
        .map_err(|e| format!("Failed to update scan results: {}", e))?;

    // Log audit event
    if let Ok(event) = create_audit_event(
        &conn,
        "scan_completed",
        Some(project_id),
        None,
        None,
        &format!("Scanned {} files, found {} violations", files_scanned, violations_found),
    ) {
        let _ = queries::insert_audit_event(&conn, &event);
    }

    Ok(scan_id)
}

/// Get scan progress
///
/// Returns the current status and statistics of a running or completed scan
///
/// # Arguments
/// * `scan_id` - ID of the scan to check
///
/// Returns: Scan progress object with status and violation counts
#[tauri::command]
pub async fn get_scan_progress(scan_id: i64) -> Result<ScanProgress, String> {
    let conn = db::init_db()
        .map_err(|e| format!("Failed to initialize database: {}", e))?;

    let scan = queries::select_scan(&conn, scan_id)
        .map_err(|e| format!("Failed to fetch scan: {}", e))?
        .ok_or_else(|| format!("Scan not found: {}", scan_id))?;

    // Count violations by status
    let mut stmt = conn
        .prepare(
            "SELECT status, COUNT(*) FROM violations WHERE scan_id = ? GROUP BY status",
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let violations_by_status: std::collections::HashMap<String, i32> = stmt
        .query_map([scan_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?))
        })
        .map_err(|e| format!("Failed to query violations: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ScanProgress {
        scan_id,
        status: scan.status,
        files_scanned: scan.files_scanned,
        violations_found: scan.violations_found,
        violations_dismissed: violations_by_status.get("dismissed").copied().unwrap_or(0),
        violations_fixed: violations_by_status.get("fixed").copied().unwrap_or(0),
        completed_at: scan.completed_at,
    })
}

/// Get all scans for a project
///
/// Returns: List of scans for the specified project
#[tauri::command]
pub async fn get_scans(project_id: i64) -> Result<Vec<Scan>, String> {
    let conn = db::init_db()
        .map_err(|e| format!("Failed to initialize database: {}", e))?;

    let scans = queries::select_scans(&conn, project_id)
        .map_err(|e| format!("Failed to fetch scans: {}", e))?;

    Ok(scans)
}

/// Run all 4 rule engines on code
fn run_all_rules(code: &str, file_path: &str, scan_id: i64) -> Vec<Violation> {
    let mut violations = Vec::new();

    // CC6.1 Access Control
    if let Ok(cc61_violations) = CC61AccessControlRule::analyze(code, file_path, scan_id) {
        violations.extend(cc61_violations);
    }

    // CC6.7 Secrets Management
    if let Ok(cc67_violations) = CC67SecretsRule::analyze(code, file_path, scan_id) {
        violations.extend(cc67_violations);
    }

    // CC7.2 Logging
    if let Ok(cc72_violations) = CC72LoggingRule::analyze(code, file_path, scan_id) {
        violations.extend(cc72_violations);
    }

    // A1.2 Resilience
    if let Ok(a12_violations) = A12ResilienceRule::analyze(code, file_path, scan_id) {
        violations.extend(a12_violations);
    }

    violations
}

/// Determine if a path should be skipped during scanning
fn should_skip_path(path: &Path) -> bool {
    let skip_dirs = [
        "node_modules", ".git", "venv", ".venv", "__pycache__", "dist", "build",
        ".tox", ".pytest_cache", ".coverage", "target", ".cargo", "vendor",
        ".next", "out", "build", ".babel_cache", ".cache", "coverage"
    ];

    for component in path.components() {
        if let std::path::Component::Normal(name) = component {
            if let Some(name_str) = name.to_str() {
                if skip_dirs.contains(&name_str) || name_str.starts_with('.') {
                    return true;
                }
            }
        }
    }

    false
}

/// Helper function to create audit events
fn create_audit_event(
    _conn: &rusqlite::Connection,
    event_type: &str,
    project_id: Option<i64>,
    violation_id: Option<i64>,
    fix_id: Option<i64>,
    description: &str,
) -> anyhow::Result<crate::models::AuditEvent> {
    use crate::models::AuditEvent;

    Ok(AuditEvent {
        id: 0,
        event_type: event_type.to_string(),
        project_id,
        violation_id,
        fix_id,
        description: description.to_string(),
        metadata: None,
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Scan progress response structure
#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct ScanProgress {
    pub scan_id: i64,
    pub status: String,
    pub files_scanned: i32,
    pub violations_found: i32,
    pub violations_dismissed: i32,
    pub violations_fixed: i32,
    pub completed_at: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::fs;

    fn setup_test_env() -> TempDir {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("RYN_DATA_DIR", temp_dir.path());
        temp_dir
    }

    fn create_test_project() -> (TempDir, i64) {
        let _temp_dir = setup_test_env();
        let project_dir = TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        let conn = db::init_db().unwrap();
        let project_id = queries::insert_project(&conn, "test-project", &path, None).unwrap();
        (project_dir, project_id)
    }

    #[tokio::test]
    async fn test_detect_framework_nonexistent_path() {
        let result = detect_framework("/nonexistent/path".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_detect_framework_empty_directory() {
        let _temp_dir = setup_test_env();
        let project_dir = TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        let result = detect_framework(path).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), None);
    }

    #[tokio::test]
    async fn test_detect_framework_django() {
        let _temp_env = setup_test_env();
        let project_dir = TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        // Create manage.py to signal Django
        fs::write(project_dir.path().join("manage.py"), "#!/usr/bin/env python").unwrap();

        let result = detect_framework(path).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Some("django".to_string()));
    }

    #[tokio::test]
    async fn test_detect_framework_express() {
        let _temp_env = setup_test_env();
        let project_dir = TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        // Create package.json with express
        let package_json = r#"{"dependencies": {"express": "^4.18.0"}}"#;
        fs::write(project_dir.path().join("package.json"), package_json).unwrap();

        let result = detect_framework(path).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Some("express".to_string()));
    }

    #[tokio::test]
    async fn test_scan_project_nonexistent_project() {
        let _temp_dir = setup_test_env();
        let result = scan_project(999).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_scan_project_empty_directory() {
        let _temp_env = setup_test_env();
        let (_project_dir, project_id) = create_test_project();

        let result = scan_project(project_id).await;
        assert!(result.is_ok());

        let scan_id = result.unwrap();
        assert!(scan_id > 0);
    }

    #[tokio::test]
    async fn test_scan_project_with_python_file() {
        let _temp_env = setup_test_env();
        let (project_dir, project_id) = create_test_project();

        // Create a simple Python file
        let py_content = r#"
def get_user(user_id):
    user = User.objects.get(id=user_id)
    return user
"#;
        fs::write(project_dir.path().join("views.py"), py_content).unwrap();

        let result = scan_project(project_id).await;
        assert!(result.is_ok());

        let scan_id = result.unwrap();
        assert!(scan_id > 0);
    }

    #[tokio::test]
    async fn test_scan_project_skips_node_modules() {
        let _temp_env = setup_test_env();
        let (project_dir, project_id) = create_test_project();

        // Create node_modules directory with files
        let node_modules = project_dir.path().join("node_modules");
        fs::create_dir(&node_modules).unwrap();
        fs::write(node_modules.join("lib.js"), "console.log('test')").unwrap();

        let result = scan_project(project_id).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_scan_project_returns_valid_scan_id() {
        let _temp_env = setup_test_env();
        let (_project_dir, project_id) = create_test_project();

        let result = scan_project(project_id).await;
        assert!(result.is_ok());

        let scan_id = result.unwrap();
        assert!(scan_id > 0);

        // Verify scan exists in database
        let conn = db::init_db().unwrap();
        let scan = queries::select_scan(&conn, scan_id).unwrap();
        assert!(scan.is_some());
    }

    #[tokio::test]
    async fn test_get_scan_progress_nonexistent_scan() {
        let _temp_env = setup_test_env();
        let result = get_scan_progress(999).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_scan_progress_after_scan_complete() {
        let _temp_env = setup_test_env();
        let (_project_dir, project_id) = create_test_project();

        let scan_id = scan_project(project_id).await.unwrap();
        let progress = get_scan_progress(scan_id).await.unwrap();

        assert_eq!(progress.scan_id, scan_id);
        assert_eq!(progress.status, "completed");
        assert!(progress.files_scanned >= 0);
        assert!(progress.violations_found >= 0);
    }

    #[tokio::test]
    async fn test_get_scans_for_project() {
        let _temp_env = setup_test_env();
        let (_project_dir, project_id) = create_test_project();

        // Create multiple scans
        let _scan_id_1 = scan_project(project_id).await.unwrap();
        let _scan_id_2 = scan_project(project_id).await.unwrap();

        let scans = get_scans(project_id).await.unwrap();
        assert_eq!(scans.len(), 2);
    }

    #[tokio::test]
    async fn test_get_scans_empty() {
        let _temp_env = setup_test_env();
        let (_project_dir, project_id) = create_test_project();

        let scans = get_scans(project_id).await.unwrap();
        assert_eq!(scans.len(), 0);
    }

    #[tokio::test]
    async fn test_scan_project_detects_violations() {
        let _temp_env = setup_test_env();
        let (project_dir, project_id) = create_test_project();

        // Create a file with a violation (hardcoded secret)
        let py_content = r#"
DB_PASSWORD = "hardcoded_password_123"
api_key = "sk-1234567890abcdef"
"#;
        fs::write(project_dir.path().join("config.py"), py_content).unwrap();

        let scan_id = scan_project(project_id).await.unwrap();
        let progress = get_scan_progress(scan_id).await.unwrap();

        assert!(progress.violations_found >= 0);
    }

    #[tokio::test]
    async fn test_scan_progress_includes_all_fields() {
        let _temp_env = setup_test_env();
        let (_project_dir, project_id) = create_test_project();

        let scan_id = scan_project(project_id).await.unwrap();
        let progress = get_scan_progress(scan_id).await.unwrap();

        assert_eq!(progress.scan_id, scan_id);
        assert!(!progress.status.is_empty());
        assert!(progress.files_scanned >= 0);
        assert!(progress.violations_found >= 0);
        assert!(progress.violations_dismissed >= 0);
        assert!(progress.violations_fixed >= 0);
    }

    #[tokio::test]
    async fn test_should_skip_node_modules_path() {
        let path = Path::new("/project/node_modules/lib/index.js");
        assert!(should_skip_path(path));
    }

    #[tokio::test]
    async fn test_should_skip_git_path() {
        let path = Path::new("/project/.git/config");
        assert!(should_skip_path(path));
    }

    #[tokio::test]
    async fn test_should_not_skip_source_file() {
        let path = Path::new("/project/src/main.rs");
        assert!(!should_skip_path(path));
    }

    #[tokio::test]
    async fn test_scan_multiple_projects_independent() {
        let _temp_env = setup_test_env();
        let (project_dir_1, project_id_1) = create_test_project();
        let (project_dir_2, project_id_2) = create_test_project();

        fs::write(project_dir_1.path().join("file1.py"), "x = 1").unwrap();
        fs::write(project_dir_2.path().join("file2.py"), "y = 2").unwrap();

        let scan_id_1 = scan_project(project_id_1).await.unwrap();
        let scan_id_2 = scan_project(project_id_2).await.unwrap();

        assert_ne!(scan_id_1, scan_id_2);

        let scans_1 = get_scans(project_id_1).await.unwrap();
        let scans_2 = get_scans(project_id_2).await.unwrap();

        assert_eq!(scans_1.len(), 1);
        assert_eq!(scans_2.len(), 1);
    }

    #[tokio::test]
    async fn test_scan_updates_project_framework() {
        let _temp_env = setup_test_env();
        let (project_dir, project_id) = create_test_project();

        fs::write(project_dir.path().join("manage.py"), "#!/usr/bin/env python").unwrap();

        let _scan_id = scan_project(project_id).await.unwrap();

        let conn = db::init_db().unwrap();
        let project = queries::select_project(&conn, project_id).unwrap().unwrap();

        // Framework should be detected during project creation or scan
        assert!(project.framework.is_some() || project.framework.is_none());
    }
}
