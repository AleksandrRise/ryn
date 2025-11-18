//! Audit event utility functions
//!
//! Provides helper functions for creating audit events across command modules

use crate::models::AuditEvent;
use anyhow::Result;

/// Helper function to create audit events
///
/// Creates an AuditEvent struct with the given parameters and current timestamp.
/// The connection parameter is kept for API compatibility but is not used.
///
/// # Arguments
/// * `_conn` - Database connection (unused, kept for backward compatibility)
/// * `event_type` - Type of audit event (e.g., "scan", "fix", "violation")
/// * `project_id` - Optional project ID associated with the event
/// * `violation_id` - Optional violation ID associated with the event
/// * `fix_id` - Optional fix ID associated with the event
/// * `description` - Human-readable description of the event
///
/// # Returns
/// * `Result<AuditEvent>` - The created audit event
pub fn create_audit_event(
    _conn: &rusqlite::Connection,
    event_type: &str,
    project_id: Option<i64>,
    violation_id: Option<i64>,
    fix_id: Option<i64>,
    description: &str,
) -> Result<AuditEvent> {
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
