use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventType {
    #[serde(rename = "scan")]
    Scan,
    #[serde(rename = "violation")]
    Violation,
    #[serde(rename = "fix")]
    Fix,
    #[serde(rename = "project_selected")]
    ProjectSelected,
    #[serde(rename = "settings_changed")]
    SettingsChanged,
}

impl AuditEventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            AuditEventType::Scan => "scan",
            AuditEventType::Violation => "violation",
            AuditEventType::Fix => "fix",
            AuditEventType::ProjectSelected => "project_selected",
            AuditEventType::SettingsChanged => "settings_changed",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "scan" => Some(AuditEventType::Scan),
            "violation" => Some(AuditEventType::Violation),
            "fix" => Some(AuditEventType::Fix),
            "project_selected" => Some(AuditEventType::ProjectSelected),
            "settings_changed" => Some(AuditEventType::SettingsChanged),
            _ => None,
        }
    }
}

/// Represents an audit trail event
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AuditEvent {
    pub id: i64,
    pub event_type: String,
    pub project_id: Option<i64>,
    pub violation_id: Option<i64>,
    pub fix_id: Option<i64>,
    pub description: String,
    pub metadata: Option<String>,
    pub created_at: String,
}

impl AuditEvent {
    pub fn new(event_type: AuditEventType, description: String) -> Self {
        Self {
            id: 0,
            event_type: event_type.as_str().to_string(),
            project_id: None,
            violation_id: None,
            fix_id: None,
            description,
            metadata: None,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn get_event_type(&self) -> Option<AuditEventType> {
        AuditEventType::from_str(&self.event_type)
    }

    pub fn with_project_id(mut self, project_id: i64) -> Self {
        self.project_id = Some(project_id);
        self
    }

    pub fn with_violation_id(mut self, violation_id: i64) -> Self {
        self.violation_id = Some(violation_id);
        self
    }

    pub fn with_fix_id(mut self, fix_id: i64) -> Self {
        self.fix_id = Some(fix_id);
        self
    }

    pub fn with_metadata(mut self, metadata: Value) -> Self {
        self.metadata = Some(metadata.to_string());
        self
    }

    pub fn get_metadata(&self) -> Option<Value> {
        self.metadata
            .as_ref()
            .and_then(|m| serde_json::from_str(m).ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_event_type_as_str() {
        assert_eq!(AuditEventType::Scan.as_str(), "scan");
        assert_eq!(AuditEventType::Violation.as_str(), "violation");
        assert_eq!(AuditEventType::Fix.as_str(), "fix");
        assert_eq!(AuditEventType::ProjectSelected.as_str(), "project_selected");
        assert_eq!(AuditEventType::SettingsChanged.as_str(), "settings_changed");
    }

    #[test]
    fn test_audit_event_type_from_str() {
        assert_eq!(AuditEventType::from_str("scan"), Some(AuditEventType::Scan));
        assert_eq!(
            AuditEventType::from_str("violation"),
            Some(AuditEventType::Violation)
        );
        assert_eq!(AuditEventType::from_str("fix"), Some(AuditEventType::Fix));
        assert_eq!(
            AuditEventType::from_str("project_selected"),
            Some(AuditEventType::ProjectSelected)
        );
        assert_eq!(
            AuditEventType::from_str("settings_changed"),
            Some(AuditEventType::SettingsChanged)
        );
        assert_eq!(AuditEventType::from_str("invalid"), None);
    }

    #[test]
    fn test_audit_event_creation() {
        let event = AuditEvent::new(AuditEventType::Scan, "Scan started".to_string());
        assert_eq!(event.event_type, "scan");
        assert_eq!(event.description, "Scan started");
        assert_eq!(event.project_id, None);
        assert_eq!(event.violation_id, None);
        assert_eq!(event.fix_id, None);
    }

    #[test]
    fn test_audit_event_with_ids() {
        let event = AuditEvent::new(AuditEventType::Fix, "Fix applied".to_string())
            .with_project_id(1)
            .with_violation_id(5)
            .with_fix_id(10);

        assert_eq!(event.project_id, Some(1));
        assert_eq!(event.violation_id, Some(5));
        assert_eq!(event.fix_id, Some(10));
    }

    #[test]
    fn test_audit_event_with_metadata() {
        let metadata = serde_json::json!({
            "scan_duration": 5.2,
            "files_scanned": 142
        });

        let event = AuditEvent::new(AuditEventType::Scan, "Scan completed".to_string())
            .with_metadata(metadata.clone());

        assert_eq!(event.get_metadata(), Some(metadata));
    }

    #[test]
    fn test_audit_event_serde() {
        let event = AuditEvent::new(AuditEventType::Violation, "Violation detected".to_string())
            .with_project_id(1);
        let json = serde_json::to_string(&event).unwrap();
        let deserialized: AuditEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(event, deserialized);
    }
}
