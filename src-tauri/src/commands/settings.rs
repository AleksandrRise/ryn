//! Settings management commands
//!
//! Handles application settings and configuration

use crate::db::{self, queries};
use crate::models::Settings;

/// Get all application settings
///
/// Returns: List of all settings key-value pairs
#[tauri::command]
pub async fn get_settings() -> Result<Vec<Settings>, String> {
    let conn = db::init_db()
        .map_err(|e| format!("Failed to initialize database: {}", e))?;

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
    let conn = db::init_db()
        .map_err(|e| format!("Failed to initialize database: {}", e))?;

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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup_test_env() -> TempDir {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("RYN_DATA_DIR", temp_dir.path());
        temp_dir
    }

    #[tokio::test]
    async fn test_get_settings_empty() {
        let _temp_env = setup_test_env();
        let result = get_settings().await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn test_update_settings_new() {
        let _temp_env = setup_test_env();
        let result = update_settings("scan_interval".to_string(), "3600".to_string()).await;
        assert!(result.is_ok());

        // Verify setting was created
        let settings = get_settings().await.unwrap();
        assert_eq!(settings.len(), 1);
        assert_eq!(settings[0].key, "scan_interval");
        assert_eq!(settings[0].value, "3600");
    }

    #[tokio::test]
    async fn test_update_settings_existing() {
        let _temp_env = setup_test_env();

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
    async fn test_update_settings_empty_key() {
        let _temp_env = setup_test_env();
        let result = update_settings("".to_string(), "value".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_settings_multiple() {
        let _temp_env = setup_test_env();

        // Create multiple settings
        let _ = update_settings("scan_interval".to_string(), "3600".to_string()).await;
        let _ = update_settings("framework".to_string(), "django".to_string()).await;
        let _ = update_settings("database_path".to_string(), "/tmp/ryn.db".to_string()).await;

        // Verify all settings were created
        let settings = get_settings().await.unwrap();
        assert_eq!(settings.len(), 3);
    }

    #[tokio::test]
    async fn test_get_settings_after_update() {
        let _temp_env = setup_test_env();

        let _ = update_settings("key1".to_string(), "value1".to_string()).await;
        let _ = update_settings("key2".to_string(), "value2".to_string()).await;

        let settings = get_settings().await.unwrap();
        assert_eq!(settings.len(), 2);

        let keys: Vec<String> = settings.iter().map(|s| s.key.clone()).collect();
        assert!(keys.contains(&"key1".to_string()));
        assert!(keys.contains(&"key2".to_string()));
    }

    #[tokio::test]
    async fn test_update_settings_creates_audit_event() {
        let _temp_env = setup_test_env();

        let _ = update_settings("test_key".to_string(), "test_value".to_string()).await;

        // Verify audit event was created
        let conn = db::init_db().unwrap();
        let mut stmt = conn
            .prepare("SELECT COUNT(*) FROM audit_events WHERE event_type = 'settings_updated'")
            .unwrap();
        let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn test_settings_persistence() {
        let _temp_env = setup_test_env();

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
    async fn test_update_settings_with_special_characters() {
        let _temp_env = setup_test_env();

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
    async fn test_update_settings_empty_value() {
        let _temp_env = setup_test_env();

        // Should allow empty value
        let result = update_settings("optional_setting".to_string(), "".to_string()).await;
        assert!(result.is_ok());

        let settings = get_settings().await.unwrap();
        assert_eq!(settings.len(), 1);
        assert_eq!(settings[0].value, "");
    }

    #[tokio::test]
    async fn test_settings_updated_at_timestamp() {
        let _temp_env = setup_test_env();

        let _ = update_settings("test".to_string(), "value".to_string()).await;

        let settings = get_settings().await.unwrap();
        assert!(!settings[0].updated_at.is_empty());
    }

    #[tokio::test]
    async fn test_update_settings_overwrites_value() {
        let _temp_env = setup_test_env();

        let _ = update_settings("key".to_string(), "old_value".to_string()).await;
        let _ = update_settings("key".to_string(), "new_value".to_string()).await;

        let settings = get_settings().await.unwrap();
        assert_eq!(settings.len(), 1);
        assert_eq!(settings[0].value, "new_value");
        assert_ne!(settings[0].value, "old_value");
    }

    #[tokio::test]
    async fn test_get_settings_ordering() {
        let _temp_env = setup_test_env();

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
