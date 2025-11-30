//! File content hashing for incremental scanning
//!
//! Computes SHA256 hashes of file contents to detect changes between scans.
//! When a file's hash matches the previous scan, we can skip re-scanning it
//! and carry forward its violations.

use sha2::{Digest, Sha256};

/// Compute SHA256 hash of file content
///
/// Returns a 64-character hex string representing the hash.
/// This is used to detect file changes between scans.
///
/// # Example
/// ```
/// let hash = compute_hash("def login(): pass");
/// assert_eq!(hash.len(), 64);
/// ```
pub fn compute_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_hash_returns_64_chars() {
        let hash = compute_hash("hello world");
        assert_eq!(hash.len(), 64);
    }

    #[test]
    fn test_compute_hash_consistent() {
        let content = "def login(user, password): return True";
        let hash1 = compute_hash(content);
        let hash2 = compute_hash(content);
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_compute_hash_different_content() {
        let hash1 = compute_hash("version 1");
        let hash2 = compute_hash("version 2");
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_compute_hash_empty_string() {
        let hash = compute_hash("");
        assert_eq!(hash.len(), 64);
        // SHA256 of empty string is well-known
        assert_eq!(
            hash,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn test_compute_hash_unicode() {
        let hash = compute_hash("Hello, 世界! 🦀");
        assert_eq!(hash.len(), 64);
    }
}
