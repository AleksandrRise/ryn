//! Settings management commands
//!
//! Handles application settings and configuration

use crate::db::{self, queries};
use crate::models::Settings;
use crate::utils::create_audit_event;

/// Get all application settings
///
/// Returns: List of all settings key-value pairs
#[tauri::command]
pub async fn get_settings() -> Result<Vec<Settings>, String> {
    let conn = db::get_connection();

    let settings = queries::select_all_settings(&conn)
        .map_err(|e| format!("Failed to fetch settings: {}", e))?;

    Ok(settings)
}

/// Update or create an application setting
///
/// # Arguments
/// * `key` - Setting key (e.g., "framework", "scan_interval")
/// * `value` - Setting value
///
/// Returns: Success or error
#[tauri::command]
pub async fn update_settings(key: String, value: String) -> Result<(), String> {
    let conn = db::get_connection();

    // Validate key
    if key.is_empty() {
        return Err("Setting key cannot be empty".to_string());
    }

    // Update or insert setting
    queries::insert_or_update_setting(&conn, &key, &value)
        .map_err(|e| format!("Failed to update setting: {}", e))?;

    // Log audit event
    if let Ok(event) = create_audit_event(
        &conn,
        "settings_updated",
        None,
        None,
        None,
        &format!("Updated setting: {} = {}", key, value),
    ) {
        let _ = queries::insert_audit_event(&conn, &event);
    }

    Ok(())
}

/// Clear all database data (scan history, violations, fixes, audit events)
///
/// **IMPORTANT**: Creates backup before clearing
/// Backup location: ~/.ryn/backups/db-backup-{timestamp}.sqlite
///
/// Returns: Success message with backup location, or error
#[tauri::command]
pub async fn clear_database() -> Result<String, String> {
    let conn = db::get_connection();

    // Create backup directory
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())?;
    let backup_dir = home_dir.join(".ryn/backups");
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;

    // Create timestamped backup file
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let backup_path = backup_dir.join(format!("db-backup-{}.sqlite", timestamp));

    // Perform SQLite backup using rusqlite's backup API
    let mut backup_conn = rusqlite::Connection::open(&backup_path)
        .map_err(|e| format!("Failed to create backup file: {}", e))?;

    let backup = rusqlite::backup::Backup::new(&conn, &mut backup_conn)
        .map_err(|e| format!("Failed to initialize backup: {}", e))?;

    backup.run_to_completion(5, std::time::Duration::from_millis(250), None)
        .map_err(|e| format!("Failed to complete backup: {}", e))?;

    let backup_path_str = backup_path.to_string_lossy().to_string();

    // Clear all tables in reverse dependency order
    conn.execute("DELETE FROM fixes", [])
        .map_err(|e| format!("Failed to clear fixes: {}", e))?;

    conn.execute("DELETE FROM violations", [])
        .map_err(|e| format!("Failed to clear violations: {}", e))?;

    conn.execute("DELETE FROM scans", [])
        .map_err(|e| format!("Failed to clear scans: {}", e))?;

    conn.execute("DELETE FROM audit_events", [])
        .map_err(|e| format!("Failed to clear audit events: {}", e))?;

    // Note: We DON'T clear projects or settings tables

    // Log audit event for clearing database
    if let Ok(event) = create_audit_event(
        &conn,
        "database_cleared",
        None,
        None,
        None,
        &format!("Database cleared - backup saved to {}", backup_path_str),
    ) {
        let _ = queries::insert_audit_event(&conn, &event);
    }

    Ok(format!("Database cleared successfully. Backup saved to: {}", backup_path_str))
}

/// Export all database data to JSON format
///
/// Returns: JSON string containing all projects, scans, violations, fixes, and settings
#[tauri::command]
pub async fn export_data() -> Result<String, String> {
    use serde_json::json;

    let conn = db::get_connection();

    // Fetch all data from all tables
    let projects = queries::select_all_projects(&conn)
        .map_err(|e| format!("Failed to fetch projects: {}", e))?;

    let scans = queries::select_all_scans(&conn)
        .map_err(|e| format!("Failed to fetch scans: {}", e))?;

    let violations = queries::select_all_violations(&conn)
        .map_err(|e| format!("Failed to fetch violations: {}", e))?;

    let fixes = queries::select_all_fixes(&conn)
        .map_err(|e| format!("Failed to fetch fixes: {}", e))?;

    let audit_events = queries::select_all_audit_events(&conn)
        .map_err(|e| format!("Failed to fetch audit events: {}", e))?;

    let settings = queries::select_all_settings(&conn)
        .map_err(|e| format!("Failed to fetch settings: {}", e))?;

    // Build JSON export
    let export = json!({
        "version": "1.0",
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "data": {
            "projects": projects,
            "scans": scans,
            "violations": violations,
            "fixes": fixes,
            "audit_events": audit_events,
            "settings": settings,
        },
        "counts": {
            "projects": projects.len(),
            "scans": scans.len(),
            "violations": violations.len(),
            "fixes": fixes.len(),
            "audit_events": audit_events.len(),
            "settings": settings.len(),
        }
    });

    // Convert to pretty JSON string
    serde_json::to_string_pretty(&export)
        .map_err(|e| format!("Failed to serialize export data: {}", e))
}

/// Complete onboarding by saving user's scanning preferences
///
/// # Arguments
/// * `scan_mode` - Selected scanning mode: "regex_only", "smart", or "analyze_all"
/// * `cost_limit` - Cost limit per scan in dollars (e.g., 5.00)
///
/// Returns: Success or error
#[tauri::command]
pub async fn complete_onboarding(scan_mode: String, cost_limit: f64) -> Result<(), String> {
    let conn = db::get_connection();

    // Validate scan_mode
    if !matches!(scan_mode.as_str(), "regex_only" | "smart" | "analyze_all") {
        return Err(format!("Invalid scan mode: {}. Must be regex_only, smart, or analyze_all", scan_mode));
    }

    // Validate cost_limit
    if cost_limit < 0.0 {
        return Err("Cost limit cannot be negative".to_string());
    }

    if cost_limit > 1000.0 {
        return Err("Cost limit cannot exceed $1,000.00".to_string());
    }

    // Save settings
    queries::insert_or_update_setting(&conn, "llm_scan_mode", &scan_mode)
        .map_err(|e| format!("Failed to save scan mode setting: {}", e))?;

    queries::insert_or_update_setting(&conn, "cost_limit_per_scan", &cost_limit.to_string())
        .map_err(|e| format!("Failed to save cost limit setting: {}", e))?;

    queries::insert_or_update_setting(&conn, "onboarding_completed", "true")
        .map_err(|e| format!("Failed to mark onboarding as complete: {}", e))?;

    // Log audit event
    if let Ok(event) = create_audit_event(
        &conn,
        "onboarding_completed",
        None,
        None,
        None,
        &format!("Onboarding completed: scan_mode={}, cost_limit=${:.2}", scan_mode, cost_limit),
    ) {
        let _ = queries::insert_audit_event(&conn, &event);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::test_helpers::TestDbGuard;
    use super::*;
    use tempfile::TempDir;

    fn setup_test_env() -> TempDir {
        let temp_dir = tempfile::TempDir::new().unwrap();
        std::env::set_var("RYN_DATA_DIR", temp_dir.path());
        temp_dir
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_settings_empty() {
        let _guard = TestDbGuard::new();

        let result = get_settings().await;
        assert!(result.is_ok());
        // TestDbGuard clears all settings, so expect empty
        assert_eq!(result.unwrap().len(), 0);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_update_settings_new() {
        let _guard = TestDbGuard::new();

        let result = update_settings("scan_interval".to_string(), "3600".to_string()).await;
        assert!(result.is_ok());

        // Verify setting was created
        let settings = get_settings().await.unwrap();
        assert_eq!(settings.len(), 1);
        assert_eq!(settings[0].key, "scan_interval");
        assert_eq!(settings[0].value, "3600");
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_update_settings_existing() {
        let _guard = TestDbGuard::new();

        // Create initial setting
        let _ = update_settings("scan_interval".to_string(), "3600".to_string()).await;

        // Update existing setting
        let result = update_settings("scan_interval".to_string(), "7200".to_string()).await;
        assert!(result.is_ok());

        // Verify setting was updated
        let settings = get_settings().await.unwrap();
        assert_eq!(settings.len(), 1);
        assert_eq!(settings[0].value, "7200");
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_update_settings_empty_key() {
        let _guard = TestDbGuard::new();

        let result = update_settings("".to_string(), "value".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_update_settings_multiple() {
        let _guard = TestDbGuard::new();

        // Create multiple settings
        let _ = update_settings("scan_interval".to_string(), "3600".to_string()).await;
        let _ = update_settings("framework".to_string(), "django".to_string()).await;
        let _ = update_settings("database_path".to_string(), "/tmp/ryn.db".to_string()).await;

        // Verify all settings were created
        let settings = get_settings().await.unwrap();
        assert_eq!(settings.len(), 3);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_settings_after_update() {
        let _guard = TestDbGuard::new();

        let _ = update_settings("key1".to_string(), "value1".to_string()).await;
        let _ = update_settings("key2".to_string(), "value2".to_string()).await;

        let settings = get_settings().await.unwrap();
        assert_eq!(settings.len(), 2);

        let keys: Vec<String> = settings.iter().map(|s| s.key.clone()).collect();
        assert!(keys.contains(&"key1".to_string()));
        assert!(keys.contains(&"key2".to_string()));
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_update_settings_creates_audit_event() {
        let _guard = TestDbGuard::new();

        let _ = update_settings("test_key".to_string(), "test_value".to_string()).await;

        // Verify audit event was created
        let count: i64 = {
            let conn = db::get_connection();
            let mut stmt = conn
                .prepare("SELECT COUNT(*) FROM audit_events WHERE event_type = 'settings_updated'")
                .unwrap();
            stmt.query_row([], |row| row.get(0)).unwrap()
        };
        assert_eq!(count, 1);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_settings_persistence() {
        let _guard = TestDbGuard::new();

        // Create setting
        let _ = update_settings("persistent_key".to_string(), "persistent_value".to_string()).await;

        // Fetch settings again
        let settings = get_settings().await.unwrap();
        assert_eq!(settings.len(), 1);
        assert_eq!(settings[0].value, "persistent_value");

        // Update and verify again
        let _ = update_settings("persistent_key".to_string(), "new_value".to_string()).await;
        let settings = get_settings().await.unwrap();
        assert_eq!(settings[0].value, "new_value");
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_update_settings_with_special_characters() {
        let _guard = TestDbGuard::new();

        let result = update_settings(
            "json_config".to_string(),
            r#"{"framework": "django", "version": "3.2"}"#.to_string(),
        ).await;
        assert!(result.is_ok());

        let settings = get_settings().await.unwrap();
        assert_eq!(settings.len(), 1);
        assert!(settings[0].value.contains("framework"));
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_update_settings_empty_value() {
        let _guard = TestDbGuard::new();

        // Should allow empty value
        let result = update_settings("optional_setting".to_string(), "".to_string()).await;
        assert!(result.is_ok());

        let settings = get_settings().await.unwrap();
        assert_eq!(settings.len(), 1);
        assert_eq!(settings[0].value, "");
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_settings_updated_at_timestamp() {
        let _guard = TestDbGuard::new();

        let _ = update_settings("test".to_string(), "value".to_string()).await;

        let settings = get_settings().await.unwrap();
        assert!(!settings[0].updated_at.is_empty());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_update_settings_overwrites_value() {
        let _guard = TestDbGuard::new();

        let _ = update_settings("key".to_string(), "old_value".to_string()).await;
        let _ = update_settings("key".to_string(), "new_value".to_string()).await;

        let settings = get_settings().await.unwrap();
        assert_eq!(settings.len(), 1);
        assert_eq!(settings[0].value, "new_value");
        assert_ne!(settings[0].value, "old_value");
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_settings_ordering() {
        let _guard = TestDbGuard::new();

        let _ = update_settings("zebra".to_string(), "z".to_string()).await;
        let _ = update_settings("apple".to_string(), "a".to_string()).await;
        let _ = update_settings("banana".to_string(), "b".to_string()).await;

        let settings = get_settings().await.unwrap();
        // Expect keys to be in alphabetical order
        assert_eq!(settings[0].key, "apple");
        assert_eq!(settings[1].key, "banana");
        assert_eq!(settings[2].key, "zebra");
    }
}
