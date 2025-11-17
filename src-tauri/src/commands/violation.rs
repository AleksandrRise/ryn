//! Violation management commands
//!
//! Handles violation queries, filtering, and status updates

use crate::db::{self, queries};
use crate::models::{Violation, Control};
use crate::utils::create_audit_event;
use serde::{Deserialize, Serialize};

/// Violation filter options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViolationFilters {
    pub severity: Option<Vec<String>>,
    pub control_id: Option<Vec<String>>,
    pub status: Option<Vec<String>>,
}

/// Get all violations for a scan with optional filters
///
/// # Arguments
/// * `scan_id` - ID of the scan
/// * `filters` - Optional filters for severity, control_id, or status
///
/// Returns: List of violations matching the filters
#[tauri::command]
pub async fn get_violations(
    scan_id: i64,
    filters: Option<ViolationFilters>,
) -> Result<Vec<Violation>, String> {
    let conn = db::get_connection();

    // Get all violations for scan
    let mut violations = queries::select_violations(&conn, scan_id)
        .map_err(|e| format!("Failed to fetch violations: {}", e))?;

    // Apply filters if provided
    if let Some(f) = filters {
        violations.retain(|v| {
            // Filter by severity
            if let Some(ref severities) = f.severity {
                if !severities.contains(&v.severity) {
                    return false;
                }
            }

            // Filter by control_id
            if let Some(ref control_ids) = f.control_id {
                if !control_ids.contains(&v.control_id) {
                    return false;
                }
            }

            // Filter by status
            if let Some(ref statuses) = f.status {
                if !statuses.contains(&v.status) {
                    return false;
                }
            }

            true
        });
    }

    // Sort by severity (critical first) and line number
    violations.sort_by(|a, b| {
        let severity_order = |s: &str| match s {
            "critical" => 0,
            "high" => 1,
            "medium" => 2,
            "low" => 3,
            _ => 4,
        };

        match severity_order(&a.severity).cmp(&severity_order(&b.severity)) {
            std::cmp::Ordering::Equal => a.line_number.cmp(&b.line_number),
            other => other,
        }
    });

    Ok(violations)
}

/// Get a single violation with full details
///
/// # Arguments
/// * `violation_id` - Violation ID
///
/// Returns: Violation detail object with related control and fix information
#[tauri::command]
pub async fn get_violation(violation_id: i64) -> Result<ViolationDetail, String> {
    let conn = db::get_connection();

    // Get violation
    let violation = queries::select_violation(&conn, violation_id)
        .map_err(|e| format!("Failed to fetch violation: {}", e))?
        .ok_or_else(|| format!("Violation not found: {}", violation_id))?;

    // Get related control
    let control = queries::select_control(&conn, &violation.control_id)
        .map_err(|e| format!("Failed to fetch control: {}", e))?;

    // Get related fix if exists
    let fix = queries::select_fix_for_violation(&conn, violation_id)
        .map_err(|e| format!("Failed to fetch fix: {}", e))?;

    // Get related scan
    let scan = queries::select_scan(&conn, violation.scan_id)
        .map_err(|e| format!("Failed to fetch scan: {}", e))?;

    Ok(ViolationDetail {
        violation,
        control,
        fix,
        scan,
    })
}

/// Dismiss a violation
///
/// Marks a violation as dismissed in the database and logs an audit event
///
/// # Arguments
/// * `violation_id` - Violation ID
///
/// Returns: Success or error
#[tauri::command]
pub async fn dismiss_violation(violation_id: i64) -> Result<(), String> {
    let conn = db::get_connection();

    // Get violation to extract scan_id
    let violation = queries::select_violation(&conn, violation_id)
        .map_err(|e| format!("Failed to fetch violation: {}", e))?
        .ok_or_else(|| format!("Violation not found: {}", violation_id))?;

    // Update status to dismissed
    queries::update_violation_status(&conn, violation_id, "dismissed")
        .map_err(|e| format!("Failed to dismiss violation: {}", e))?;

    // Get scan and project info for audit
    let scan = queries::select_scan(&conn, violation.scan_id)
        .map_err(|e| format!("Failed to fetch scan: {}", e))?;

    // Log audit event
    if let Some(s) = scan {
        if let Ok(event) = create_audit_event(
            &conn,
            "violation_dismissed",
            Some(s.project_id),
            Some(violation_id),
            None,
            &format!("Dismissed violation: {}", violation.description),
        ) {
            let _ = queries::insert_audit_event(&conn, &event);
        }
    }

    Ok(())
}

/// Violation detail response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViolationDetail {
    pub violation: Violation,
    pub control: Option<Control>,
    pub fix: Option<crate::models::Fix>,
    pub scan: Option<crate::models::Scan>,
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

    fn create_test_violation(scan_id: i64) -> i64 {
        let violation = Violation {
            id: 0,
            scan_id,
            control_id: "CC6.1".to_string(),
            severity: "high".to_string(),
            description: "Missing login_required decorator".to_string(),
            file_path: "views.py".to_string(),
            line_number: 42,
            code_snippet: "def get_user(request):".to_string(),
            status: "open".to_string(),
            detected_at: chrono::Utc::now().to_rfc3339(),
            detection_method: "regex".to_string(),
            confidence_score: None,
            llm_reasoning: None,
            regex_reasoning: None,
            function_name: None,
            class_name: None,
        };

        let conn = db::get_connection();
        queries::insert_violation(&conn, &violation).unwrap()
    }

    fn create_test_scan(project_id: i64) -> i64 {
        let conn = db::get_connection();
        queries::insert_scan(&conn, project_id).unwrap()
    }

    fn create_test_project() -> i64 {
        let temp_dir = tempfile::TempDir::new().unwrap();
        let path = temp_dir.path().to_string_lossy().to_string();
        let project_id = {
            let conn = db::get_connection();
            queries::insert_project(&conn, "test-project", &path, None).unwrap()
        };
        std::mem::forget(temp_dir);
        project_id
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_violations_empty_scan() {
        let _guard = TestDbGuard::new();
        let project_id = create_test_project();
        let scan_id = create_test_scan(project_id);

        let result = get_violations(scan_id, None).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_violations_returns_all() {
        let _guard = TestDbGuard::new();
        let project_id = create_test_project();
        let scan_id = create_test_scan(project_id);

        // Create multiple violations
        let _v1 = create_test_violation(scan_id);
        let _v2 = create_test_violation(scan_id);
        let _v3 = create_test_violation(scan_id);

        let result = get_violations(scan_id, None).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 3);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_violations_filter_by_severity() {
        let _guard = TestDbGuard::new();
        let project_id = create_test_project();
        let scan_id = create_test_scan(project_id);

        // Create violations with different severities
        {
            let conn = db::get_connection();

            for severity in ["critical", "high", "medium"] {
                let violation = Violation {
                    id: 0,
                    scan_id,
                    control_id: "CC6.1".to_string(),
                    severity: severity.to_string(),
                    description: format!("Violation with {} severity", severity),
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
                let _ = queries::insert_violation(&conn, &violation);
            }
        }

        let filters = ViolationFilters {
            severity: Some(vec!["high".to_string()]),
            control_id: None,
            status: None,
        };

        let result = get_violations(scan_id, Some(filters)).await;
        assert!(result.is_ok());

        let violations = result.unwrap();
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].severity, "high");
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_violations_sorted_by_severity() {
        let _guard = TestDbGuard::new();
        let project_id = create_test_project();
        let scan_id = create_test_scan(project_id);

        // Create violations with different severities in random order
        {
            let conn = db::get_connection();

            for (i, severity) in ["low", "critical", "high", "medium"].iter().enumerate() {
                let violation = Violation {
                    id: 0,
                    scan_id,
                    control_id: "CC6.1".to_string(),
                    severity: severity.to_string(),
                    description: format!("Violation {}", i),
                    file_path: "test.py".to_string(),
                    line_number: (i as i64) + 1,
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
                let _ = queries::insert_violation(&conn, &violation);
            }
        }

        let result = get_violations(scan_id, None).await;
        assert!(result.is_ok());

        let violations = result.unwrap();
        assert_eq!(violations[0].severity, "critical");
        assert_eq!(violations[1].severity, "high");
        assert_eq!(violations[2].severity, "medium");
        assert_eq!(violations[3].severity, "low");
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_violation_not_found() {
        let _guard = TestDbGuard::new();
        let result = get_violation(999).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_violation_detail() {
        let _guard = TestDbGuard::new();
        let project_id = create_test_project();
        let scan_id = create_test_scan(project_id);
        let violation_id = create_test_violation(scan_id);

        let result = get_violation(violation_id).await;
        assert!(result.is_ok());

        let detail = result.unwrap();
        assert_eq!(detail.violation.id, violation_id);
        assert!(detail.control.is_some());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_violation_includes_scan_info() {
        let _guard = TestDbGuard::new();
        let project_id = create_test_project();
        let scan_id = create_test_scan(project_id);
        let violation_id = create_test_violation(scan_id);

        let result = get_violation(violation_id).await;
        assert!(result.is_ok());

        let detail = result.unwrap();
        assert!(detail.scan.is_some());
        assert_eq!(detail.scan.unwrap().id, scan_id);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_dismiss_violation_success() {
        let _guard = TestDbGuard::new();
        let project_id = create_test_project();
        let scan_id = create_test_scan(project_id);
        let violation_id = create_test_violation(scan_id);

        let result = dismiss_violation(violation_id).await;
        assert!(result.is_ok());

        // Verify status changed
        {
            let conn = db::get_connection();
            let violation = queries::select_violation(&conn, violation_id)
                .unwrap()
                .unwrap();
            assert_eq!(violation.status, "dismissed");
        }
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_dismiss_nonexistent_violation() {
        let _guard = TestDbGuard::new();
        let result = dismiss_violation(999).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_dismiss_violation_creates_audit_event() {
        let _guard = TestDbGuard::new();
        let project_id = create_test_project();
        let scan_id = create_test_scan(project_id);
        let violation_id = create_test_violation(scan_id);

        let _ = dismiss_violation(violation_id).await;

        // Verify audit event created
        {
            let conn = db::get_connection();
            let mut stmt = conn
                .prepare("SELECT COUNT(*) FROM audit_events WHERE violation_id = ?")
                .unwrap();
            let count: i64 = stmt.query_row([violation_id], |row| row.get(0)).unwrap();
            assert_eq!(count, 1);
        }
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_violations_filter_by_control() {
        let _guard = TestDbGuard::new();
        let project_id = create_test_project();
        let scan_id = create_test_scan(project_id);

        {
            let conn = db::get_connection();

            // Create violations with different controls
            for control_id in ["CC6.1", "CC6.7", "CC7.2"] {
                let violation = Violation {
                    id: 0,
                    scan_id,
                    control_id: control_id.to_string(),
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
                let _ = queries::insert_violation(&conn, &violation);
            }
        }

        let filters = ViolationFilters {
            severity: None,
            control_id: Some(vec!["CC6.1".to_string()]),
            status: None,
        };

        let result = get_violations(scan_id, Some(filters)).await;
        assert!(result.is_ok());

        let violations = result.unwrap();
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].control_id, "CC6.1");
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_violations_filter_by_status() {
        let _guard = TestDbGuard::new();
        let project_id = create_test_project();
        let scan_id = create_test_scan(project_id);

        {
            let conn = db::get_connection();

            // Create violations with different statuses
            for (i, status) in ["open", "fixed", "dismissed"].iter().enumerate() {
                let violation = Violation {
                    id: 0,
                    scan_id,
                    control_id: "CC6.1".to_string(),
                    severity: "high".to_string(),
                    description: format!("Test {}", i),
                    file_path: "test.py".to_string(),
                    line_number: i as i64,
                    code_snippet: "code".to_string(),
                    status: status.to_string(),
                    detected_at: chrono::Utc::now().to_rfc3339(),
                    detection_method: "regex".to_string(),
                    confidence_score: None,
                    llm_reasoning: None,
                    regex_reasoning: None,
                function_name: None,
                class_name: None,
                };
                let _ = queries::insert_violation(&conn, &violation);
            }
        }

        let filters = ViolationFilters {
            severity: None,
            control_id: None,
            status: Some(vec!["open".to_string()]),
        };

        let result = get_violations(scan_id, Some(filters)).await;
        assert!(result.is_ok());

        let violations = result.unwrap();
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].status, "open");
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_violations_multiple_filters() {
        let _guard = TestDbGuard::new();
        let project_id = create_test_project();
        let scan_id = create_test_scan(project_id);

        {
            let conn = db::get_connection();

            // Create test violations
            let violation = Violation {
                id: 0,
                scan_id,
                control_id: "CC6.1".to_string(),
                severity: "critical".to_string(),
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
            let _ = queries::insert_violation(&conn, &violation);
        }

        let filters = ViolationFilters {
            severity: Some(vec!["critical".to_string()]),
            control_id: Some(vec!["CC6.1".to_string()]),
            status: Some(vec!["open".to_string()]),
        };

        let result = get_violations(scan_id, Some(filters)).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 1);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_violations_no_match_filters() {
        let _guard = TestDbGuard::new();
        let project_id = create_test_project();
        let scan_id = create_test_scan(project_id);
        let _v = create_test_violation(scan_id);

        let filters = ViolationFilters {
            severity: Some(vec!["low".to_string()]),
            control_id: None,
            status: None,
        };

        let result = get_violations(scan_id, Some(filters)).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }
}
