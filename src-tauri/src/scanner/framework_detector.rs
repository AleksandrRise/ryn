//! Framework detection module
//!
//! Detects the web framework of a project by analyzing:
//! - File names and patterns (manage.py, package.json, etc.)
//! - Package manager files (requirements.txt, package.json)
//! - Source code imports and patterns
//!
//! Supports: Django, Flask, Express, Next.js, React

use anyhow::{anyhow, Context, Result};
use std::path::Path;

/// Framework detector for identifying project frameworks
pub struct FrameworkDetector;

impl FrameworkDetector {
    /// Detect framework from project directory
    ///
    /// # Arguments
    /// * `project_path` - Path to the project root directory
    ///
    /// # Returns
    /// * `Ok(Some(framework))` if a framework is detected
    /// * `Ok(None)` if no framework is detected
    /// * `Err(...)` if an error occurs reading files
    ///
    /// # Detection Priority
    /// 1. Django (manage.py, settings.py, requirements.txt)
    /// 2. Flask (app.py, routes.py, requirements.txt)
    /// 3. Next.js (package.json with next and react)
    /// 4. Express (package.json with express)
    /// 5. React (package.json with react, but no next)
    pub fn detect_framework(project_path: &Path) -> Result<Option<String>> {
        // Ensure project_path exists
        if !project_path.exists() {
            return Err(anyhow!("Project path does not exist: {:?}", project_path));
        }

        // Check Django
        if Self::is_django(project_path)? {
            return Ok(Some("django".to_string()));
        }

        // Check Flask
        if Self::is_flask(project_path)? {
            return Ok(Some("flask".to_string()));
        }

        // Check Next.js and Express/React from package.json
        if let Ok(package_json_content) = Self::read_package_json(project_path) {
            // Check for Next.js (requires both next and react)
            if Self::has_in_dependencies(&package_json_content, "next")
                && Self::has_in_dependencies(&package_json_content, "react")
            {
                return Ok(Some("nextjs".to_string()));
            }

            // Check for Express
            if Self::has_in_dependencies(&package_json_content, "express") {
                return Ok(Some("express".to_string()));
            }

            // Check for React (without next)
            if Self::has_in_dependencies(&package_json_content, "react") {
                return Ok(Some("react".to_string()));
            }
        }

        Ok(None)
    }

    /// Detect language from file extension
    ///
    /// # Arguments
    /// * `file_path` - Path to the file
    ///
    /// # Returns
    /// * `Some(language)` if the file extension maps to a known language
    /// * `None` if the extension is not recognized
    pub fn detect_language(file_path: &Path) -> Option<String> {
        match file_path.extension()?.to_str()? {
            "py" => Some("python".to_string()),
            "js" => Some("javascript".to_string()),
            "jsx" => Some("javascript".to_string()),
            "ts" => Some("typescript".to_string()),
            "tsx" => Some("typescript".to_string()),
            _ => None,
        }
    }

    // Private helper methods

    fn is_django(project_path: &Path) -> Result<bool> {
        // Check for manage.py
        if project_path.join("manage.py").exists() {
            return Ok(true);
        }

        // Check for settings.py in common Django patterns
        if project_path.join("settings.py").exists() {
            return Ok(true);
        }

        // Check requirements.txt for Django
        if let Ok(content) = std::fs::read_to_string(project_path.join("requirements.txt")) {
            if content.to_lowercase().contains("django") {
                return Ok(true);
            }
        }

        Ok(false)
    }

    fn is_flask(project_path: &Path) -> Result<bool> {
        // Check for app.py or routes.py
        if project_path.join("app.py").exists() || project_path.join("routes.py").exists() {
            return Ok(true);
        }

        // Check requirements.txt for Flask
        if let Ok(content) = std::fs::read_to_string(project_path.join("requirements.txt")) {
            if content.contains("Flask") || content.contains("flask") {
                return Ok(true);
            }
        }

        Ok(false)
    }

    fn read_package_json(project_path: &Path) -> Result<String> {
        let package_json_path = project_path.join("package.json");
        std::fs::read_to_string(&package_json_path)
            .context("Failed to read package.json")
    }

    fn has_in_dependencies(package_json_content: &str, dependency: &str) -> bool {
        // Simple check: look for the dependency name in the file
        // This is a basic implementation that checks for the dependency name
        // in quotes to avoid false positives
        let patterns = vec![
            format!("\"{}\": ", dependency),
            format!("\"{}\": {{", dependency),
        ];

        patterns.iter().any(|pattern| package_json_content.contains(pattern))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn create_test_project(framework_files: Vec<(&str, &str)>) -> tempfile::TempDir {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let base_path = temp_dir.path();

        for (file_name, content) in framework_files {
            let file_path = base_path.join(file_name);

            // Create parent directories if needed
            if let Some(parent) = file_path.parent() {
                fs::create_dir_all(parent).expect("Failed to create dir");
            }

            fs::write(file_path, content).expect("Failed to write file");
        }

        temp_dir
    }

    #[test]
    fn test_detect_django_with_manage_py() {
        let temp_dir = create_test_project(vec![("manage.py", "")]);
        let result = FrameworkDetector::detect_framework(temp_dir.path());

        assert_eq!(result.unwrap(), Some("django".to_string()));
    }

    #[test]
    fn test_detect_django_from_settings_py() {
        let temp_dir = create_test_project(vec![("settings.py", "")]);
        let result = FrameworkDetector::detect_framework(temp_dir.path());

        assert_eq!(result.unwrap(), Some("django".to_string()));
    }

    #[test]
    fn test_detect_django_from_requirements_txt() {
        let temp_dir = create_test_project(vec![(
            "requirements.txt",
            "Django==3.2.0\npsycopg2-binary==2.9.0",
        )]);
        let result = FrameworkDetector::detect_framework(temp_dir.path());

        assert_eq!(result.unwrap(), Some("django".to_string()));
    }

    #[test]
    fn test_detect_flask_with_app_py() {
        let temp_dir = create_test_project(vec![("app.py", "from flask import Flask")]);
        let result = FrameworkDetector::detect_framework(temp_dir.path());

        assert_eq!(result.unwrap(), Some("flask".to_string()));
    }

    #[test]
    fn test_detect_flask_with_routes_py() {
        let temp_dir = create_test_project(vec![("routes.py", "")]);
        let result = FrameworkDetector::detect_framework(temp_dir.path());

        assert_eq!(result.unwrap(), Some("flask".to_string()));
    }

    #[test]
    fn test_detect_flask_from_requirements() {
        let temp_dir = create_test_project(vec![(
            "requirements.txt",
            "Flask==2.0.0\nWerkzeug==2.0.0",
        )]);
        let result = FrameworkDetector::detect_framework(temp_dir.path());

        assert_eq!(result.unwrap(), Some("flask".to_string()));
    }

    #[test]
    fn test_detect_express_from_package_json() {
        let package_json = r#"{"name": "app", "dependencies": {"express": "^4.17.0"}}"#;
        let temp_dir = create_test_project(vec![("package.json", package_json)]);
        let result = FrameworkDetector::detect_framework(temp_dir.path());

        assert_eq!(result.unwrap(), Some("express".to_string()));
    }

    #[test]
    fn test_detect_nextjs_from_package_json() {
        let package_json = r#"{"name": "app", "dependencies": {"next": "^13.0.0", "react": "^18.0.0"}}"#;
        let temp_dir = create_test_project(vec![("package.json", package_json)]);
        let result = FrameworkDetector::detect_framework(temp_dir.path());

        assert_eq!(result.unwrap(), Some("nextjs".to_string()));
    }

    #[test]
    fn test_detect_react_without_next() {
        let package_json = r#"{"name": "app", "dependencies": {"react": "^18.0.0", "react-dom": "^18.0.0"}}"#;
        let temp_dir = create_test_project(vec![("package.json", package_json)]);
        let result = FrameworkDetector::detect_framework(temp_dir.path());

        assert_eq!(result.unwrap(), Some("react".to_string()));
    }

    #[test]
    fn test_no_framework_detected() {
        let temp_dir = create_test_project(vec![("README.md", "# My Project")]);
        let result = FrameworkDetector::detect_framework(temp_dir.path());

        assert_eq!(result.unwrap(), None);
    }

    #[test]
    fn test_error_on_missing_project() {
        let fake_path = Path::new("/nonexistent/path/to/project");
        let result = FrameworkDetector::detect_framework(fake_path);

        assert!(result.is_err());
    }

    #[test]
    fn test_detect_language_from_extension() {
        assert_eq!(
            FrameworkDetector::detect_language(Path::new("test.py")),
            Some("python".to_string())
        );
        assert_eq!(
            FrameworkDetector::detect_language(Path::new("test.js")),
            Some("javascript".to_string())
        );
        assert_eq!(
            FrameworkDetector::detect_language(Path::new("test.jsx")),
            Some("javascript".to_string())
        );
        assert_eq!(
            FrameworkDetector::detect_language(Path::new("test.ts")),
            Some("typescript".to_string())
        );
        assert_eq!(
            FrameworkDetector::detect_language(Path::new("test.tsx")),
            Some("typescript".to_string())
        );
        assert_eq!(
            FrameworkDetector::detect_language(Path::new("test.unknown")),
            None
        );
    }

    #[test]
    fn test_framework_detection_priority() {
        // Django takes priority over Flask
        let temp_dir = create_test_project(vec![
            ("manage.py", ""),
            ("app.py", ""),
            ("package.json", r#"{"dependencies": {"express": "^4.0"}}"#),
        ]);
        let result = FrameworkDetector::detect_framework(temp_dir.path());

        assert_eq!(result.unwrap(), Some("django".to_string()));
    }
}
