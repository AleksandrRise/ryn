//! Git operations for applying fixes and managing commits
//!
//! Provides functionality for committing fixes to git repositories,
//! checking repository status, and managing branches.

use anyhow::{anyhow, Context, Result};
use git2::{Signature, Repository};
use std::path::Path;

/// Git operations for fix application and version control
pub struct GitOperations;

impl GitOperations {
    /// Check if git repository is clean (no uncommitted changes)
    ///
    /// Returns true if the repository has no modified, staged, or untracked files.
    ///
    /// # Arguments
    /// * `repo_path` - Path to git repository root
    ///
    /// # Returns
    /// true if repository is clean, false if there are uncommitted changes
    ///
    /// # Errors
    /// Returns error if repository cannot be opened or status cannot be determined
    pub fn is_clean(repo_path: &Path) -> Result<bool> {
        let repo = Repository::open(repo_path)
            .context("Failed to open git repository")?;

        let status = repo.statuses(None)
            .context("Failed to get repository status")?;

        Ok(status.is_empty())
    }

    /// Get current branch name
    ///
    /// Returns the short name of the current branch (e.g., "main", "develop").
    /// Returns error if repository is in detached HEAD state.
    ///
    /// # Arguments
    /// * `repo_path` - Path to git repository root
    ///
    /// # Returns
    /// Current branch name as string
    ///
    /// # Errors
    /// Returns error if HEAD cannot be read or is detached
    pub fn get_current_branch(repo_path: &Path) -> Result<String> {
        let repo = Repository::open(repo_path)
            .context("Failed to open git repository")?;

        let head = repo.head()
            .context("Failed to get repository HEAD")?;

        let branch = head
            .shorthand()
            .ok_or_else(|| anyhow!("Failed to get branch shorthand"))?;

        Ok(branch.to_string())
    }

    /// Commit fix to repository
    ///
    /// Stages the specified file and creates a commit with the given message.
    /// Uses automated signature "ryn-ai" <compliance@ryn.local>.
    ///
    /// # Arguments
    /// * `repo_path` - Path to git repository root
    /// * `file_path` - Path to file to commit (relative or absolute)
    /// * `commit_message` - Commit message
    ///
    /// # Returns
    /// Git commit SHA-1 hash as string (40 hex characters)
    ///
    /// # Errors
    /// Returns error if:
    /// - Repository cannot be opened
    /// - File does not exist
    /// - File cannot be added to index
    /// - Commit cannot be created
    pub fn commit_fix(
        repo_path: &Path,
        file_path: &Path,
        commit_message: &str,
    ) -> Result<String> {
        let repo = Repository::open(repo_path)
            .context("Failed to open git repository")?;

        // Verify file exists
        let absolute_path = if file_path.is_absolute() {
            file_path.to_path_buf()
        } else {
            repo_path.join(file_path)
        };

        if !absolute_path.exists() {
            return Err(anyhow!("File does not exist: {:?}", absolute_path));
        }

        // Get relative path for index
        let relative_path = absolute_path
            .strip_prefix(repo_path)
            .unwrap_or(file_path);

        // Add file to index
        let mut index = repo.index()
            .context("Failed to get repository index")?;

        index.add_path(relative_path)
            .context("Failed to add file to index")?;

        index.write()
            .context("Failed to write index")?;

        // Create commit
        let signature = Signature::now("ryn-ai", "compliance@ryn.local")
            .context("Failed to create git signature")?;

        let parent_commit = repo.head()
            .context("Failed to get HEAD")?
            .peel_to_commit()
            .context("Failed to get parent commit")?;

        let tree_id = index.write_tree()
            .context("Failed to write tree")?;

        let tree = repo.find_tree(tree_id)
            .context("Failed to find tree")?;

        let oid = repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            commit_message,
            &tree,
            &[&parent_commit],
        ).context("Failed to create commit")?;

        Ok(oid.to_string())
    }

    /// Get recent commits from repository
    ///
    /// Returns commit history in reverse chronological order (most recent first).
    /// Useful for displaying recent fixes or commit log.
    ///
    /// # Arguments
    /// * `repo_path` - Path to git repository root
    /// * `limit` - Maximum number of commits to return
    ///
    /// # Returns
    /// Vector of CommitInfo structs with SHA, message, and author
    ///
    /// # Errors
    /// Returns error if repository cannot be opened or history cannot be read
    pub fn get_recent_commits(repo_path: &Path, limit: usize) -> Result<Vec<CommitInfo>> {
        let repo = Repository::open(repo_path)
            .context("Failed to open git repository")?;

        let mut commits = Vec::new();

        let mut revwalk = repo.revwalk()
            .context("Failed to create revwalk")?;

        revwalk.push_head()
            .context("Failed to push HEAD")?;

        for (idx, oid_result) in revwalk.enumerate() {
            if idx >= limit {
                break;
            }

            if let Ok(oid) = oid_result {
                if let Ok(commit) = repo.find_commit(oid) {
                    commits.push(CommitInfo {
                        sha: commit.id().to_string(),
                        message: commit.message()
                            .unwrap_or("Unknown message")
                            .to_string(),
                        author: commit.author().name()
                            .unwrap_or("Unknown")
                            .to_string(),
                    });
                }
            }
        }

        Ok(commits)
    }

    /// Check if file has uncommitted changes
    ///
    /// Returns true if the file has modifications, additions, or deletions
    /// that have not been committed.
    ///
    /// # Arguments
    /// * `repo_path` - Path to git repository root
    /// * `file_path` - Path to file to check (relative or absolute)
    ///
    /// # Returns
    /// true if file has changes, false if file is committed
    ///
    /// # Errors
    /// Returns error if repository cannot be opened or status cannot be checked
    pub fn file_has_changes(repo_path: &Path, file_path: &Path) -> Result<bool> {
        let repo = Repository::open(repo_path)
            .context("Failed to open git repository")?;

        let statuses = repo.statuses(None)
            .context("Failed to get repository status")?;

        let file_path_str = file_path.to_string_lossy();

        for entry in statuses.iter() {
            let entry_path = entry.path().unwrap_or("");
            if entry_path == file_path_str.as_ref() {
                return Ok(true);
            }
        }

        Ok(false)
    }

    /// Get total number of commits in current branch
    ///
    /// # Arguments
    /// * `repo_path` - Path to git repository root
    ///
    /// # Returns
    /// Total commit count
    ///
    /// # Errors
    /// Returns error if repository cannot be opened or history cannot be traversed
    pub fn get_commit_count(repo_path: &Path) -> Result<usize> {
        let repo = Repository::open(repo_path)
            .context("Failed to open git repository")?;

        let mut revwalk = repo.revwalk()
            .context("Failed to create revwalk")?;

        revwalk.push_head()
            .context("Failed to push HEAD")?;

        Ok(revwalk.count())
    }

    /// Get last commit SHA
    ///
    /// # Arguments
    /// * `repo_path` - Path to git repository root
    ///
    /// # Returns
    /// SHA-1 hash of HEAD commit
    ///
    /// # Errors
    /// Returns error if HEAD cannot be read
    pub fn get_last_commit_sha(repo_path: &Path) -> Result<String> {
        let repo = Repository::open(repo_path)
            .context("Failed to open git repository")?;

        let head = repo.head()
            .context("Failed to get repository HEAD")?;

        let commit = head.peel_to_commit()
            .context("Failed to get HEAD commit")?;

        Ok(commit.id().to_string())
    }

    /// Get last commit message
    ///
    /// # Arguments
    /// * `repo_path` - Path to git repository root
    ///
    /// # Returns
    /// Message of HEAD commit
    ///
    /// # Errors
    /// Returns error if HEAD cannot be read
    pub fn get_last_commit_message(repo_path: &Path) -> Result<String> {
        let repo = Repository::open(repo_path)
            .context("Failed to open git repository")?;

        let head = repo.head()
            .context("Failed to get repository HEAD")?;

        let commit = head.peel_to_commit()
            .context("Failed to get HEAD commit")?;

        Ok(commit.message()
            .unwrap_or("Unknown message")
            .to_string())
    }

    /// Check if file was modified in last commit
    ///
    /// # Arguments
    /// * `repo_path` - Path to git repository root
    /// * `file_path` - Path to file to check
    ///
    /// # Returns
    /// true if file was changed in last commit
    ///
    /// # Errors
    /// Returns error if repository or commits cannot be read
    pub fn file_modified_in_last_commit(repo_path: &Path, file_path: &Path) -> Result<bool> {
        let repo = Repository::open(repo_path)
            .context("Failed to open git repository")?;

        let head = repo.head()
            .context("Failed to get repository HEAD")?;

        let commit = head.peel_to_commit()
            .context("Failed to get HEAD commit")?;

        if commit.parent_count() == 0 {
            // Initial commit
            return Ok(false);
        }

        let parent = commit.parent(0)
            .context("Failed to get parent commit")?;

        let diff = repo.diff_tree_to_tree(
            Some(&parent.tree().context("Failed to get parent tree")?),
            Some(&commit.tree().context("Failed to get current tree")?),
            None,
        ).context("Failed to create diff")?;

        let file_path_str = file_path.to_string_lossy();

        for delta in diff.deltas() {
            if let Some(path) = delta.new_file().path() {
                if path.to_string_lossy() == file_path_str.as_ref() {
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }
}

/// Information about a single commit
#[derive(Debug, Clone, PartialEq)]
pub struct CommitInfo {
    /// SHA-1 commit hash (40 hex characters)
    pub sha: String,
    /// Commit message
    pub message: String,
    /// Author name
    pub author: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::fs;

    fn init_test_repo() -> (TempDir, Repository) {
        let dir = TempDir::new().unwrap();
        let repo = Repository::init(dir.path()).unwrap();

        // Create initial commit
        {
            let mut index = repo.index().unwrap();
            fs::write(dir.path().join("README.md"), "# Test").unwrap();
            index.add_path(Path::new("README.md")).unwrap();
            index.write().unwrap();

            let tree_id = index.write_tree().unwrap();
            let tree = repo.find_tree(tree_id).unwrap();
            let sig = Signature::now("test", "test@test.com").unwrap();

            repo.commit(
                Some("HEAD"),
                &sig,
                &sig,
                "Initial commit",
                &tree,
                &[],
            ).unwrap();
        }

        (dir, repo)
    }

    #[test]
    fn test_is_clean_after_init() {
        let (dir, _repo) = init_test_repo();
        let is_clean = GitOperations::is_clean(dir.path()).unwrap();
        assert!(is_clean);
    }

    #[test]
    fn test_is_clean_with_untracked_changes() {
        let (dir, _repo) = init_test_repo();

        // Add untracked file
        fs::write(dir.path().join("new_file.txt"), "content").unwrap();

        let is_clean = GitOperations::is_clean(dir.path()).unwrap();
        assert!(!is_clean);
    }

    #[test]
    fn test_is_clean_with_modified_file() {
        let (dir, _repo) = init_test_repo();

        // Modify existing file
        fs::write(dir.path().join("README.md"), "# Modified").unwrap();

        let is_clean = GitOperations::is_clean(dir.path()).unwrap();
        assert!(!is_clean);
    }

    #[test]
    fn test_get_current_branch() {
        let (dir, _repo) = init_test_repo();
        let branch = GitOperations::get_current_branch(dir.path()).unwrap();
        assert_eq!(branch, "master");
    }

    #[test]
    fn test_commit_fix() {
        let (dir, _repo) = init_test_repo();

        // Create file
        let file = dir.path().join("fix.py");
        fs::write(&file, "original").unwrap();

        // Commit it
        let sha = GitOperations::commit_fix(
            dir.path(),
            Path::new("fix.py"),
            "Fix CC6.1 violation"
        ).unwrap();

        assert!(!sha.is_empty());
        assert_eq!(sha.len(), 40); // Git SHA1 is 40 hex chars
    }

    #[test]
    fn test_commit_fix_nonexistent_file() {
        let (dir, _repo) = init_test_repo();

        let result = GitOperations::commit_fix(
            dir.path(),
            Path::new("nonexistent.py"),
            "Fix message"
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_get_recent_commits() {
        let (dir, _repo) = init_test_repo();

        let commits = GitOperations::get_recent_commits(dir.path(), 5).unwrap();
        assert!(!commits.is_empty());
        assert_eq!(commits[0].message, "Initial commit");
        assert_eq!(commits[0].author, "test");
    }

    #[test]
    fn test_get_recent_commits_limit() {
        let (dir, repo) = init_test_repo();

        // Add second commit
        let file = dir.path().join("file2.txt");
        fs::write(&file, "content").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("file2.txt")).unwrap();
        index.write().unwrap();

        let sig = Signature::now("test", "test@test.com").unwrap();
        let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();

        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Second commit",
            &tree,
            &[&parent],
        ).unwrap();

        // Request only 1 commit
        let commits = GitOperations::get_recent_commits(dir.path(), 1).unwrap();
        assert_eq!(commits.len(), 1);
    }

    #[test]
    fn test_file_has_changes_false() {
        let (dir, _repo) = init_test_repo();

        let has_changes = GitOperations::file_has_changes(
            dir.path(),
            Path::new("README.md")
        ).unwrap();

        assert!(!has_changes);
    }

    #[test]
    fn test_file_has_changes_true() {
        let (dir, _repo) = init_test_repo();

        // Modify file
        fs::write(dir.path().join("README.md"), "# Modified").unwrap();

        let has_changes = GitOperations::file_has_changes(
            dir.path(),
            Path::new("README.md")
        ).unwrap();

        assert!(has_changes);
    }

    #[test]
    fn test_get_commit_count() {
        let (dir, repo) = init_test_repo();

        let count = GitOperations::get_commit_count(dir.path()).unwrap();
        assert_eq!(count, 1);

        // Add another commit
        let file = dir.path().join("file.txt");
        fs::write(&file, "content").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("file.txt")).unwrap();
        index.write().unwrap();

        let sig = Signature::now("test", "test@test.com").unwrap();
        let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();

        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Second commit",
            &tree,
            &[&parent],
        ).unwrap();

        let count = GitOperations::get_commit_count(dir.path()).unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_get_last_commit_sha() {
        let (dir, _repo) = init_test_repo();

        let sha = GitOperations::get_last_commit_sha(dir.path()).unwrap();
        assert_eq!(sha.len(), 40); // SHA1 length
        assert!(sha.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_get_last_commit_message() {
        let (dir, _repo) = init_test_repo();

        let msg = GitOperations::get_last_commit_message(dir.path()).unwrap();
        assert_eq!(msg, "Initial commit");
    }

    #[test]
    fn test_file_modified_in_last_commit_true() {
        let (dir, repo) = init_test_repo();

        // Modify README.md
        fs::write(dir.path().join("README.md"), "# Modified").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("README.md")).unwrap();
        index.write().unwrap();

        let sig = Signature::now("test", "test@test.com").unwrap();
        let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();

        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Modified README",
            &tree,
            &[&parent],
        ).unwrap();

        let modified = GitOperations::file_modified_in_last_commit(
            dir.path(),
            Path::new("README.md")
        ).unwrap();

        assert!(modified);
    }

    #[test]
    fn test_file_modified_in_last_commit_false() {
        let (dir, repo) = init_test_repo();

        // Add new file, don't modify README
        let file = dir.path().join("newfile.txt");
        fs::write(&file, "content").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("newfile.txt")).unwrap();
        index.write().unwrap();

        let sig = Signature::now("test", "test@test.com").unwrap();
        let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();

        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Added new file",
            &tree,
            &[&parent],
        ).unwrap();

        let modified = GitOperations::file_modified_in_last_commit(
            dir.path(),
            Path::new("README.md")
        ).unwrap();

        assert!(!modified);
    }

    #[test]
    fn test_commit_multiple_operations() {
        let (dir, _repo) = init_test_repo();

        // Create and commit multiple files
        let file1 = dir.path().join("fix1.py");
        fs::write(&file1, "fix 1").unwrap();

        let sha1 = GitOperations::commit_fix(
            dir.path(),
            Path::new("fix1.py"),
            "Fix 1"
        ).unwrap();

        assert_eq!(sha1.len(), 40);

        let file2 = dir.path().join("fix2.py");
        fs::write(&file2, "fix 2").unwrap();

        let sha2 = GitOperations::commit_fix(
            dir.path(),
            Path::new("fix2.py"),
            "Fix 2"
        ).unwrap();

        assert_eq!(sha2.len(), 40);
        assert_ne!(sha1, sha2);

        let commits = GitOperations::get_recent_commits(dir.path(), 3).unwrap();
        assert_eq!(commits.len(), 3); // Initial + 2 fixes
    }
}
