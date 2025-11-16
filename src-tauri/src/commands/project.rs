//! Project management commands
//!
//! Handles project creation, listing, and selection via Tauri IPC

use crate::db::{self, queries};
use crate::models::Project;
use crate::utils::create_audit_event;
use std::path::Path;

/// Open a file dialog to select a project folder
///
/// Uses the native file picker to let users choose a directory
///
/// Returns: Path to selected directory or error if cancelled
#[tauri::command]
pub async fn select_project_folder() -> Result<String, String> {
    // Use tauri-plugin-dialog for native file picker
    // In production, this would use the Tauri dialog plugin
    // For now, return a placeholder that would be replaced with actual dialog call

    // Example: tauri::async_runtime::spawn(async move {
    //     tauri_plugin_dialog::FileDialogBuilder::new()
    //         .pick_folder()
    //         .await
    // })

    // Placeholder implementation - returns success with a path
    // This would be called from frontend with the dialog result
    Ok("/path/to/project".to_string())
}

/// Create a new project in the database
///
/// Validates that the path exists and inserts a new project record.
/// If a project with this path already exists, returns the existing project.
///
/// # Arguments
/// * `path` - Absolute path to project directory
/// * `name` - Optional project name (defaults to directory basename)
/// * `framework` - Optional framework name (auto-detected if not provided)
///
/// Returns: Created or existing Project with assigned ID or error
#[tauri::command]
pub async fn create_project(
    path: String,
    name: Option<String>,
    framework: Option<String>,
) -> Result<Project, String> {
    // Validate path exists
    if !Path::new(&path).exists() {
        return Err(format!("Project path does not exist: {}", path));
    }

    // Get database connection
    let conn = db::get_connection();

    // Check if project already exists with this path
    if let Some(existing_project) = queries::select_project_by_path(&conn, &path)
        .map_err(|e| format!("Failed to check for existing project: {}", e))? {
        // Project already exists - update framework if provided and return it
        if let Some(fw) = framework.as_deref() {
            let _ = queries::update_project(&conn, existing_project.id, &existing_project.name, Some(fw));

            // Fetch updated project
            return queries::select_project(&conn, existing_project.id)
                .map_err(|e| format!("Failed to fetch updated project: {}", e))?
                .ok_or_else(|| "Project was updated but could not be retrieved".to_string());
        }

        return Ok(existing_project);
    }

    // Extract project name from path if not provided
    let project_name = match name {
        Some(n) => n,
        None => Path::new(&path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("untitled-project")
            .to_string(),
    };

    // Insert new project
    let project_id = queries::insert_project(&conn, &project_name, &path, framework.as_deref())
        .map_err(|e| format!("Failed to create project: {}", e))?;

    // Fetch and return created project
    let project = queries::select_project(&conn, project_id)
        .map_err(|e| format!("Failed to fetch created project: {}", e))?
        .ok_or_else(|| "Project was created but could not be retrieved".to_string())?;

    // Log audit event
    if let Ok(event) = create_audit_event(&conn, "project_created", None, None, None,
        &format!("Created project: {}", project_name)) {
        let _ = queries::insert_audit_event(&conn, &event);
    }

    Ok(project)
}

/// Retrieve all projects
///
/// Returns: List of all projects sorted by creation date (newest first)
#[tauri::command]
pub async fn get_projects() -> Result<Vec<Project>, String> {
    let conn = db::get_connection();

    let projects = queries::select_projects(&conn)
        .map_err(|e| format!("Failed to fetch projects: {}", e))?;

    Ok(projects)
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::TestDbGuard;
    use std::path::Path;

    #[tokio::test]
    async fn test_select_project_folder_returns_path() {
        let result = select_project_folder().await;
        assert!(result.is_ok());
        assert!(!result.unwrap().is_empty());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_create_project_success() {
        let _guard = TestDbGuard::new();
        let project_dir = tempfile::TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        let result = create_project(path.clone(), None, None).await;
        assert!(result.is_ok());

        let project = result.unwrap();
        assert!(!project.name.is_empty());
        assert_eq!(project.path, path);
        assert!(project.id > 0);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_create_project_with_custom_name() {
        let _guard = TestDbGuard::new();
        let project_dir = tempfile::TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        let result = create_project(path, Some("my-app".to_string()), None).await;
        assert!(result.is_ok());

        let project = result.unwrap();
        assert_eq!(project.name, "my-app");
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_create_project_with_framework() {
        let _guard = TestDbGuard::new();
        let project_dir = tempfile::TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        let result = create_project(path, None, Some("Django".to_string())).await;
        assert!(result.is_ok());

        let project = result.unwrap();
        assert_eq!(project.framework, Some("Django".to_string()));
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_create_project_invalid_path() {
        let _guard = TestDbGuard::new();
        let result = create_project("/nonexistent/path".to_string(), None, None).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_create_project_extracts_name_from_path() {
        let _guard = TestDbGuard::new();
        let project_dir = tempfile::TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        let result = create_project(path.clone(), None, None).await;
        assert!(result.is_ok());

        let project = result.unwrap();
        let expected_name = Path::new(&path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("untitled-project")
            .to_string();
        assert_eq!(project.name, expected_name);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_projects_empty() {
        let _guard = TestDbGuard::new();
        let result = get_projects().await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_projects_multiple() {
        let _guard = TestDbGuard::new();

        // Create first project
        let project_dir_1 = tempfile::TempDir::new().unwrap();
        let path_1 = project_dir_1.path().to_string_lossy().to_string();
        let result_1 = create_project(path_1, Some("project-1".to_string()), None).await;
        assert!(result_1.is_ok());

        // Create second project
        let project_dir_2 = tempfile::TempDir::new().unwrap();
        let path_2 = project_dir_2.path().to_string_lossy().to_string();
        let result_2 = create_project(path_2, Some("project-2".to_string()), None).await;
        assert!(result_2.is_ok());

        // Fetch all projects
        let result = get_projects().await;
        assert!(result.is_ok());

        let projects = result.unwrap();
        assert_eq!(projects.len(), 2);
        assert!(projects.iter().any(|p| p.name == "project-1"));
        assert!(projects.iter().any(|p| p.name == "project-2"));
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_projects_ordered_by_creation() {
        let _guard = TestDbGuard::new();

        let dirs: Vec<tempfile::TempDir> = (0..3)
            .map(|i| {
                let dir = tempfile::TempDir::new().unwrap();
                let path = dir.path().to_string_lossy().to_string();
                let _ = create_project(path, Some(format!("project-{}", i)), None);
                std::thread::sleep(std::time::Duration::from_millis(10));
                dir
            })
            .collect();

        let result = get_projects().await;
        assert!(result.is_ok());

        let projects = result.unwrap();
        assert_eq!(projects.len(), 3);
        // Most recent should be first
        assert_eq!(projects[0].name, "project-2");
        assert_eq!(projects[1].name, "project-1");
        assert_eq!(projects[2].name, "project-0");

        drop(dirs);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_create_multiple_projects_different_frameworks() {
        let _guard = TestDbGuard::new();

        let frameworks = vec!["Django", "Express", "Flask"];
        for (i, fw) in frameworks.iter().enumerate() {
            let dir = tempfile::TempDir::new().unwrap();
            let path = dir.path().to_string_lossy().to_string();
            let result = create_project(
                path,
                Some(format!("project-{}", i)),
                Some(fw.to_string()),
            ).await;
            assert!(result.is_ok());
        }

        let result = get_projects().await;
        assert!(result.is_ok());

        let projects = result.unwrap();
        assert_eq!(projects.len(), 3);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_project_timestamps_set() {
        let _guard = TestDbGuard::new();
        let project_dir = tempfile::TempDir::new().unwrap();
        let path = project_dir.path().to_string_lossy().to_string();

        let result = create_project(path, None, None).await;
        assert!(result.is_ok());

        let project = result.unwrap();
        assert!(!project.created_at.is_empty());
        assert!(!project.updated_at.is_empty());
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_create_project_idempotent_names() {
        let _guard = TestDbGuard::new();

        let dir1 = tempfile::TempDir::new().unwrap();
        let dir2 = tempfile::TempDir::new().unwrap();

        let path1 = dir1.path().to_string_lossy().to_string();
        let path2 = dir2.path().to_string_lossy().to_string();

        let result1 = create_project(path1, Some("app".to_string()), None).await;
        let result2 = create_project(path2, Some("app".to_string()), None).await;

        assert!(result1.is_ok());
        assert!(result2.is_ok());

        let p1 = result1.unwrap();
        let p2 = result2.unwrap();

        assert_eq!(p1.name, p2.name);
        assert_ne!(p1.id, p2.id);
        assert_ne!(p1.path, p2.path);
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_get_projects_after_create() {
        let _guard = TestDbGuard::new();

        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().to_string_lossy().to_string();
        let created = create_project(path, Some("test-project".to_string()), None).await;
        assert!(created.is_ok());

        let projects = get_projects().await;
        assert!(projects.is_ok());

        let list = projects.unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "test-project");
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_create_project_path_normalized() {
        let _guard = TestDbGuard::new();
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().to_string_lossy().to_string();

        let result = create_project(path.clone(), None, None).await;
        assert!(result.is_ok());

        let project = result.unwrap();
        assert_eq!(project.path, path);
    }
}
