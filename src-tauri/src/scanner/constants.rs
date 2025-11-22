//! Scanner constants and configuration
//!
//! Centralized constants used across scanner modules

/// Directories to skip during file system scanning
///
/// These directories are commonly used for dependencies, build artifacts,
/// caches, and version control. Scanning them would waste resources and
/// produce false positives.
pub const SKIP_DIRECTORIES: &[&str] = &[
    // Dependencies
    "node_modules",
    "vendor",

    // Bundled/static assets
    "assets",
    "public",
    "static",

    // Version control
    ".git",

    // Python virtual environments and caches
    "venv",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    ".tox",
    ".coverage",

    // Build outputs
    "dist",
    "build",
    "out",
    "target",

    // Package manager and tooling
    ".cargo",
    ".next",
    ".babel_cache",
    ".cache",
    "coverage",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_skip_directories_not_empty() {
        assert!(!SKIP_DIRECTORIES.is_empty());
    }

    #[test]
    fn test_skip_directories_contains_common_dirs() {
        assert!(SKIP_DIRECTORIES.contains(&"node_modules"));
        assert!(SKIP_DIRECTORIES.contains(&".git"));
        assert!(SKIP_DIRECTORIES.contains(&"target"));
        assert!(SKIP_DIRECTORIES.contains(&"venv"));
    }
}
