//! GitHub Integration Commands
//!
//! Tauri commands for GitHub OAuth authentication and repository management.

use once_cell::sync::Lazy;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::commands::scan;
use crate::db::{self, queries};
use crate::github::GitHubClient;
use crate::models::{
    DeviceCodeResponse, GitHubConnectionStatus, GitHubRepo, TrackedRepoWithDetails,
};

/// Global state for device flow polling
static DEVICE_CODE_STATE: Lazy<Mutex<Option<DeviceCodeState>>> = Lazy::new(|| Mutex::new(None));

#[derive(Clone)]
struct DeviceCodeState {
    device_code: String,
    interval: i64,
}

/// Start GitHub OAuth Device Flow
///
/// Returns device code info for user to authorize in browser.
/// The user should visit verification_uri and enter user_code.
#[tauri::command]
pub async fn start_github_oauth() -> Result<DeviceCodeResponse, String> {
    println!("[ryn] Starting GitHub OAuth device flow");

    let client = GitHubClient::from_env().map_err(|e| {
        format!(
            "Failed to create GitHub client. Make sure GITHUB_CLIENT_ID is set: {}",
            e
        )
    })?;

    let response = client
        .start_device_flow()
        .await
        .map_err(|e| format!("Failed to start device flow: {}", e))?;

    // Store device code for polling
    {
        let mut state = DEVICE_CODE_STATE.lock().unwrap();
        *state = Some(DeviceCodeState {
            device_code: response.device_code.clone(),
            interval: response.interval,
        });
    }

    println!(
        "[ryn] Device flow started. User code: {}",
        response.user_code
    );

    Ok(response)
}

/// Poll for GitHub OAuth token
///
/// Call this periodically after start_github_oauth.
/// Returns true when authorization is complete, false if still waiting.
#[tauri::command]
pub async fn poll_github_oauth() -> Result<bool, String> {
    let state = {
        let guard = DEVICE_CODE_STATE.lock().unwrap();
        guard.clone()
    };

    let state = match state {
        Some(s) => s,
        None => return Err("No OAuth flow in progress. Call start_github_oauth first.".to_string()),
    };

    let client =
        GitHubClient::from_env().map_err(|e| format!("Failed to create GitHub client: {}", e))?;

    match client.poll_for_token(&state.device_code).await {
        Ok(Some(token)) => {
            println!("[ryn] OAuth token received, fetching user info...");

            // Get user info
            let user = client
                .get_user(&token.access_token)
                .await
                .map_err(|e| format!("Failed to get user info: {}", e))?;

            // Store connection in database
            let conn = db::get_connection();

            // Delete any existing connection first
            queries::delete_github_connection(&conn)
                .map_err(|e| format!("Failed to clear old connection: {}", e))?;

            queries::insert_github_connection(
                &conn,
                &token.access_token,
                token.refresh_token.as_deref(),
                None, // token_expires_at - device flow tokens don't expire
                user.id,
                &user.login,
                Some(&user.avatar_url),
                user.email.as_deref(),
            )
            .map_err(|e| format!("Failed to save connection: {}", e))?;

            // Clear device code state
            {
                let mut guard = DEVICE_CODE_STATE.lock().unwrap();
                *guard = None;
            }

            println!("[ryn] GitHub connected successfully as {}", user.login);
            Ok(true)
        }
        Ok(None) => {
            // Still waiting for authorization
            Ok(false)
        }
        Err(e) => {
            // Clear state on error
            {
                let mut guard = DEVICE_CODE_STATE.lock().unwrap();
                *guard = None;
            }
            Err(format!("OAuth failed: {}", e))
        }
    }
}

/// Check if GitHub is connected
#[tauri::command]
pub async fn check_github_connection() -> Result<GitHubConnectionStatus, String> {
    let conn = db::get_connection();

    let connection = queries::select_github_connection(&conn)
        .map_err(|e| format!("Failed to check connection: {}", e))?;

    match connection {
        Some(c) => {
            let repo_count = queries::get_github_repo_count(&conn)
                .map_err(|e| format!("Failed to get repo count: {}", e))?;
            let tracked_count = queries::get_tracked_repo_count(&conn)
                .map_err(|e| format!("Failed to get tracked count: {}", e))?;

            Ok(GitHubConnectionStatus {
                connected: true,
                username: Some(c.github_username),
                avatar_url: c.github_avatar_url,
                repo_count,
                tracked_count,
            })
        }
        None => Ok(GitHubConnectionStatus {
            connected: false,
            username: None,
            avatar_url: None,
            repo_count: 0,
            tracked_count: 0,
        }),
    }
}

/// Disconnect GitHub account
#[tauri::command]
pub async fn disconnect_github() -> Result<(), String> {
    println!("[ryn] Disconnecting GitHub account");

    let conn = db::get_connection();

    // Delete connection and all cached repos
    queries::delete_github_connection(&conn)
        .map_err(|e| format!("Failed to delete connection: {}", e))?;
    queries::delete_all_github_repos(&conn)
        .map_err(|e| format!("Failed to delete repos: {}", e))?;

    println!("[ryn] GitHub disconnected");
    Ok(())
}

/// Fetch repositories from GitHub and cache them
#[tauri::command]
pub async fn fetch_github_repos() -> Result<Vec<GitHubRepo>, String> {
    println!("[ryn] Fetching GitHub repositories");

    // Get access token from DB (connection released before async)
    let access_token = {
        let conn = db::get_connection();
        let connection = queries::select_github_connection(&conn)
            .map_err(|e| format!("Failed to get connection: {}", e))?
            .ok_or_else(|| "Not connected to GitHub".to_string())?;
        connection.access_token
    };

    let client =
        GitHubClient::from_env().map_err(|e| format!("Failed to create GitHub client: {}", e))?;

    let api_repos = client
        .list_all_repos(&access_token)
        .await
        .map_err(|e| format!("Failed to fetch repos: {}", e))?;

    println!("[ryn] Fetched {} repositories from GitHub", api_repos.len());

    // Convert and cache repos (new connection for DB operations)
    let conn = db::get_connection();
    let mut repos = Vec::new();
    for api_repo in api_repos {
        let repo = GitHubClient::api_repo_to_model(api_repo);
        let id = queries::upsert_github_repo(&conn, &repo)
            .map_err(|e| format!("Failed to cache repo: {}", e))?;

        repos.push(GitHubRepo { id, ..repo });
    }

    println!("[ryn] Cached {} repositories", repos.len());
    Ok(repos)
}

/// Get cached GitHub repositories
#[tauri::command]
pub async fn get_github_repos() -> Result<Vec<GitHubRepo>, String> {
    let conn = db::get_connection();

    let repos =
        queries::select_github_repos(&conn).map_err(|e| format!("Failed to get repos: {}", e))?;

    Ok(repos)
}

/// Track a repository for compliance monitoring
#[tauri::command]
pub async fn track_repo(github_repo_id: i64) -> Result<i64, String> {
    println!("[ryn] Tracking repository {}", github_repo_id);

    let conn = db::get_connection();

    // Check if already tracked
    let is_tracked = queries::is_repo_tracked(&conn, github_repo_id)
        .map_err(|e| format!("Failed to check tracking: {}", e))?;

    if is_tracked {
        return Err("Repository is already tracked".to_string());
    }

    let id = queries::insert_tracked_repo(&conn, github_repo_id)
        .map_err(|e| format!("Failed to track repo: {}", e))?;

    println!(
        "[ryn] Repository {} now tracked with ID {}",
        github_repo_id, id
    );
    Ok(id)
}

/// Untrack a repository
#[tauri::command]
pub async fn untrack_repo(tracked_repo_id: i64) -> Result<(), String> {
    println!("[ryn] Untracking repository {}", tracked_repo_id);

    let conn = db::get_connection();

    queries::delete_tracked_repo(&conn, tracked_repo_id)
        .map_err(|e| format!("Failed to untrack repo: {}", e))?;

    println!("[ryn] Repository {} untracked", tracked_repo_id);
    Ok(())
}

/// Get tracked repositories with details
#[tauri::command]
pub async fn get_tracked_repos() -> Result<Vec<TrackedRepoWithDetails>, String> {
    let conn = db::get_connection();

    let repos = queries::select_tracked_repos_with_details(&conn)
        .map_err(|e| format!("Failed to get tracked repos: {}", e))?;

    Ok(repos)
}

/// Check if a tracked repo has new commits and trigger scan if needed
#[tauri::command]
pub async fn check_repo_for_changes(tracked_repo_id: i64) -> Result<bool, String> {
    println!("[ryn] Checking repo {} for changes", tracked_repo_id);

    // Get tracked repo details
    let (repo_owner, repo_name, repo_branch, access_token, last_commit_sha) = {
        let conn = db::get_connection();

        let tracked_repos = queries::select_tracked_repos_with_details(&conn)
            .map_err(|e| format!("Failed to get tracked repo: {}", e))?;

        let tracked_repo = tracked_repos
            .into_iter()
            .find(|r| r.id == tracked_repo_id)
            .ok_or_else(|| format!("Tracked repo {} not found", tracked_repo_id))?;

        let connection = queries::select_github_connection(&conn)
            .map_err(|e| format!("Failed to get GitHub connection: {}", e))?
            .ok_or_else(|| "Not connected to GitHub".to_string())?;

        let last_sha: Option<String> = tracked_repo.last_commit_sha.clone();

        (
            tracked_repo.github_repo.owner.clone(),
            tracked_repo.github_repo.name.clone(),
            tracked_repo.github_repo.default_branch.clone(),
            connection.access_token.clone(),
            last_sha,
        )
    };

    // Create GitHub client
    let client =
        GitHubClient::from_env().map_err(|e| format!("Failed to create GitHub client: {}", e))?;

    // Get latest commit SHA from GitHub
    let latest_sha = client
        .get_latest_commit_sha(&access_token, &repo_owner, &repo_name, &repo_branch)
        .await
        .map_err(|e| format!("Failed to get latest commit: {}", e))?;

    println!("[ryn] Latest commit SHA: {}", latest_sha);

    // Update last_checked_at
    {
        let conn = db::get_connection();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE tracked_repos SET last_checked_at = ?, last_commit_sha = ? WHERE id = ?",
            rusqlite::params![now, latest_sha, tracked_repo_id],
        )
        .map_err(|e| format!("Failed to update tracked repo: {}", e))?;
    }

    // Check if commit changed
    let has_changes = match last_commit_sha {
        None => {
            println!("[ryn] First check - will scan");
            true
        }
        Some(last_sha) if last_sha != latest_sha => {
            println!("[ryn] New commit detected - will scan");
            true
        }
        _ => {
            println!("[ryn] No changes detected");
            false
        }
    };

    Ok(has_changes)
}

/// Scan a GitHub repository by materializing it locally and reusing the existing scanner pipeline
#[tauri::command]
pub async fn scan_github_repo<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    channels: tauri::State<'_, scan::ScanResponseChannels>,
    tracked_repo_id: i64,
    scan_mode: String,
) -> Result<i64, String> {
    println!(
        "[ryn] Scanning GitHub repository {} with mode {}",
        tracked_repo_id, scan_mode
    );

    // Get tracked repo details and auth
    let (tracked_repo, repo_owner, repo_name, repo_branch, access_token) = {
        let conn = db::get_connection();

        let tracked_repo = queries::select_tracked_repos_with_details(&conn)
            .map_err(|e| format!("Failed to get tracked repo: {}", e))?
            .into_iter()
            .find(|r| r.id == tracked_repo_id)
            .ok_or_else(|| format!("Tracked repo {} not found", tracked_repo_id))?;

        let connection = queries::select_github_connection(&conn)
            .map_err(|e| format!("Failed to get GitHub connection: {}", e))?
            .ok_or_else(|| "Not connected to GitHub".to_string())?;

        (
            tracked_repo,
            tracked_repo.github_repo.owner.clone(),
            tracked_repo.github_repo.name.clone(),
            tracked_repo.github_repo.default_branch.clone(),
            connection.access_token.clone(),
        )
    };

    let client =
        GitHubClient::from_env().map_err(|e| format!("Failed to create GitHub client: {}", e))?;

    // Build local snapshot so we can run the existing local scan pipeline
    let repo_dir = prepare_local_checkout(
        &client,
        &access_token,
        &repo_owner,
        &repo_name,
        &repo_branch,
    )
    .await?;

    // Capture the latest commit so we can mark the repo as fresh after scanning
    let latest_sha = client
        .get_latest_commit_sha(&access_token, &repo_owner, &repo_name, &repo_branch)
        .await
        .map_err(|e| format!("Failed to get latest commit: {}", e))?;

    // Persist local path for subsequent change detection
    {
        let conn = db::get_connection();
        if tracked_repo.local_path.as_deref() != Some(repo_dir.to_string_lossy().as_ref()) {
            queries::update_tracked_repo_local_path(
                &conn,
                tracked_repo_id,
                repo_dir.to_string_lossy().as_ref(),
            )
            .map_err(|e| format!("Failed to save local path: {}", e))?;
        }
    }

    // Ensure a project exists that points at this checkout so we can reuse scan_project
    let project_id = {
        let conn = db::get_connection();
        if let Some(project) =
            queries::select_project_by_path(&conn, repo_dir.to_string_lossy().as_ref())
                .map_err(|e| format!("Failed to lookup project: {}", e))?
        {
            project.id
        } else {
            queries::insert_project(&conn, &repo_name, repo_dir.to_string_lossy().as_ref(), None)
                .map_err(|e| format!("Failed to create project for repo: {}", e))?
        }
    };

    // Run the existing scan pipeline
    let scan = scan::scan_project_internal(app, channels.inner(), project_id)
        .await
        .map_err(|e| format!("Failed to scan repo: {}", e))?;

    // Record metadata
    {
        let conn = db::get_connection();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE tracked_repos SET last_scanned_at = ?, last_checked_at = ?, last_commit_sha = ? WHERE id = ?",
            rusqlite::params![now, now, latest_sha, tracked_repo_id],
        )
        .map_err(|e| format!("Failed to update tracked repo after scan: {}", e))?;
    }

    Ok(scan.id)
}

/// Download repository contents into a local cache directory to enable scanning
async fn prepare_local_checkout(
    client: &GitHubClient,
    access_token: &str,
    owner: &str,
    repo: &str,
    branch: &str,
) -> Result<PathBuf, String> {
    println!(
        "[ryn] Preparing local snapshot for {}/{} ({})",
        owner, repo, branch
    );

    let base_dir = std::env::temp_dir().join("ryn-github-cache");
    fs::create_dir_all(&base_dir)
        .map_err(|e| format!("Failed to create cache dir {}: {}", base_dir.display(), e))?;

    let repo_dir = base_dir.join(format!("{}-{}", owner, repo));
    if repo_dir.exists() {
        fs::remove_dir_all(&repo_dir).map_err(|e| {
            format!(
                "Failed to clean existing cache {}: {}",
                repo_dir.display(),
                e
            )
        })?;
    }
    fs::create_dir_all(&repo_dir)
        .map_err(|e| format!("Failed to create repo dir {}: {}", repo_dir.display(), e))?;

    let tree = client
        .get_repo_tree(access_token, owner, repo, branch)
        .await
        .map_err(|e| format!("Failed to fetch repo tree: {}", e))?;

    let scannable_files: Vec<_> = tree
        .into_iter()
        .filter(|item| {
            item.item_type == "blob"
                && matches!(
                    Path::new(&item.path).extension().and_then(|e| e.to_str()),
                    Some("py" | "js" | "ts" | "tsx" | "jsx" | "go" | "rs" | "java")
                )
        })
        .collect();

    for item in scannable_files {
        let content = client
            .get_file_content(access_token, owner, repo, &item.path)
            .await
            .map_err(|e| format!("Failed to fetch {}: {}", item.path, e))?;

        let dest_path = repo_dir.join(&item.path);
        if let Some(parent) = dest_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create dir {}: {}", parent.display(), e))?;
        }
        fs::write(&dest_path, content)
            .map_err(|e| format!("Failed to write {}: {}", dest_path.display(), e))?;
    }

    Ok(repo_dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_code_state_mutex() {
        // Test that the mutex can be locked and unlocked
        {
            let mut guard = DEVICE_CODE_STATE.lock().unwrap();
            *guard = Some(DeviceCodeState {
                device_code: "test".to_string(),
                interval: 5,
            });
        }

        {
            let guard = DEVICE_CODE_STATE.lock().unwrap();
            assert!(guard.is_some());
        }

        {
            let mut guard = DEVICE_CODE_STATE.lock().unwrap();
            *guard = None;
        }
    }
}
