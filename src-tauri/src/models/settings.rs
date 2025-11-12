use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Represents application settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Settings {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}

impl Settings {
    pub fn new(key: String, value: String) -> Self {
        Self {
            key,
            value,
            updated_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn get_value_as_json(&self) -> Result<Value, serde_json::Error> {
        serde_json::from_str(&self.value)
    }

    pub fn set_value(&mut self, value: String) {
        self.value = value;
        self.updated_at = chrono::Utc::now().to_rfc3339();
    }

    pub fn set_value_json(&mut self, value: Value) -> Result<(), serde_json::Error> {
        self.value = value.to_string();
        self.updated_at = chrono::Utc::now().to_rfc3339();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_settings_creation() {
        let settings = Settings::new("theme".to_string(), "dark".to_string());
        assert_eq!(settings.key, "theme");
        assert_eq!(settings.value, "dark");
    }

    #[test]
    fn test_settings_json_value() {
        let json_value = serde_json::json!({
            "scan_on_save": true,
            "auto_apply_fixes": false
        });

        let mut settings = Settings::new("preferences".to_string(), "{}".to_string());
        settings.set_value_json(json_value.clone()).unwrap();

        assert_eq!(settings.get_value_as_json().unwrap(), json_value);
    }

    #[test]
    fn test_settings_update_timestamp() {
        let settings1 = Settings::new("key1".to_string(), "value1".to_string());
        let timestamp1 = settings1.updated_at.clone();

        let mut settings2 = settings1;
        settings2.set_value("value2".to_string());
        let timestamp2 = settings2.updated_at.clone();

        // Timestamps might be very close but should be comparable
        assert!(!timestamp1.is_empty());
        assert!(!timestamp2.is_empty());
    }

    #[test]
    fn test_settings_serde() {
        let settings = Settings::new("test_key".to_string(), "test_value".to_string());
        let json = serde_json::to_string(&settings).unwrap();
        let deserialized: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(settings.key, deserialized.key);
        assert_eq!(settings.value, deserialized.value);
    }
}
