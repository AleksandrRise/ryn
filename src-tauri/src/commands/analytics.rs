//! Analytics commands for cost tracking and reporting
//!
//! Handles fetching and aggregating scan cost data for the analytics dashboard

use crate::db::{self, queries};
use crate::models::ScanCost;
use serde::{Deserialize, Serialize};

/// Time range for analytics queries
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimeRange {
    #[serde(rename = "24h")]
    TwentyFourHours,
    #[serde(rename = "7d")]
    SevenDays,
    #[serde(rename = "30d")]
    ThirtyDays,
    #[serde(rename = "all")]
    All,
}

impl TimeRange {
    /// Convert time range to RFC3339 timestamp string
    /// Returns the timestamp from which to start fetching data
    pub fn to_timestamp(&self) -> Option<String> {
        let now = chrono::Utc::now();
        let since = match self {
            TimeRange::TwentyFourHours => now - chrono::Duration::hours(24),
            TimeRange::SevenDays => now - chrono::Duration::days(7),
            TimeRange::ThirtyDays => now - chrono::Duration::days(30),
            TimeRange::All => return None, // No filter for "all"
        };
        Some(since.to_rfc3339())
    }
}

/// Get scan costs for a given time range
///
/// # Arguments
/// * `time_range` - Time period to fetch costs for: "24h", "7d", "30d", or "all"
///
/// Returns: List of ScanCost records sorted by created_at DESC
#[tauri::command]
pub async fn get_scan_costs(time_range: TimeRange) -> Result<Vec<ScanCost>, String> {
    let conn = db::get_connection();

    let scan_costs = match time_range.to_timestamp() {
        Some(since) => {
            // Fetch costs since the timestamp
            queries::select_scan_costs_since(&conn, &since)
                .map_err(|e| format!("Failed to fetch scan costs since {}: {}", since, e))?
        }
        None => {
            // Fetch all costs
            queries::select_all_scan_costs(&conn)
                .map_err(|e| format!("Failed to fetch all scan costs: {}", e))?
        }
    };

    Ok(scan_costs)
}

/// Get cost details for a specific scan
///
/// # Arguments
/// * `scan_id` - ID of the scan to fetch cost for
///
/// Returns: ScanCost record if it exists, or None
#[tauri::command]
pub async fn get_scan_cost(scan_id: i64) -> Result<Option<ScanCost>, String> {
    let conn = db::get_connection();

    let scan_cost = queries::select_scan_cost_by_scan_id(&conn, scan_id)
        .map_err(|e| format!("Failed to fetch scan cost for scan {}: {}", scan_id, e))?;

    Ok(scan_cost)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::TestDbGuard;
    use crate::models::ScanCost;

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_scan_costs_empty() {
        let _guard = TestDbGuard::new();
        let result = get_scan_costs(TimeRange::All).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_scan_costs_all() {
        let _guard = TestDbGuard::new();

        let scan_id = {
            let conn = db::get_connection();

            // Create parent project and scan first (required for foreign key constraint)
            let project_id = queries::insert_project(&conn, "Test Project", "/tmp/test", None).unwrap();
            let scan_id = queries::insert_scan(&conn, project_id).unwrap();

            // Create a scan cost record
            let scan_cost = ScanCost::new(scan_id, 10, 10_000, 2_000, 5_000, 3_000);
            queries::insert_scan_cost(&conn, &scan_cost).unwrap();

            scan_id
        }; // MutexGuard dropped here

        let result = get_scan_costs(TimeRange::All).await;
        assert!(result.is_ok());
        let costs = result.unwrap();
        assert_eq!(costs.len(), 1);
        assert_eq!(costs[0].scan_id, scan_id);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_scan_costs_24h() {
        let _guard = TestDbGuard::new();

        let scan_id_1 = {
            let conn = db::get_connection();

            // Create parent project and scans first (required for foreign key constraint)
            let project_id = queries::insert_project(&conn, "Test Project", "/tmp/test", None).unwrap();
            let scan_id_1 = queries::insert_scan(&conn, project_id).unwrap();
            let scan_id_2 = queries::insert_scan(&conn, project_id).unwrap();

            // Create a recent scan cost (within 24h)
            let recent_cost = ScanCost::new(scan_id_1, 10, 10_000, 2_000, 0, 0);
            queries::insert_scan_cost(&conn, &recent_cost).unwrap();

            // Create an old scan cost (older than 24h)
            let mut old_cost = ScanCost::new(scan_id_2, 5, 5_000, 1_000, 0, 0);
            old_cost.created_at = (chrono::Utc::now() - chrono::Duration::days(2)).to_rfc3339();
            queries::insert_scan_cost(&conn, &old_cost).unwrap();

            scan_id_1
        }; // MutexGuard dropped here

        let result = get_scan_costs(TimeRange::TwentyFourHours).await;
        assert!(result.is_ok());
        let costs = result.unwrap();

        // Should only get the recent one
        assert_eq!(costs.len(), 1);
        assert_eq!(costs[0].scan_id, scan_id_1);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_scan_costs_7d() {
        let _guard = TestDbGuard::new();

        {
            let conn = db::get_connection();

            // Create parent project and scans first (required for foreign key constraint)
            let project_id = queries::insert_project(&conn, "Test Project", "/tmp/test", None).unwrap();
            let scan_id_1 = queries::insert_scan(&conn, project_id).unwrap();
            let scan_id_2 = queries::insert_scan(&conn, project_id).unwrap();
            let scan_id_3 = queries::insert_scan(&conn, project_id).unwrap();

            // Create costs at different times
            let recent = ScanCost::new(scan_id_1, 10, 10_000, 2_000, 0, 0);
            queries::insert_scan_cost(&conn, &recent).unwrap();

            let mut week_old = ScanCost::new(scan_id_2, 5, 5_000, 1_000, 0, 0);
            week_old.created_at = (chrono::Utc::now() - chrono::Duration::days(5)).to_rfc3339();
            queries::insert_scan_cost(&conn, &week_old).unwrap();

            let mut month_old = ScanCost::new(scan_id_3, 3, 3_000, 500, 0, 0);
            month_old.created_at = (chrono::Utc::now() - chrono::Duration::days(20)).to_rfc3339();
            queries::insert_scan_cost(&conn, &month_old).unwrap();
        }; // MutexGuard dropped here

        let result = get_scan_costs(TimeRange::SevenDays).await;
        assert!(result.is_ok());
        let costs = result.unwrap();

        // Should get both recent and week_old, but not month_old
        assert_eq!(costs.len(), 2);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_scan_costs_30d() {
        let _guard = TestDbGuard::new();

        {
            let conn = db::get_connection();

            // Create parent project and scans first (required for foreign key constraint)
            let project_id = queries::insert_project(&conn, "Test Project", "/tmp/test", None).unwrap();
            let scan_id_1 = queries::insert_scan(&conn, project_id).unwrap();
            let scan_id_2 = queries::insert_scan(&conn, project_id).unwrap();

            // Create costs at different times
            let recent = ScanCost::new(scan_id_1, 10, 10_000, 2_000, 0, 0);
            queries::insert_scan_cost(&conn, &recent).unwrap();

            let mut month_old = ScanCost::new(scan_id_2, 5, 5_000, 1_000, 0, 0);
            month_old.created_at = (chrono::Utc::now() - chrono::Duration::days(20)).to_rfc3339();
            queries::insert_scan_cost(&conn, &month_old).unwrap();
        }; // MutexGuard dropped here

        let result = get_scan_costs(TimeRange::ThirtyDays).await;
        assert!(result.is_ok());
        let costs = result.unwrap();

        // Should get both
        assert_eq!(costs.len(), 2);
    }

    #[test]
    fn test_time_range_to_timestamp() {
        let now = chrono::Utc::now();

        // All should return None
        assert!(TimeRange::All.to_timestamp().is_none());

        // Others should return Some timestamp
        let ts_24h = TimeRange::TwentyFourHours.to_timestamp();
        assert!(ts_24h.is_some());

        // Parse the timestamp to verify it's valid
        let parsed = chrono::DateTime::parse_from_rfc3339(&ts_24h.unwrap()).unwrap();
        let diff = now.signed_duration_since(parsed);

        // Should be approximately 24 hours ago (allow 1 minute tolerance for test execution)
        assert!(diff.num_hours() >= 23 && diff.num_hours() <= 24);
    }

    #[test]
    fn test_time_range_deserialization() {
        let json_24h = r#""24h""#;
        let time_range: TimeRange = serde_json::from_str(json_24h).unwrap();
        assert!(matches!(time_range, TimeRange::TwentyFourHours));

        let json_7d = r#""7d""#;
        let time_range: TimeRange = serde_json::from_str(json_7d).unwrap();
        assert!(matches!(time_range, TimeRange::SevenDays));

        let json_30d = r#""30d""#;
        let time_range: TimeRange = serde_json::from_str(json_30d).unwrap();
        assert!(matches!(time_range, TimeRange::ThirtyDays));

        let json_all = r#""all""#;
        let time_range: TimeRange = serde_json::from_str(json_all).unwrap();
        assert!(matches!(time_range, TimeRange::All));
    }
}
