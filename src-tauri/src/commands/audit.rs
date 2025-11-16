//! Audit trail commands
//!
//! Handles audit event retrieval and filtering

use crate::db::{self, queries};
use crate::models::AuditEvent;
use serde::{Deserialize, Serialize};

/// Audit event filter options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditFilters {
    pub event_type: Option<Vec<String>>,
    pub project_id: Option<i64>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub limit: Option<i64>,
}

/// Get audit events with optional filters
///
/// Returns: List of audit events sorted by creation date (newest first)
#[tauri::command]
pub async fn get_audit_events(filters: Option<AuditFilters>) -> Result<Vec<AuditEvent>, String> {
    let conn = db::get_connection();

    let limit = filters
        .as_ref()
        .and_then(|f| f.limit)
        .unwrap_or(1000);

    // Get all audit events
    let mut events = queries::select_audit_events(&conn, limit)
        .map_err(|e| format!("Failed to fetch audit events: {}", e))?;

    // Apply filters if provided
    if let Some(f) = filters {
        events.retain(|event| {
            // Filter by event_type
            if let Some(ref event_types) = f.event_type {
                if !event_types.contains(&event.event_type) {
                    return false;
                }
            }

            // Filter by project_id
            if let Some(proj_id) = f.project_id {
                if event.project_id != Some(proj_id) {
                    return false;
                }
            }

            // Filter by date range
            if let Some(ref start) = f.start_date {
                if event.created_at < *start {
                    return false;
                }
            }

            if let Some(ref end) = f.end_date {
                if event.created_at > *end {
                    return false;
                }
            }

            true
        });
    }

    Ok(events)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::TestDbGuard;

    fn create_test_project(project_id: i64) -> i64 {
        let conn = db::get_connection();
        let project_path = format!("/tmp/test-project-{}", project_id);

        // Create the directory
        let _ = std::fs::create_dir_all(&project_path);

        // Insert project and return its ID
        queries::insert_project(&conn, &format!("test-project-{}", project_id), &project_path, None)
            .unwrap_or(project_id)
    }

    fn create_test_audit_event(event_type: &str, project_id: Option<i64>) -> i64 {
        let conn = db::get_connection();

        // Ensure project exists if specified
        if let Some(pid) = project_id {
            let _ = create_test_project(pid);
        }

        let event = AuditEvent {
            id: 0,
            event_type: event_type.to_string(),
            project_id,
            violation_id: None,
            fix_id: None,
            description: format!("Test event: {}", event_type),
            metadata: None,
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        queries::insert_audit_event(&conn, &event).unwrap()
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_audit_events_empty() {
        let _guard = TestDbGuard::new();
        let result = get_audit_events(None).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_audit_events_all() {
        let _guard = TestDbGuard::new();

        // Create multiple events with valid event types
        let _e1 = create_test_audit_event("scan", Some(1));
        let _e2 = create_test_audit_event("violation", Some(1));
        let _e3 = create_test_audit_event("fix", Some(1));

        let result = get_audit_events(None).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 3);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_audit_events_filter_by_type() {
        let _guard = TestDbGuard::new();

        // Create events of different types
        let _e1 = create_test_audit_event("scan", Some(1));
        let _e2 = create_test_audit_event("violation", Some(1));
        let _e3 = create_test_audit_event("scan", Some(2));

        let filters = AuditFilters {
            event_type: Some(vec!["scan".to_string()]),
            project_id: None,
            start_date: None,
            end_date: None,
            limit: None,
        };

        let result = get_audit_events(Some(filters)).await;
        assert!(result.is_ok());

        let events = result.unwrap();
        assert_eq!(events.len(), 2);
        assert!(events.iter().all(|e| e.event_type == "scan"));
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_audit_events_filter_by_project() {
        let _guard = TestDbGuard::new();

        // Create events for different projects
        let _e1 = create_test_audit_event("scan", Some(1));
        let _e2 = create_test_audit_event("scan", Some(2));
        let _e3 = create_test_audit_event("violation", Some(1));

        let filters = AuditFilters {
            event_type: None,
            project_id: Some(1),
            start_date: None,
            end_date: None,
            limit: None,
        };

        let result = get_audit_events(Some(filters)).await;
        assert!(result.is_ok());

        let events = result.unwrap();
        assert_eq!(events.len(), 2);
        assert!(events.iter().all(|e| e.project_id == Some(1)));
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_audit_events_filter_by_date_range() {
        let _guard = TestDbGuard::new();

        // Capture time BEFORE creating the event
        let past = (chrono::Utc::now() - chrono::Duration::minutes(1)).to_rfc3339();
        let future = (chrono::Utc::now() + chrono::Duration::hours(1)).to_rfc3339();

        // Create events
        let _e1 = create_test_audit_event("scan", Some(1));

        let filters = AuditFilters {
            event_type: None,
            project_id: None,
            start_date: Some(past),
            end_date: Some(future),
            limit: None,
        };

        let result = get_audit_events(Some(filters)).await;
        assert!(result.is_ok());
        assert!(result.unwrap().len() > 0);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_audit_events_filter_multiple() {
        let _guard = TestDbGuard::new();

        // Create events
        let _e1 = create_test_audit_event("scan", Some(1));
        let _e2 = create_test_audit_event("violation", Some(1));
        let _e3 = create_test_audit_event("scan", Some(2));

        let filters = AuditFilters {
            event_type: Some(vec!["scan".to_string()]),
            project_id: Some(1),
            start_date: None,
            end_date: None,
            limit: None,
        };

        let result = get_audit_events(Some(filters)).await;
        assert!(result.is_ok());

        let events = result.unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_type, "scan");
        assert_eq!(events[0].project_id, Some(1));
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_audit_events_with_limit() {
        let _guard = TestDbGuard::new();

        // Create many events with valid event types
        for i in 0..5 {
            let event_type = match i % 3 {
                0 => "scan",
                1 => "violation",
                _ => "fix",
            };
            create_test_audit_event(event_type, Some(1));
        }

        let filters = AuditFilters {
            event_type: None,
            project_id: None,
            start_date: None,
            end_date: None,
            limit: Some(3),
        };

        let result = get_audit_events(Some(filters)).await;
        assert!(result.is_ok());
        assert!(result.unwrap().len() <= 3);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_audit_events_ordered_newest_first() {
        let _guard = TestDbGuard::new();

        // Create events with known order
        let _e1 = create_test_audit_event("scan", Some(1));
        std::thread::sleep(std::time::Duration::from_millis(10));
        let _e2 = create_test_audit_event("violation", Some(1));
        std::thread::sleep(std::time::Duration::from_millis(10));
        let _e3 = create_test_audit_event("fix", Some(1));

        let result = get_audit_events(None).await;
        assert!(result.is_ok());

        let events = result.unwrap();
        assert_eq!(events.len(), 3);
        // Most recent should be first
        assert_eq!(events[0].event_type, "fix");
        assert_eq!(events[1].event_type, "violation");
        assert_eq!(events[2].event_type, "scan");
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_audit_events_includes_all_fields() {
        let _guard = TestDbGuard::new();
        let _e = create_test_audit_event("scan", Some(1));

        let result = get_audit_events(None).await;
        assert!(result.is_ok());

        let events = result.unwrap();
        assert_eq!(events.len(), 1);

        let event = &events[0];
        assert!(!event.event_type.is_empty());
        assert_eq!(event.project_id, Some(1));
        assert!(!event.description.is_empty());
        assert!(!event.created_at.is_empty());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_audit_events_no_match_filters() {
        let _guard = TestDbGuard::new();

        let _e1 = create_test_audit_event("scan", Some(1));

        let filters = AuditFilters {
            event_type: Some(vec!["nonexistent_event".to_string()]),
            project_id: None,
            start_date: None,
            end_date: None,
            limit: None,
        };

        let result = get_audit_events(Some(filters)).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_audit_events_filter_multiple_event_types() {
        let _guard = TestDbGuard::new();

        let _e1 = create_test_audit_event("scan", Some(1));
        let _e2 = create_test_audit_event("violation", Some(1));
        let _e3 = create_test_audit_event("fix", Some(1));

        let filters = AuditFilters {
            event_type: Some(vec![
                "scan".to_string(),
                "violation".to_string(),
            ]),
            project_id: None,
            start_date: None,
            end_date: None,
            limit: None,
        };

        let result = get_audit_events(Some(filters)).await;
        assert!(result.is_ok());

        let events = result.unwrap();
        assert_eq!(events.len(), 2);
    }
}
