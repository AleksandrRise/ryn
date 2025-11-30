use serde::{Deserialize, Serialize};

/// Represents a GitHub OAuth connection for a user
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GitHubConnection {
    pub id: i64,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub token_expires_at: Option<String>,
    pub github_user_id: i64,
    pub github_username: String,
    pub github_avatar_url: Option<String>,
    pub github_email: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Represents a GitHub repository (cached from GitHub API)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GitHubRepo {
    pub id: i64,
    pub github_id: i64,
    pub name: String,
    pub full_name: String,
    pub owner: String,
    pub html_url: String,
    pub clone_url: String,
    pub description: Option<String>,
    pub private: bool,
    pub language: Option<String>,
    pub stargazers_count: i64,
    pub default_branch: String,
    pub fetched_at: String,
}

/// Represents a tracked repository for compliance monitoring
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrackedRepo {
    pub id: i64,
    pub github_repo_id: i64,
    pub local_path: Option<String>,
    pub last_scanned_at: Option<String>,
    pub is_active: bool,
    pub added_at: String,
}

/// Extended tracked repo with GitHub repo details (for frontend display)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedRepoWithDetails {
    pub id: i64,
    pub github_repo: GitHubRepo,
    pub local_path: Option<String>,
    pub last_scanned_at: Option<String>,
    pub last_checked_at: Option<String>,
    pub last_commit_sha: Option<String>,
    pub is_active: bool,
    pub added_at: String,
    // Aggregated scan data (if any)
    pub total_violations: Option<i64>,
    pub critical_violations: Option<i64>,
    pub last_scan_status: Option<String>,
    pub last_scan_mode: Option<String>,
}

/// GitHub Device Flow response for initiating OAuth
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: i64,
    pub interval: i64,
}

/// GitHub access token response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub scope: String,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub expires_in: Option<i64>,
}

/// GitHub user info from /user endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubUser {
    pub id: i64,
    pub login: String,
    pub avatar_url: String,
    pub email: Option<String>,
}

/// GitHub repository from API response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubApiRepo {
    pub id: i64,
    pub name: String,
    pub full_name: String,
    pub owner: GitHubApiOwner,
    pub html_url: String,
    pub clone_url: String,
    pub description: Option<String>,
    pub private: bool,
    pub language: Option<String>,
    pub stargazers_count: i64,
    pub default_branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubApiOwner {
    pub login: String,
}

/// Connection status for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubConnectionStatus {
    pub connected: bool,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub repo_count: i64,
    pub tracked_count: i64,
}

/// Batch check result for a single tracked repo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoCheckResult {
    pub repo_id: i64,
    pub has_changes: bool,
}

/// GitHub tree API response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubTreeResponse {
    pub sha: String,
    pub url: String,
    pub tree: Vec<GitHubTreeItem>,
    pub truncated: bool,
}

/// GitHub tree item (file or directory)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubTreeItem {
    pub path: String,
    pub mode: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub sha: String,
    pub size: Option<i64>,
    pub url: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_github_repo_serde() {
        let repo = GitHubRepo {
            id: 1,
            github_id: 12345,
            name: "test-repo".to_string(),
            full_name: "user/test-repo".to_string(),
            owner: "user".to_string(),
            html_url: "https://github.com/user/test-repo".to_string(),
            clone_url: "https://github.com/user/test-repo.git".to_string(),
            description: Some("A test repo".to_string()),
            private: false,
            language: Some("Rust".to_string()),
            stargazers_count: 42,
            default_branch: "main".to_string(),
            fetched_at: "2024-01-01T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&repo).unwrap();
        let deserialized: GitHubRepo = serde_json::from_str(&json).unwrap();
        assert_eq!(repo, deserialized);
    }

    #[test]
    fn test_device_code_response_serde() {
        let json = r#"{
            "device_code": "abc123",
            "user_code": "XXXX-YYYY",
            "verification_uri": "https://github.com/login/device",
            "expires_in": 900,
            "interval": 5
        }"#;

        let response: DeviceCodeResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.user_code, "XXXX-YYYY");
        assert_eq!(response.expires_in, 900);
    }

    #[test]
    fn test_github_connection_status() {
        let status = GitHubConnectionStatus {
            connected: true,
            username: Some("octocat".to_string()),
            avatar_url: Some("https://avatars.githubusercontent.com/u/1?v=4".to_string()),
            repo_count: 10,
            tracked_count: 3,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("octocat"));
    }
}
