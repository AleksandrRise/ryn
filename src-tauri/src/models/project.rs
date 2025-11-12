use serde::{Deserialize, Serialize};

/// Represents a scanned project
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub path: String,
    pub framework: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl Project {
    pub fn new(name: String, path: String) -> Self {
        Self {
            id: 0,
            name,
            path,
            framework: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn with_framework(mut self, framework: String) -> Self {
        self.framework = Some(framework);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_creation() {
        let project = Project::new("my-app".to_string(), "/path/to/app".to_string());
        assert_eq!(project.name, "my-app");
        assert_eq!(project.path, "/path/to/app");
        assert_eq!(project.framework, None);
    }

    #[test]
    fn test_project_with_framework() {
        let project = Project::new("my-app".to_string(), "/path/to/app".to_string())
            .with_framework("Django".to_string());
        assert_eq!(project.framework, Some("Django".to_string()));
    }

    #[test]
    fn test_project_serde() {
        let project = Project::new("test".to_string(), "/path".to_string());
        let json = serde_json::to_string(&project).unwrap();
        let deserialized: Project = serde_json::from_str(&json).unwrap();
        assert_eq!(project, deserialized);
    }
}
