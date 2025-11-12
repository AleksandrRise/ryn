use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    #[serde(rename = "critical")]
    Critical,
    #[serde(rename = "high")]
    High,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "low")]
    Low,
}

impl Severity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Severity::Critical => "critical",
            Severity::High => "high",
            Severity::Medium => "medium",
            Severity::Low => "low",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "critical" => Some(Severity::Critical),
            "high" => Some(Severity::High),
            "medium" => Some(Severity::Medium),
            "low" => Some(Severity::Low),
            _ => None,
        }
    }

    pub fn numeric_value(&self) -> i32 {
        match self {
            Severity::Critical => 4,
            Severity::High => 3,
            Severity::Medium => 2,
            Severity::Low => 1,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ViolationStatus {
    #[serde(rename = "open")]
    Open,
    #[serde(rename = "fixed")]
    Fixed,
    #[serde(rename = "dismissed")]
    Dismissed,
}

impl ViolationStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ViolationStatus::Open => "open",
            ViolationStatus::Fixed => "fixed",
            ViolationStatus::Dismissed => "dismissed",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "open" => Some(ViolationStatus::Open),
            "fixed" => Some(ViolationStatus::Fixed),
            "dismissed" => Some(ViolationStatus::Dismissed),
            _ => None,
        }
    }
}

/// Represents a SOC 2 compliance violation found in code
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Violation {
    pub id: i64,
    pub scan_id: i64,
    pub control_id: String,
    pub severity: String,
    pub description: String,
    pub file_path: String,
    pub line_number: i64,
    pub code_snippet: String,
    pub status: String,
    pub detected_at: String,
}

impl Violation {
    pub fn new(
        scan_id: i64,
        control_id: String,
        severity: Severity,
        description: String,
        file_path: String,
        line_number: i64,
        code_snippet: String,
    ) -> Self {
        Self {
            id: 0,
            scan_id,
            control_id,
            severity: severity.as_str().to_string(),
            description,
            file_path,
            line_number,
            code_snippet,
            status: ViolationStatus::Open.as_str().to_string(),
            detected_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn get_severity(&self) -> Option<Severity> {
        Severity::from_str(&self.severity)
    }

    pub fn set_severity(&mut self, severity: Severity) {
        self.severity = severity.as_str().to_string();
    }

    pub fn get_status(&self) -> Option<ViolationStatus> {
        ViolationStatus::from_str(&self.status)
    }

    pub fn set_status(&mut self, status: ViolationStatus) {
        self.status = status.as_str().to_string();
    }

    pub fn dismiss(mut self) -> Self {
        self.set_status(ViolationStatus::Dismissed);
        self
    }

    pub fn fix(mut self) -> Self {
        self.set_status(ViolationStatus::Fixed);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_severity_as_str() {
        assert_eq!(Severity::Critical.as_str(), "critical");
        assert_eq!(Severity::High.as_str(), "high");
        assert_eq!(Severity::Medium.as_str(), "medium");
        assert_eq!(Severity::Low.as_str(), "low");
    }

    #[test]
    fn test_severity_from_str() {
        assert_eq!(Severity::from_str("critical"), Some(Severity::Critical));
        assert_eq!(Severity::from_str("high"), Some(Severity::High));
        assert_eq!(Severity::from_str("medium"), Some(Severity::Medium));
        assert_eq!(Severity::from_str("low"), Some(Severity::Low));
        assert_eq!(Severity::from_str("invalid"), None);
    }

    #[test]
    fn test_severity_numeric_value() {
        assert_eq!(Severity::Critical.numeric_value(), 4);
        assert_eq!(Severity::High.numeric_value(), 3);
        assert_eq!(Severity::Medium.numeric_value(), 2);
        assert_eq!(Severity::Low.numeric_value(), 1);
    }

    #[test]
    fn test_severity_ordering() {
        assert!(Severity::Critical.numeric_value() > Severity::High.numeric_value());
        assert!(Severity::High.numeric_value() > Severity::Medium.numeric_value());
        assert!(Severity::Medium.numeric_value() > Severity::Low.numeric_value());
    }

    #[test]
    fn test_violation_status_as_str() {
        assert_eq!(ViolationStatus::Open.as_str(), "open");
        assert_eq!(ViolationStatus::Fixed.as_str(), "fixed");
        assert_eq!(ViolationStatus::Dismissed.as_str(), "dismissed");
    }

    #[test]
    fn test_violation_status_from_str() {
        assert_eq!(ViolationStatus::from_str("open"), Some(ViolationStatus::Open));
        assert_eq!(ViolationStatus::from_str("fixed"), Some(ViolationStatus::Fixed));
        assert_eq!(
            ViolationStatus::from_str("dismissed"),
            Some(ViolationStatus::Dismissed)
        );
        assert_eq!(ViolationStatus::from_str("invalid"), None);
    }

    #[test]
    fn test_violation_creation() {
        let violation = Violation::new(
            1,
            "CC6.1".to_string(),
            Severity::Critical,
            "Missing authentication".to_string(),
            "app/views.py".to_string(),
            42,
            "def get_user(id):".to_string(),
        );

        assert_eq!(violation.scan_id, 1);
        assert_eq!(violation.control_id, "CC6.1");
        assert_eq!(violation.severity, "critical");
        assert_eq!(violation.status, "open");
        assert_eq!(violation.line_number, 42);
    }

    #[test]
    fn test_violation_status_transitions() {
        let violation = Violation::new(
            1,
            "CC6.1".to_string(),
            Severity::High,
            "test".to_string(),
            "test.py".to_string(),
            1,
            "code".to_string(),
        );

        assert_eq!(violation.get_status(), Some(ViolationStatus::Open));

        let dismissed = violation.clone().dismiss();
        assert_eq!(dismissed.get_status(), Some(ViolationStatus::Dismissed));

        let fixed = violation.fix();
        assert_eq!(fixed.get_status(), Some(ViolationStatus::Fixed));
    }

    #[test]
    fn test_violation_serde() {
        let violation = Violation::new(
            1,
            "CC6.1".to_string(),
            Severity::High,
            "test".to_string(),
            "test.py".to_string(),
            1,
            "code".to_string(),
        );
        let json = serde_json::to_string(&violation).unwrap();
        let deserialized: Violation = serde_json::from_str(&json).unwrap();
        assert_eq!(violation, deserialized);
    }
}
