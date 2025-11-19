use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ScanStatus {
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "failed")]
    Failed,
}

impl ScanStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ScanStatus::Running => "running",
            ScanStatus::Completed => "completed",
            ScanStatus::Failed => "failed",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "running" => Some(ScanStatus::Running),
            "completed" => Some(ScanStatus::Completed),
            "failed" => Some(ScanStatus::Failed),
            _ => None,
        }
    }
}

/// Represents a code scan execution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Scan {
    pub id: i64,
    pub project_id: i64,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub files_scanned: i32,
    pub total_files: i32,
    pub violations_found: i32,
    pub status: String,
    pub critical_count: i32,
    pub high_count: i32,
    pub medium_count: i32,
    pub low_count: i32,
    pub scan_mode: String,
}

impl Scan {
    pub fn new(project_id: i64) -> Self {
        Self::new_with_mode(project_id, "regex_only")
    }

    pub fn new_with_mode(project_id: i64, scan_mode: &str) -> Self {
        Self {
            id: 0,
            project_id,
            started_at: chrono::Utc::now().to_rfc3339(),
            completed_at: None,
            files_scanned: 0,
            total_files: 0,
            violations_found: 0,
            status: ScanStatus::Running.as_str().to_string(),
            critical_count: 0,
            high_count: 0,
            medium_count: 0,
            low_count: 0,
            scan_mode: scan_mode.to_string(),
        }
    }

    pub fn get_status(&self) -> Option<ScanStatus> {
        ScanStatus::from_str(&self.status)
    }

    pub fn set_status(&mut self, status: ScanStatus) {
        self.status = status.as_str().to_string();
    }

    pub fn complete(mut self) -> Self {
        self.completed_at = Some(chrono::Utc::now().to_rfc3339());
        self.set_status(ScanStatus::Completed);
        self
    }

    pub fn fail(mut self) -> Self {
        self.completed_at = Some(chrono::Utc::now().to_rfc3339());
        self.set_status(ScanStatus::Failed);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_status_as_str() {
        assert_eq!(ScanStatus::Running.as_str(), "running");
        assert_eq!(ScanStatus::Completed.as_str(), "completed");
        assert_eq!(ScanStatus::Failed.as_str(), "failed");
    }

    #[test]
    fn test_scan_status_from_str() {
        assert_eq!(ScanStatus::from_str("running"), Some(ScanStatus::Running));
        assert_eq!(ScanStatus::from_str("completed"), Some(ScanStatus::Completed));
        assert_eq!(ScanStatus::from_str("failed"), Some(ScanStatus::Failed));
        assert_eq!(ScanStatus::from_str("invalid"), None);
    }

    #[test]
    fn test_scan_creation() {
        let scan = Scan::new(1);
        assert_eq!(scan.project_id, 1);
        assert_eq!(scan.status, "running");
        assert_eq!(scan.files_scanned, 0);
        assert_eq!(scan.violations_found, 0);
        assert_eq!(scan.completed_at, None);
    }

    #[test]
    fn test_scan_status_transitions() {
        let scan = Scan::new(1);
        assert_eq!(scan.get_status(), Some(ScanStatus::Running));

        let completed = scan.clone().complete();
        assert_eq!(completed.get_status(), Some(ScanStatus::Completed));
        assert!(completed.completed_at.is_some());

        let failed = Scan::new(1).fail();
        assert_eq!(failed.get_status(), Some(ScanStatus::Failed));
        assert!(failed.completed_at.is_some());
    }

    #[test]
    fn test_scan_serde() {
        let scan = Scan::new(1);
        let json = serde_json::to_string(&scan).unwrap();
        let deserialized: Scan = serde_json::from_str(&json).unwrap();
        assert_eq!(scan, deserialized);
    }
}
