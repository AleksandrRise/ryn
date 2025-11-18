//! Integration tests for fix application safety
//!
//! Tests edge cases and safety mechanisms when applying fixes.
//! Since git integration is removed, tests focus on:
//! 1. Fix existence validation
//! 2. File existence checks
//! 3. File permission handling (readonly files)
//! 4. Violation status validation
//! 5. Backup creation
//! 6. Successful fix application
//!
//! These are real integration tests - NO MOCKS.

use ryn::commands::fix::{generate_fix, apply_fix};
use ryn::db;
use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;
use std::os::unix::fs::PermissionsExt; // For chmod on Unix

/// Helper: Setup test database environment
fn setup_test_db() {
    let test_dir = std::path::PathBuf::from("/tmp/ryn-test");
    std::fs::create_dir_all(&test_dir).ok();
    std::env::set_var("RYN_DATA_DIR", &test_dir);

    // Load .env file to get XAI_API_KEY for Grok API calls
    let _ = dotenv::dotenv();

    // Clear all data from existing database tables
    {
        let conn = db::get_connection();
        let _ = conn.execute("DELETE FROM fixes", []);
        let _ = conn.execute("DELETE FROM violations", []);
        let _ = conn.execute("DELETE FROM scans", []);
        let _ = conn.execute("DELETE FROM scan_costs", []);
        let _ = conn.execute("DELETE FROM audit_events", []);
        let _ = conn.execute("DELETE FROM projects", []);
        let _ = conn.execute("DELETE FROM settings", []);
        let _ = conn.execute("DELETE FROM sqlite_sequence", []);
    }
}

/// Helper: Create project and file setup using global test database
fn create_test_setup() -> (TempDir, PathBuf, i64, i64) {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let project_path = temp_dir.path().to_path_buf();

    // Create project in global database (used by generate_fix/apply_fix commands)
    let conn = db::get_connection();
    let project_id = conn
        .query_row(
            "INSERT INTO projects (name, path, framework) VALUES (?1, ?2, ?3) RETURNING id",
            rusqlite::params!["test_project", project_path.to_str().unwrap(), None::<String>],
            |row| row.get(0),
        )
        .expect("Failed to insert project");

    let scan_id = conn
        .query_row(
            "INSERT INTO scans (project_id, status) VALUES (?1, ?2) RETURNING id",
            rusqlite::params![project_id, "completed"],
            |row| row.get(0),
        )
        .expect("Failed to insert scan");

    (temp_dir, project_path, project_id, scan_id)
}

/// Helper: Create test file and violation in global database
fn create_test_file_and_violation(
    project_path: &PathBuf,
    scan_id: i64,
    file_name: &str,
    content: &str,
) -> (PathBuf, i64) {
    let test_file = project_path.join(file_name);
    fs::write(&test_file, content).expect("Failed to write test file");

    let conn = db::get_connection();
    // Use relative path (just the filename) for security validation
    let violation_id = conn
        .query_row(
            "INSERT INTO violations (scan_id, control_id, severity, description, file_path, line_number, code_snippet, detection_method)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING id",
            rusqlite::params![
                scan_id,
                "CC6.7",
                "critical",
                "Hardcoded secret detected",
                file_name,  // Use relative path, not absolute
                10,
                "api_key = 'fake_key_12345'",
                "regex"
            ],
            |row| row.get(0),
        )
        .expect("Failed to insert violation");

    (test_file, violation_id)
}

#[tokio::test]
#[serial_test::serial]
async fn test_apply_fix_nonexistent_fix() {
    setup_test_db();

    let (_temp_dir, project_path, _project_id, scan_id) = create_test_setup();

    let (_test_file, _violation_id) = create_test_file_and_violation(
        &project_path,
        scan_id,
        "config.py",
        "api_key = 'fake_key_12345'\n",
    );

    // Try to apply fix that doesn't exist (ID 9999)
    let result = apply_fix(9999).await;

    assert!(
        result.is_err(),
        "Apply fix should fail when fix doesn't exist"
    );

    let error = result.unwrap_err();
    assert!(
        error.contains("Fix not found"),
        "Error should mention fix not found. Got: {}",
        error
    );

    println!("✅ Fix application correctly rejected nonexistent fix");
}

#[tokio::test]
#[serial_test::serial]
async fn test_apply_fix_file_deleted_after_scan() {
    setup_test_db();

    let (_temp_dir, project_path, _project_id, scan_id) = create_test_setup();

    let (test_file, violation_id) = create_test_file_and_violation(
        &project_path,
        scan_id,
        "config.py",
        "api_key = 'fake_key_12345'\n",
    );

    // Generate fix first
    let fix_result = generate_fix(violation_id).await;
    assert!(
        fix_result.is_ok(),
        "Fix generation should succeed. Error: {:?}",
        fix_result.err()
    );
    let fix_id = fix_result.unwrap().id;

    // Delete file AFTER fix is generated
    fs::remove_file(&test_file).expect("Failed to delete test file");

    // Try to apply fix - should fail because file doesn't exist
    let result = apply_fix(fix_id).await;

    assert!(
        result.is_err(),
        "Apply fix should fail when file is deleted"
    );

    let error = result.unwrap_err();
    assert!(
        error.contains("No such file") || error.contains("not found"),
        "Error should mention file not found. Got: {}",
        error
    );

    println!("✅ Fix application correctly rejected deleted file");
}

#[tokio::test]
#[serial_test::serial]
#[cfg(unix)] // chmod only works on Unix
async fn test_apply_fix_file_readonly() {
    setup_test_db();

    let (_temp_dir, project_path, _project_id, scan_id) = create_test_setup();

    let (test_file, violation_id) = create_test_file_and_violation(
        &project_path,
        scan_id,
        "config.py",
        "api_key = 'fake_key_12345'\n",
    );

    // Generate fix first
    let fix_result = generate_fix(violation_id).await;
    assert!(
        fix_result.is_ok(),
        "Fix generation should succeed. Error: {:?}",
        fix_result.err()
    );
    let fix_id = fix_result.unwrap().id;

    // Make file readonly AFTER fix is generated
    let mut permissions = fs::metadata(&test_file)
        .expect("Failed to get file metadata")
        .permissions();
    permissions.set_mode(0o444); // readonly
    fs::set_permissions(&test_file, permissions).expect("Failed to set readonly");

    // Try to apply fix - should fail due to permission denied
    let result = apply_fix(fix_id).await;

    assert!(
        result.is_err(),
        "Apply fix should fail when file is readonly"
    );

    let error = result.unwrap_err();
    assert!(
        error.contains("PermissionDenied") || error.contains("permission denied") || error.contains("Permission"),
        "Error should mention permission denied. Got: {}",
        error
    );

    println!("✅ Fix application correctly rejected readonly file");
}

#[tokio::test]
#[serial_test::serial]
async fn test_apply_fix_no_fix_generated() {
    setup_test_db();

    let (_temp_dir, project_path, _project_id, scan_id) = create_test_setup();

    let (_test_file, violation_id) = create_test_file_and_violation(
        &project_path,
        scan_id,
        "config.py",
        "api_key = 'fake_key_12345'\n",
    );

    // Try to apply fix WITHOUT generating it first
    // This should fail because no fix exists in the database
    let result = apply_fix(violation_id).await;

    assert!(
        result.is_err(),
        "Apply fix should fail when no fix has been generated"
    );

    let error = result.unwrap_err();
    assert!(
        error.contains("Fix not found"),
        "Error should mention fix not found. Got: {}",
        error
    );

    println!("✅ Fix application correctly rejected violation without generated fix");
}

#[tokio::test]
#[serial_test::serial]
async fn test_apply_fix_succeeds_with_backup() {
    // This test verifies that fix application SUCCEEDS and creates backup
    // Skip if XAI_API_KEY is not set (this test needs real fix generation)
    dotenv::from_path("../.env").ok();
    if std::env::var("XAI_API_KEY").is_err() {
        println!("⏭️  Skipping test: XAI_API_KEY not set");
        return;
    }

    setup_test_db();

    let (_temp_dir, project_path, _project_id, scan_id) = create_test_setup();

    let (test_file, violation_id) = create_test_file_and_violation(
        &project_path,
        scan_id,
        "config.py",
        "api_key = 'fake_key_12345'\ndef get_api_key():\n    return api_key\n",
    );

    let original_content = fs::read_to_string(&test_file).expect("Failed to read original file");

    // Generate fix (using real Grok API)
    let fix_result = generate_fix(violation_id).await;
    assert!(
        fix_result.is_ok(),
        "Fix generation should succeed. Error: {:?}",
        fix_result.err()
    );
    let fix_id = fix_result.unwrap().id;

    // Apply fix - should succeed
    let apply_result = apply_fix(fix_id).await;

    assert!(
        apply_result.is_ok(),
        "Apply fix should succeed. Error: {}",
        apply_result.as_ref().unwrap_err()
    );

    // Verify file was modified
    let new_content = fs::read_to_string(&test_file).expect("Failed to read test file");
    assert_ne!(
        new_content, original_content,
        "File content should be different after fix applied"
    );

    // Verify hardcoded secret is removed
    assert!(
        !new_content.contains("fake_key_12345"),
        "Fixed code should not contain hardcoded secret"
    );

    // Verify backup was created
    let backup_dir = project_path.join(".ryn-backups");
    assert!(
        backup_dir.exists(),
        "Backup directory should be created"
    );

    let backup_files: Vec<_> = std::fs::read_dir(&backup_dir)
        .expect("Failed to read backup dir")
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .file_name()
                .map(|n| n.to_string_lossy().contains("config.py"))
                .unwrap_or(false)
        })
        .collect();

    assert!(
        !backup_files.is_empty(),
        "Backup file should exist for config.py"
    );

    // Verify backup content matches original
    let backup_content = fs::read_to_string(backup_files[0].path())
        .expect("Failed to read backup file");
    assert_eq!(
        backup_content, original_content,
        "Backup should contain original content"
    );

    println!("✅ Fix application succeeded with backup creation");
}

#[tokio::test]
#[serial_test::serial]
async fn test_apply_fix_updates_violation_status() {
    // Verify that applying a fix updates violation status from pending to fixed
    dotenv::from_path("../.env").ok();
    if std::env::var("XAI_API_KEY").is_err() {
        println!("⏭️  Skipping test: XAI_API_KEY not set");
        return;
    }

    setup_test_db();

    let (_temp_dir, project_path, _project_id, scan_id) = create_test_setup();

    let (_test_file, violation_id) = create_test_file_and_violation(
        &project_path,
        scan_id,
        "config.py",
        "api_key = 'fake_key_12345'\n",
    );

    // Generate and apply fix
    let fix_result = generate_fix(violation_id).await;
    assert!(fix_result.is_ok());
    let fix_id = fix_result.unwrap().id;

    let apply_result = apply_fix(fix_id).await;
    assert!(apply_result.is_ok());

    // Verify violation status was updated to 'fixed'
    let conn = db::get_connection();
    let status = conn
        .query_row(
            "SELECT status FROM violations WHERE id = ?1",
            rusqlite::params![violation_id],
            |row| row.get::<_, String>(0),
        )
        .expect("Failed to fetch violation");

    assert_eq!(
        status, "fixed",
        "Violation status should be updated to 'fixed' after successful fix application"
    );

    println!("✅ Fix application correctly updated violation status to 'fixed'");
}

#[tokio::test]
#[serial_test::serial]
async fn test_apply_fix_records_applied_at_timestamp() {
    // Verify that applying a fix records the applied_at timestamp
    dotenv::from_path("../.env").ok();
    if std::env::var("XAI_API_KEY").is_err() {
        println!("⏭️  Skipping test: XAI_API_KEY not set");
        return;
    }

    setup_test_db();

    let (_temp_dir, project_path, _project_id, scan_id) = create_test_setup();

    let (_test_file, violation_id) = create_test_file_and_violation(
        &project_path,
        scan_id,
        "config.py",
        "api_key = 'fake_key_12345'\n",
    );

    // Generate and apply fix
    let fix_result = generate_fix(violation_id).await;
    assert!(fix_result.is_ok());
    let fix_id = fix_result.unwrap().id;

    let apply_result = apply_fix(fix_id).await;
    assert!(apply_result.is_ok());

    // Verify fix has applied_at timestamp set
    let conn = db::get_connection();
    let (applied_at, backup_path): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT applied_at, backup_path FROM fixes WHERE id = ?1",
            rusqlite::params![fix_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("Failed to fetch fix");

    assert!(
        applied_at.is_some(),
        "Fix should have applied_at timestamp"
    );
    assert!(
        backup_path.is_some(),
        "Fix should have backup_path recorded"
    );

    println!("✅ Fix application correctly recorded applied_at and backup_path");
}
