use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum TrustLevel {
    #[serde(rename = "auto")]
    Auto,
    #[serde(rename = "review")]
    Review,
    #[serde(rename = "manual")]
    Manual,
}

impl TrustLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            TrustLevel::Auto => "auto",
            TrustLevel::Review => "review",
            TrustLevel::Manual => "manual",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "auto" => Some(TrustLevel::Auto),
            "review" => Some(TrustLevel::Review),
            "manual" => Some(TrustLevel::Manual),
            _ => None,
        }
    }
}

/// Represents an AI-generated fix for a violation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Fix {
    pub id: i64,
    pub violation_id: i64,
    pub original_code: String,
    pub fixed_code: String,
    pub explanation: String,
    pub trust_level: String,
    pub applied_at: Option<String>,
    pub applied_by: String,
    pub git_commit_sha: Option<String>,
    pub backup_path: Option<String>,
}

impl Fix {
    pub fn new(
        violation_id: i64,
        original_code: String,
        fixed_code: String,
        explanation: String,
        trust_level: TrustLevel,
    ) -> Self {
        Self {
            id: 0,
            violation_id,
            original_code,
            fixed_code,
            explanation,
            trust_level: trust_level.as_str().to_string(),
            applied_at: None,
            applied_by: "ryn-ai".to_string(),
            git_commit_sha: None,
            backup_path: None,
        }
    }

    pub fn get_trust_level(&self) -> Option<TrustLevel> {
        TrustLevel::from_str(&self.trust_level)
    }

    pub fn set_trust_level(&mut self, level: TrustLevel) {
        self.trust_level = level.as_str().to_string();
    }

    pub fn apply(mut self, git_commit_sha: String, backup_path: Option<String>) -> Self {
        self.applied_at = Some(chrono::Utc::now().to_rfc3339());
        self.git_commit_sha = Some(git_commit_sha);
        self.backup_path = backup_path;
        self
    }

    pub fn is_applied(&self) -> bool {
        self.applied_at.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trust_level_as_str() {
        assert_eq!(TrustLevel::Auto.as_str(), "auto");
        assert_eq!(TrustLevel::Review.as_str(), "review");
        assert_eq!(TrustLevel::Manual.as_str(), "manual");
    }

    #[test]
    fn test_trust_level_from_str() {
        assert_eq!(TrustLevel::from_str("auto"), Some(TrustLevel::Auto));
        assert_eq!(TrustLevel::from_str("review"), Some(TrustLevel::Review));
        assert_eq!(TrustLevel::from_str("manual"), Some(TrustLevel::Manual));
        assert_eq!(TrustLevel::from_str("invalid"), None);
    }

    #[test]
    fn test_fix_creation() {
        let fix = Fix::new(
            1,
            "def get_user(id):".to_string(),
            "@login_required\ndef get_user(id):".to_string(),
            "Added authentication check".to_string(),
            TrustLevel::Review,
        );

        assert_eq!(fix.violation_id, 1);
        assert_eq!(fix.trust_level, "review");
        assert_eq!(fix.applied_by, "ryn-ai");
        assert_eq!(fix.applied_at, None);
        assert!(!fix.is_applied());
    }

    #[test]
    fn test_fix_apply() {
        let fix = Fix::new(
            1,
            "old".to_string(),
            "new".to_string(),
            "test".to_string(),
            TrustLevel::Auto,
        );

        assert!(!fix.is_applied());

        let applied = fix.apply("abc123".to_string(), Some("/backup/file.py".to_string()));
        assert!(applied.is_applied());
        assert_eq!(applied.git_commit_sha, Some("abc123".to_string()));
        assert_eq!(applied.backup_path, Some("/backup/file.py".to_string()));
        assert!(applied.applied_at.is_some());
    }

    #[test]
    fn test_fix_serde() {
        let fix = Fix::new(
            1,
            "old".to_string(),
            "new".to_string(),
            "test".to_string(),
            TrustLevel::Manual,
        );
        let json = serde_json::to_string(&fix).unwrap();
        let deserialized: Fix = serde_json::from_str(&json).unwrap();
        assert_eq!(fix, deserialized);
    }
}
