//! Path validation module
//!
//! Provides security functions to prevent directory traversal attacks
//! and validate file paths before file system operations

use std::path::{Path, PathBuf};
use anyhow::{Result, anyhow};

/// Validate and canonicalize a file path to prevent directory traversal
///
/// This function ensures that:
/// 1. The path is relative (not absolute)
/// 2. The path doesn't contain ".." components
/// 3. The resolved path stays within the base directory
///
/// # Arguments
/// * `base_dir` - The base directory that paths must remain within
/// * `relative_path` - The relative path to validate
///
/// # Returns
/// * `Ok(PathBuf)` - The canonicalized, validated path
/// * `Err` - If validation fails
///
/// # Security
/// This function is critical for preventing path traversal attacks.
/// It must be called before any file read/write operations.
pub fn validate_file_path(base_dir: &Path, relative_path: &str) -> Result<PathBuf> {
    // Reject absolute paths
    if Path::new(relative_path).is_absolute() {
        return Err(anyhow!("Absolute paths are not allowed: {}", relative_path));
    }

    // Reject paths with .. components (path traversal)
    if relative_path.contains("..") {
        return Err(anyhow!("Path traversal detected in: {}", relative_path));
    }

    // Reject paths with null bytes (potential exploit)
    if relative_path.contains('\0') {
        return Err(anyhow!("Null byte detected in path: {}", relative_path));
    }

    // Join with base directory
    let full_path = base_dir.join(relative_path);

    // Canonicalize to resolve symlinks and relative components
    let canonical = full_path.canonicalize()
        .map_err(|e| anyhow!("Invalid or non-existent path {}: {}", relative_path, e))?;

    // Ensure the canonical path is still within base_dir
    let canonical_base = base_dir.canonicalize()
        .map_err(|e| anyhow!("Invalid base directory: {}", e))?;

    if !canonical.starts_with(&canonical_base) {
        return Err(anyhow!(
            "Path escapes project directory: {} is not within {}",
            canonical.display(),
            canonical_base.display()
        ));
    }

    Ok(canonical)
}

/// Validate a project path is not a system directory
///
/// Prevents scanning of sensitive system directories that could
/// expose system secrets or cause performance issues
///
/// # Arguments
/// * `path` - The path to validate
///
/// # Returns
/// * `Ok(())` - If the path is safe to scan
/// * `Err` - If the path is a forbidden system directory
pub fn validate_project_path(path: &Path) -> Result<()> {
    // Ensure path exists
    if !path.exists() {
        return Err(anyhow!("Project path does not exist: {}", path.display()));
    }

    // Ensure path is a directory
    if !path.is_dir() {
        return Err(anyhow!("Project path is not a directory: {}", path.display()));
    }

    // Canonicalize to resolve symlinks
    let canonical = path.canonicalize()
        .map_err(|e| anyhow!("Invalid project path: {}", e))?;

    // List of forbidden system directories
    let forbidden = [
        "/",           // Root
        "/etc",        // System configuration
        "/usr",        // System binaries
        "/bin",        // Essential binaries
        "/sbin",       // System binaries
        "/var",        // Variable data
        "/sys",        // System information
        "/proc",       // Process information
        "/boot",       // Boot files
        "/dev",        // Device files
        "/root",       // Root user home
        "/tmp",        // Temporary (could be large)
    ];

    let path_str = canonical.to_string_lossy();

    for forbidden_path in &forbidden {
        // Check if scanning exactly this directory or a shallow subdirectory
        if path_str.starts_with(forbidden_path) {
            let remainder = &path_str[forbidden_path.len()..];
            // Allow only if significantly nested (more than 10 chars deep)
            if remainder.is_empty() || remainder.len() <= 10 {
                return Err(anyhow!(
                    "Cannot scan system directory: {}",
                    path_str
                ));
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::fs;

    #[test]
    fn test_reject_absolute_path() {
        let base = TempDir::new().unwrap();
        let result = validate_file_path(base.path(), "/etc/passwd");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Absolute paths"));
    }

    #[test]
    fn test_reject_parent_traversal() {
        let base = TempDir::new().unwrap();
        let result = validate_file_path(base.path(), "../../../etc/passwd");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Path traversal"));
    }

    #[test]
    fn test_reject_null_byte() {
        let base = TempDir::new().unwrap();
        let result = validate_file_path(base.path(), "file\0.txt");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Null byte"));
    }

    #[test]
    fn test_allow_valid_relative_path() {
        let base = TempDir::new().unwrap();
        fs::write(base.path().join("test.txt"), "content").unwrap();

        let result = validate_file_path(base.path(), "test.txt");
        assert!(result.is_ok());

        let validated = result.unwrap();
        assert!(validated.starts_with(base.path()));
        assert!(validated.ends_with("test.txt"));
    }

    #[test]
    fn test_allow_nested_relative_path() {
        let base = TempDir::new().unwrap();
        let subdir = base.path().join("subdir");
        fs::create_dir(&subdir).unwrap();
        fs::write(subdir.join("file.txt"), "content").unwrap();

        let result = validate_file_path(base.path(), "subdir/file.txt");
        assert!(result.is_ok());

        let validated = result.unwrap();
        assert!(validated.starts_with(base.path()));
        assert!(validated.ends_with("file.txt"));
    }

    #[test]
    fn test_reject_nonexistent_file() {
        let base = TempDir::new().unwrap();
        let result = validate_file_path(base.path(), "nonexistent.txt");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid or non-existent"));
    }

    #[test]
    fn test_reject_system_directory_root() {
        let result = validate_project_path(Path::new("/"));
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("system directory"));
    }

    #[test]
    fn test_reject_system_directory_etc() {
        let result = validate_project_path(Path::new("/etc"));
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("system directory"));
    }

    #[test]
    fn test_reject_system_directory_usr() {
        let result = validate_project_path(Path::new("/usr"));
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("system directory"));
    }

    #[test]
    fn test_allow_user_directory() {
        let home = std::env::var("HOME").unwrap();
        let test_dir = TempDir::new_in(&home).unwrap();

        let result = validate_project_path(test_dir.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_reject_nonexistent_project_path() {
        let result = validate_project_path(Path::new("/nonexistent/path"));
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("does not exist"));
    }

    #[test]
    fn test_symlink_resolution() {
        let base = TempDir::new().unwrap();
        let real_file = base.path().join("real.txt");
        fs::write(&real_file, "content").unwrap();

        // Create symlink
        let link_path = base.path().join("link.txt");
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&real_file, &link_path).unwrap();

            let result = validate_file_path(base.path(), "link.txt");
            assert!(result.is_ok());

            // Should resolve to real file
            let validated = result.unwrap();
            assert_eq!(validated, real_file.canonicalize().unwrap());
        }
    }
}
