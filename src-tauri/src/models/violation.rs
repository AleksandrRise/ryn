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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum DetectionMethod {
    #[serde(rename = "regex")]
    Regex,
    #[serde(rename = "llm")]
    Llm,
    #[serde(rename = "hybrid")]
    Hybrid,
}

impl DetectionMethod {
    pub fn as_str(&self) -> &'static str {
        match self {
            DetectionMethod::Regex => "regex",
            DetectionMethod::Llm => "llm",
            DetectionMethod::Hybrid => "hybrid",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "regex" => Some(DetectionMethod::Regex),
            "llm" => Some(DetectionMethod::Llm),
            "hybrid" => Some(DetectionMethod::Hybrid),
            _ => None,
        }
    }
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
    // Hybrid scanning fields (v2 schema)
    pub detection_method: String,
    pub confidence_score: Option<i64>,
    pub llm_reasoning: Option<String>,
    pub regex_reasoning: Option<String>,
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
            // Default to regex detection (backward compatible)
            detection_method: DetectionMethod::Regex.as_str().to_string(),
            confidence_score: None,
            llm_reasoning: None,
            regex_reasoning: None,
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

    pub fn get_detection_method(&self) -> Option<DetectionMethod> {
        DetectionMethod::from_str(&self.detection_method)
    }

    pub fn set_detection_method(&mut self, method: DetectionMethod) {
        self.detection_method = method.as_str().to_string();
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

    #[test]
    fn test_detection_method_as_str() {
        assert_eq!(DetectionMethod::Regex.as_str(), "regex");
        assert_eq!(DetectionMethod::Llm.as_str(), "llm");
        assert_eq!(DetectionMethod::Hybrid.as_str(), "hybrid");
    }

    #[test]
    fn test_detection_method_from_str() {
        assert_eq!(
            DetectionMethod::from_str("regex"),
            Some(DetectionMethod::Regex)
        );
        assert_eq!(DetectionMethod::from_str("llm"), Some(DetectionMethod::Llm));
        assert_eq!(
            DetectionMethod::from_str("hybrid"),
            Some(DetectionMethod::Hybrid)
        );
        assert_eq!(DetectionMethod::from_str("invalid"), None);
    }

    #[test]
    fn test_violation_default_detection_method() {
        let violation = Violation::new(
            1,
            "CC6.1".to_string(),
            Severity::High,
            "test".to_string(),
            "test.py".to_string(),
            1,
            "code".to_string(),
        );

        // New violations should default to regex detection
        assert_eq!(violation.detection_method, "regex");
        assert_eq!(
            violation.get_detection_method(),
            Some(DetectionMethod::Regex)
        );
        assert_eq!(violation.confidence_score, None);
        assert_eq!(violation.llm_reasoning, None);
        assert_eq!(violation.regex_reasoning, None);
    }

    #[test]
    fn test_violation_detection_method_getters_setters() {
        let mut violation = Violation::new(
            1,
            "CC6.1".to_string(),
            Severity::High,
            "test".to_string(),
            "test.py".to_string(),
            1,
            "code".to_string(),
        );

        // Test setting detection method to LLM
        violation.set_detection_method(DetectionMethod::Llm);
        assert_eq!(violation.detection_method, "llm");
        assert_eq!(violation.get_detection_method(), Some(DetectionMethod::Llm));

        // Test setting detection method to Hybrid
        violation.set_detection_method(DetectionMethod::Hybrid);
        assert_eq!(violation.detection_method, "hybrid");
        assert_eq!(
            violation.get_detection_method(),
            Some(DetectionMethod::Hybrid)
        );
    }

    #[test]
    fn test_violation_with_llm_fields() {
        let mut violation = Violation::new(
            1,
            "CC7.2".to_string(),
            Severity::Medium,
            "Missing audit log".to_string(),
            "app/auth.py".to_string(),
            42,
            "def delete_user(user_id):".to_string(),
        );

        // Simulate LLM detection
        violation.set_detection_method(DetectionMethod::Llm);
        violation.confidence_score = Some(85);
        violation.llm_reasoning = Some(
            "This function modifies sensitive data without logging the action for audit purposes."
                .to_string(),
        );

        assert_eq!(violation.detection_method, "llm");
        assert_eq!(violation.confidence_score, Some(85));
        assert!(violation.llm_reasoning.is_some());
        assert_eq!(violation.regex_reasoning, None);
    }

    #[test]
    fn test_violation_hybrid_detection() {
        let mut violation = Violation::new(
            1,
            "CC6.7".to_string(),
            Severity::Critical,
            "Hardcoded secret".to_string(),
            "config/settings.py".to_string(),
            10,
            "API_KEY = 'sk-1234567890abcdef'".to_string(),
        );

        // Simulate hybrid detection (both regex and LLM found it)
        violation.set_detection_method(DetectionMethod::Hybrid);
        violation.confidence_score = Some(95);
        violation.llm_reasoning = Some(
            "API key appears to be a production credential that should be externalized."
                .to_string(),
        );
        violation.regex_reasoning =
            Some("Matched pattern: API_KEY = '[a-z0-9-]+'".to_string());

        assert_eq!(violation.detection_method, "hybrid");
        assert_eq!(
            violation.get_detection_method(),
            Some(DetectionMethod::Hybrid)
        );
        assert_eq!(violation.confidence_score, Some(95));
        assert!(violation.llm_reasoning.is_some());
        assert!(violation.regex_reasoning.is_some());
    }

    #[test]
    fn test_violation_serde_with_hybrid_fields() {
        let mut violation = Violation::new(
            1,
            "CC6.1".to_string(),
            Severity::High,
            "test".to_string(),
            "test.py".to_string(),
            1,
            "code".to_string(),
        );

        violation.set_detection_method(DetectionMethod::Llm);
        violation.confidence_score = Some(80);
        violation.llm_reasoning = Some("AI detected issue".to_string());

        let json = serde_json::to_string(&violation).unwrap();
        let deserialized: Violation = serde_json::from_str(&json).unwrap();

        assert_eq!(violation, deserialized);
        assert_eq!(deserialized.detection_method, "llm");
        assert_eq!(deserialized.confidence_score, Some(80));
        assert_eq!(
            deserialized.llm_reasoning,
            Some("AI detected issue".to_string())
        );
    }
}
