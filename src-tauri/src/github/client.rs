//! GitHub API Client
//!
//! Handles GitHub App Device Flow OAuth and API requests.

use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

use crate::models::{
    AccessTokenResponse, DeviceCodeResponse, GitHubApiRepo, GitHubRepo, GitHubTreeItem,
    GitHubTreeResponse, GitHubUser,
};

const GITHUB_API_BASE: &str = "https://api.github.com";
const GITHUB_DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";

/// GitHub API Client for OAuth and repository operations
pub struct GitHubClient {
    client: Client,
    client_id: String,
}

/// Error response from GitHub OAuth
#[derive(Debug, Deserialize)]
struct OAuthError {
    error: String,
    error_description: Option<String>,
}

/// Polling response that may be success or error
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum PollResponse {
    Success(AccessTokenResponse),
    Error(OAuthError),
}

impl GitHubClient {
    /// Create a new GitHub client with the given Client ID
    pub fn new(client_id: String) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("Ryn-SOC2-Compliance/1.0")
            .build()
            .context("Failed to create HTTP client")?;

        Ok(Self { client, client_id })
    }

    /// Create a client from environment variable GITHUB_CLIENT_ID
    pub fn from_env() -> Result<Self> {
        let client_id = std::env::var("GITHUB_CLIENT_ID")
            .context("GITHUB_CLIENT_ID environment variable not set")?;
        Self::new(client_id)
    }

    /// Start the Device Flow by requesting a device code
    ///
    /// Returns a DeviceCodeResponse containing:
    /// - device_code: For polling
    /// - user_code: For user to enter at verification_uri
    /// - verification_uri: URL for user to visit
    pub async fn start_device_flow(&self) -> Result<DeviceCodeResponse> {
        let response = self
            .client
            .post(GITHUB_DEVICE_CODE_URL)
            .header("Accept", "application/json")
            .form(&[
                ("client_id", self.client_id.as_str()),
                ("scope", "repo read:user user:email"),
            ])
            .send()
            .await
            .context("Failed to request device code")?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!(
                "GitHub device code request failed ({}): {}",
                status,
                text
            ));
        }

        let device_code: DeviceCodeResponse = response
            .json()
            .await
            .context("Failed to parse device code response")?;

        Ok(device_code)
    }

    /// Poll for access token after user has authorized
    ///
    /// Returns Ok(Some(token)) on success, Ok(None) if still waiting,
    /// Err if authorization was denied or expired
    pub async fn poll_for_token(&self, device_code: &str) -> Result<Option<AccessTokenResponse>> {
        let response = self
            .client
            .post(GITHUB_ACCESS_TOKEN_URL)
            .header("Accept", "application/json")
            .form(&[
                ("client_id", self.client_id.as_str()),
                ("device_code", device_code),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ])
            .send()
            .await
            .context("Failed to poll for access token")?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Token poll failed ({}): {}", status, text));
        }

        let poll_response: PollResponse = response
            .json()
            .await
            .context("Failed to parse poll response")?;

        match poll_response {
            PollResponse::Success(token) => Ok(Some(token)),
            PollResponse::Error(err) => {
                match err.error.as_str() {
                    "authorization_pending" => Ok(None), // Still waiting
                    "slow_down" => Ok(None),             // Need to slow polling
                    "expired_token" => Err(anyhow!("Device code expired. Please try again.")),
                    "access_denied" => Err(anyhow!("Authorization was denied by user.")),
                    _ => Err(anyhow!(
                        "OAuth error: {} - {}",
                        err.error,
                        err.error_description.unwrap_or_default()
                    )),
                }
            }
        }
    }

    /// Get authenticated user info
    pub async fn get_user(&self, access_token: &str) -> Result<GitHubUser> {
        let response = self
            .client
            .get(format!("{}/user", GITHUB_API_BASE))
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .context("Failed to get user info")?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to get user info ({}): {}", status, text));
        }

        let user: GitHubUser = response
            .json()
            .await
            .context("Failed to parse user response")?;

        Ok(user)
    }

    /// List repositories for authenticated user
    ///
    /// Returns up to 100 repositories (paginated)
    pub async fn list_repos(
        &self,
        access_token: &str,
        page: u32,
        per_page: u32,
    ) -> Result<Vec<GitHubApiRepo>> {
        let per_page = per_page.min(100); // GitHub max is 100

        let response = self
            .client
            .get(format!("{}/user/repos", GITHUB_API_BASE))
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .query(&[
                ("type", "all"),
                ("sort", "updated"),
                ("direction", "desc"),
                ("page", &page.to_string()),
                ("per_page", &per_page.to_string()),
            ])
            .send()
            .await
            .context("Failed to list repositories")?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to list repos ({}): {}", status, text));
        }

        let repos: Vec<GitHubApiRepo> = response
            .json()
            .await
            .context("Failed to parse repos response")?;

        Ok(repos)
    }

    /// List all repositories (handles pagination)
    pub async fn list_all_repos(&self, access_token: &str) -> Result<Vec<GitHubApiRepo>> {
        let mut all_repos = Vec::new();
        let mut page = 1u32;
        let per_page = 100u32;

        loop {
            let repos = self.list_repos(access_token, page, per_page).await?;
            let count = repos.len();
            all_repos.extend(repos);

            if count < per_page as usize {
                break; // Last page
            }
            page += 1;

            // Safety limit to prevent infinite loops
            if page > 50 {
                break;
            }
        }

        Ok(all_repos)
    }

    /// Get repository tree (list of files)
    pub async fn get_repo_tree(
        &self,
        access_token: &str,
        owner: &str,
        repo: &str,
        branch: &str,
    ) -> Result<Vec<GitHubTreeItem>> {
        let response = self
            .client
            .get(format!(
                "{}/repos/{}/{}/git/trees/{}?recursive=1",
                GITHUB_API_BASE, owner, repo, branch
            ))
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .context("Failed to get repository tree")?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to get repo tree ({}): {}", status, text));
        }

        let tree_response: GitHubTreeResponse = response
            .json()
            .await
            .context("Failed to parse tree response")?;

        Ok(tree_response.tree)
    }

    /// Get file content from repository
    pub async fn get_file_content(
        &self,
        access_token: &str,
        owner: &str,
        repo: &str,
        path: &str,
    ) -> Result<String> {
        let response = self
            .client
            .get(format!(
                "{}/repos/{}/{}/contents/{}",
                GITHUB_API_BASE, owner, repo, path
            ))
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Accept", "application/vnd.github.raw+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .context("Failed to get file content")?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to get file content ({}): {}", status, text));
        }

        let content = response
            .text()
            .await
            .context("Failed to read file content")?;

        Ok(content)
    }

    /// Get latest commit SHA for a branch
    pub async fn get_latest_commit_sha(
        &self,
        access_token: &str,
        owner: &str,
        repo: &str,
        branch: &str,
    ) -> Result<String> {
        let response = self
            .client
            .get(format!(
                "{}/repos/{}/{}/commits/{}",
                GITHUB_API_BASE, owner, repo, branch
            ))
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .context("Failed to get latest commit")?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(anyhow!(
                "Failed to get latest commit ({}): {}",
                status,
                text
            ));
        }

        let commit: serde_json::Value = response
            .json()
            .await
            .context("Failed to parse commit response")?;

        let sha = commit
            .get("sha")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Commit response missing SHA field"))?;

        Ok(sha.to_string())
    }

    /// Convert API repo to our model
    pub fn api_repo_to_model(api_repo: GitHubApiRepo) -> GitHubRepo {
        GitHubRepo {
            id: 0, // Will be set by database
            github_id: api_repo.id,
            name: api_repo.name,
            full_name: api_repo.full_name,
            owner: api_repo.owner.login,
            html_url: api_repo.html_url,
            clone_url: api_repo.clone_url,
            description: api_repo.description,
            private: api_repo.private,
            language: api_repo.language,
            stargazers_count: api_repo.stargazers_count,
            default_branch: api_repo.default_branch,
            fetched_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_github_client_creation() {
        let client = GitHubClient::new("test_client_id".to_string());
        assert!(client.is_ok());
    }

    #[test]
    fn test_api_repo_to_model() {
        use crate::models::github::GitHubApiOwner;

        let api_repo = GitHubApiRepo {
            id: 12345,
            name: "test-repo".to_string(),
            full_name: "user/test-repo".to_string(),
            owner: GitHubApiOwner {
                login: "user".to_string(),
            },
            html_url: "https://github.com/user/test-repo".to_string(),
            clone_url: "https://github.com/user/test-repo.git".to_string(),
            description: Some("Test description".to_string()),
            private: false,
            language: Some("Rust".to_string()),
            stargazers_count: 42,
            default_branch: "main".to_string(),
        };

        let model = GitHubClient::api_repo_to_model(api_repo);

        assert_eq!(model.github_id, 12345);
        assert_eq!(model.name, "test-repo");
        assert_eq!(model.owner, "user");
        assert!(!model.private);
    }
}
