use serde::{Deserialize, Serialize};

/// Represents a SOC 2 compliance control
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Control {
    pub id: String,
    pub name: String,
    pub description: String,
    pub requirement: String,
    pub category: String,
}

impl Control {
    pub fn new(
        id: String,
        name: String,
        description: String,
        requirement: String,
        category: String,
    ) -> Self {
        Self {
            id,
            name,
            description,
            requirement,
            category,
        }
    }

    /// SOC 2 CC6.1 - Access Control
    pub fn cc6_1() -> Self {
        Self::new(
            "CC6.1".to_string(),
            "Logical Access Controls".to_string(),
            "The organization restricts logical access to facilities and systems containing or supporting sensitive information by validating user identity and authenticating access requests appropriately.".to_string(),
            "Implement authentication decorators and RBAC checks on sensitive operations.".to_string(),
            "CC6 - Access Control".to_string(),
        )
    }

    /// SOC 2 CC6.7 - Cryptography
    pub fn cc6_7() -> Self {
        Self::new(
            "CC6.7".to_string(),
            "Cryptography - Encryption and Secrets".to_string(),
            "The organization protects sensitive information during transmission and storage through encryption, preventing exposure of secrets and enforcing TLS for external communication.".to_string(),
            "No hardcoded secrets, move to environment variables, enforce HTTPS/TLS.".to_string(),
            "CC6 - Access Control".to_string(),
        )
    }

    /// SOC 2 CC7.2 - System Monitoring
    pub fn cc7_2() -> Self {
        Self::new(
            "CC7.2".to_string(),
            "Monitoring and Logging".to_string(),
            "The organization monitors information systems and related assets for anomalies and logs security-relevant events including user activity, system access, and configuration changes.".to_string(),
            "Implement audit logging on sensitive operations, prevent logging of sensitive data.".to_string(),
            "CC7 - System Monitoring".to_string(),
        )
    }

    /// SOC 2 A1.2 - Resilience
    pub fn a1_2() -> Self {
        Self::new(
            "A1.2".to_string(),
            "Resilience and Error Handling".to_string(),
            "The organization maintains system resilience through proper error handling, retry logic, and circuit breaker patterns on external dependencies.".to_string(),
            "Add try/catch blocks, implement retry logic with exponential backoff, use circuit breakers.".to_string(),
            "A1 - Service Availability".to_string(),
        )
    }

    pub fn all_controls() -> Vec<Self> {
        vec![
            Control::cc6_1(),
            Control::cc6_7(),
            Control::cc7_2(),
            Control::a1_2(),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_control_creation() {
        let control = Control::new(
            "TEST.1".to_string(),
            "Test Control".to_string(),
            "Test Description".to_string(),
            "Test Requirement".to_string(),
            "Test Category".to_string(),
        );

        assert_eq!(control.id, "TEST.1");
        assert_eq!(control.name, "Test Control");
    }

    #[test]
    fn test_cc6_1_control() {
        let cc6_1 = Control::cc6_1();
        assert_eq!(cc6_1.id, "CC6.1");
        assert!(cc6_1.name.contains("Access"));
        assert!(cc6_1.category.contains("CC6"));
    }

    #[test]
    fn test_cc6_7_control() {
        let cc6_7 = Control::cc6_7();
        assert_eq!(cc6_7.id, "CC6.7");
        assert!(cc6_7.name.contains("Cryptography"));
        assert!(cc6_7.description.contains("encryption"));
    }

    #[test]
    fn test_cc7_2_control() {
        let cc7_2 = Control::cc7_2();
        assert_eq!(cc7_2.id, "CC7.2");
        assert!(cc7_2.name.contains("Monitoring"));
        assert!(cc7_2.description.contains("logs"));
    }

    #[test]
    fn test_a1_2_control() {
        let a1_2 = Control::a1_2();
        assert_eq!(a1_2.id, "A1.2");
        assert!(a1_2.name.contains("Resilience"));
        assert!(a1_2.description.contains("error handling"));
    }

    #[test]
    fn test_all_controls() {
        let controls = Control::all_controls();
        assert_eq!(controls.len(), 4);

        let ids: Vec<String> = controls.iter().map(|c| c.id.clone()).collect();
        assert!(ids.contains(&"CC6.1".to_string()));
        assert!(ids.contains(&"CC6.7".to_string()));
        assert!(ids.contains(&"CC7.2".to_string()));
        assert!(ids.contains(&"A1.2".to_string()));
    }

    #[test]
    fn test_control_serde() {
        let control = Control::cc6_1();
        let json = serde_json::to_string(&control).unwrap();
        let deserialized: Control = serde_json::from_str(&json).unwrap();
        assert_eq!(control, deserialized);
    }
}
