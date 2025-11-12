//! File modification and fix application module
//!
//! Provides operations for applying AI-generated fixes to files on disk,
//! with backup/restore capabilities and basic syntax validation.

use anyhow::{Context, Result};
use std::fs;
use std::path::Path;

/// Applies fixes to source files and manages backups
pub struct FixApplicator;

impl FixApplicator {
    /// Apply fix to file on disk
    ///
    /// Writes the fixed code content to the specified file path.
    /// File parent directories must exist.
    ///
    /// # Arguments
    /// * `file_path` - Path to file to write
    /// * `fixed_code` - The fixed source code content
    ///
    /// # Errors
    /// Returns error if file cannot be written (permissions, missing parent dir, etc.)
    pub fn apply_fix(file_path: &Path, fixed_code: &str) -> Result<()> {
        fs::write(file_path, fixed_code)
            .context(format!("Failed to apply fix to {:?}", file_path))
    }

    /// Read file content from disk
    ///
    /// # Arguments
    /// * `file_path` - Path to file to read
    ///
    /// # Returns
    /// File content as string
    ///
    /// # Errors
    /// Returns error if file cannot be read
    pub fn read_file(file_path: &Path) -> Result<String> {
        fs::read_to_string(file_path)
            .context(format!("Failed to read file {:?}", file_path))
    }

    /// Validate fix doesn't break basic syntax
    ///
    /// Performs basic validation that file exists and is readable.
    /// Future versions will add tree-sitter based syntax validation.
    ///
    /// # Arguments
    /// * `file_path` - Path to file to validate
    ///
    /// # Returns
    /// true if file exists and is readable, false otherwise
    ///
    /// # Errors
    /// Returns error only for unexpected filesystem issues
    pub fn validate_fix(file_path: &Path) -> Result<bool> {
        let content = fs::read_to_string(file_path)
            .context(format!("Failed to validate fix at {:?}", file_path))?;

        // Basic validation: file exists and is readable with content
        Ok(!content.is_empty())
    }

    /// Create backup of original file before applying fix
    ///
    /// Backs up file to `{filename}.bak` in same directory.
    /// Overwrites existing backup if present.
    ///
    /// # Arguments
    /// * `file_path` - Path to file to backup
    ///
    /// # Errors
    /// Returns error if backup cannot be created
    pub fn backup_file(file_path: &Path) -> Result<()> {
        let backup_path = format!("{}.bak", file_path.display());
        let content = fs::read(file_path)
            .context(format!("Failed to read file for backup: {:?}", file_path))?;

        fs::write(&backup_path, content)
            .context(format!("Failed to write backup file: {}", backup_path))
    }

    /// Restore file from backup
    ///
    /// Copies content from `{filename}.bak` back to original file
    /// and removes the backup file.
    ///
    /// # Arguments
    /// * `file_path` - Path to original file
    ///
    /// # Errors
    /// Returns error if backup cannot be read or file cannot be restored
    pub fn restore_from_backup(file_path: &Path) -> Result<()> {
        let backup_path = format!("{}.bak", file_path.display());

        let backup_content = fs::read(&backup_path)
            .context(format!("Failed to read backup file: {}", backup_path))?;

        fs::write(file_path, backup_content)
            .context(format!("Failed to restore file from backup: {:?}", file_path))?;

        fs::remove_file(&backup_path)
            .context(format!("Failed to remove backup file: {}", backup_path))
    }

    /// Check if backup exists for file
    ///
    /// # Arguments
    /// * `file_path` - Path to original file
    ///
    /// # Returns
    /// true if backup exists, false otherwise
    pub fn backup_exists(file_path: &Path) -> bool {
        let backup_path = format!("{}.bak", file_path.display());
        Path::new(&backup_path).exists()
    }

    /// Remove backup file without restoring
    ///
    /// Used after successful application when rollback is no longer needed.
    ///
    /// # Arguments
    /// * `file_path` - Path to original file (backup is `.bak` variant)
    ///
    /// # Errors
    /// Returns error if backup cannot be removed
    pub fn remove_backup(file_path: &Path) -> Result<()> {
        let backup_path = format!("{}.bak", file_path.display());
        fs::remove_file(&backup_path)
            .context(format!("Failed to remove backup file: {}", backup_path))
    }

    /// Get file size in bytes
    ///
    /// # Arguments
    /// * `file_path` - Path to file
    ///
    /// # Returns
    /// File size in bytes
    ///
    /// # Errors
    /// Returns error if file cannot be accessed
    pub fn get_file_size(file_path: &Path) -> Result<u64> {
        let metadata = fs::metadata(file_path)
            .context(format!("Failed to get metadata for {:?}", file_path))?;
        Ok(metadata.len())
    }

    /// Calculate line count in file
    ///
    /// # Arguments
    /// * `file_path` - Path to file
    ///
    /// # Returns
    /// Number of lines in file
    ///
    /// # Errors
    /// Returns error if file cannot be read
    pub fn get_line_count(file_path: &Path) -> Result<usize> {
        let content = Self::read_file(file_path)?;
        Ok(content.lines().count())
    }

    /// Compare original and fixed file for differences
    ///
    /// Returns number of lines changed (added + removed).
    /// Useful for reporting fix impact.
    ///
    /// # Arguments
    /// * `original_path` - Path to original file
    /// * `fixed_path` - Path to fixed file
    ///
    /// # Returns
    /// Number of differing lines
    ///
    /// # Errors
    /// Returns error if files cannot be read
    pub fn count_differences(original_path: &Path, fixed_path: &Path) -> Result<usize> {
        let original = Self::read_file(original_path)?;
        let fixed = Self::read_file(fixed_path)?;

        let original_lines: Vec<&str> = original.lines().collect();
        let fixed_lines: Vec<&str> = fixed.lines().collect();

        let mut diff_count = 0;

        // Count differing lines
        for (i, orig_line) in original_lines.iter().enumerate() {
            if i >= fixed_lines.len() || fixed_lines[i] != *orig_line {
                diff_count += 1;
            }
        }

        // Add count for lines added at end
        if fixed_lines.len() > original_lines.len() {
            diff_count += fixed_lines.len() - original_lines.len();
        }

        Ok(diff_count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_apply_fix() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("test.py");
        fs::write(&file, "print('old')").unwrap();

        FixApplicator::apply_fix(&file, "print('fixed')").unwrap();

        let content = fs::read_to_string(&file).unwrap();
        assert_eq!(content, "print('fixed')");
    }

    #[test]
    fn test_apply_fix_nonexistent_parent() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("nonexistent").join("test.py");

        let result = FixApplicator::apply_fix(&file, "content");
        assert!(result.is_err());
    }

    #[test]
    fn test_read_file() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("test.py");
        fs::write(&file, "original content").unwrap();

        let content = FixApplicator::read_file(&file).unwrap();
        assert_eq!(content, "original content");
    }

    #[test]
    fn test_read_nonexistent_file() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("nonexistent.py");

        let result = FixApplicator::read_file(&file);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_fix() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("test.py");
        fs::write(&file, "def hello(): pass").unwrap();

        let is_valid = FixApplicator::validate_fix(&file).unwrap();
        assert!(is_valid);
    }

    #[test]
    fn test_validate_fix_empty_file() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("test.py");
        fs::write(&file, "").unwrap();

        let is_valid = FixApplicator::validate_fix(&file).unwrap();
        assert!(!is_valid);
    }

    #[test]
    fn test_backup_file() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("test.py");
        fs::write(&file, "original").unwrap();

        FixApplicator::backup_file(&file).unwrap();

        let backup = dir.path().join("test.py.bak");
        assert!(backup.exists());
        let backup_content = fs::read_to_string(backup).unwrap();
        assert_eq!(backup_content, "original");
    }

    #[test]
    fn test_backup_nonexistent_file() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("nonexistent.py");

        let result = FixApplicator::backup_file(&file);
        assert!(result.is_err());
    }

    #[test]
    fn test_restore_from_backup() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("test.py");
        fs::write(&file, "original").unwrap();

        FixApplicator::backup_file(&file).unwrap();
        FixApplicator::apply_fix(&file, "modified").unwrap();
        FixApplicator::restore_from_backup(&file).unwrap();

        let content = fs::read_to_string(&file).unwrap();
        assert_eq!(content, "original");
    }

    #[test]
    fn test_restore_from_backup_no_backup() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("test.py");
        fs::write(&file, "original").unwrap();

        let result = FixApplicator::restore_from_backup(&file);
        assert!(result.is_err());
    }

    #[test]
    fn test_backup_exists() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("test.py");
        fs::write(&file, "original").unwrap();

        assert!(!FixApplicator::backup_exists(&file));

        FixApplicator::backup_file(&file).unwrap();

        assert!(FixApplicator::backup_exists(&file));
    }

    #[test]
    fn test_remove_backup() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("test.py");
        fs::write(&file, "original").unwrap();

        FixApplicator::backup_file(&file).unwrap();
        assert!(FixApplicator::backup_exists(&file));

        FixApplicator::remove_backup(&file).unwrap();

        assert!(!FixApplicator::backup_exists(&file));
    }

    #[test]
    fn test_get_file_size() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("test.py");
        let content = "hello world"; // 11 bytes
        fs::write(&file, content).unwrap();

        let size = FixApplicator::get_file_size(&file).unwrap();
        assert_eq!(size as usize, content.len());
    }

    #[test]
    fn test_get_line_count() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("test.py");
        fs::write(&file, "line1\nline2\nline3").unwrap();

        let lines = FixApplicator::get_line_count(&file).unwrap();
        assert_eq!(lines, 3);
    }

    #[test]
    fn test_count_differences() {
        let dir = TempDir::new().unwrap();
        let original = dir.path().join("original.py");
        let fixed = dir.path().join("fixed.py");

        fs::write(&original, "line1\nline2\nline3").unwrap();
        fs::write(&fixed, "line1\nmodified\nline3").unwrap();

        let diff_count = FixApplicator::count_differences(&original, &fixed).unwrap();
        assert_eq!(diff_count, 1);
    }

    #[test]
    fn test_count_differences_added_lines() {
        let dir = TempDir::new().unwrap();
        let original = dir.path().join("original.py");
        let fixed = dir.path().join("fixed.py");

        fs::write(&original, "line1\nline2").unwrap();
        fs::write(&fixed, "line1\nline2\nline3\nline4").unwrap();

        let diff_count = FixApplicator::count_differences(&original, &fixed).unwrap();
        assert_eq!(diff_count, 2); // 2 new lines
    }

    #[test]
    fn test_backup_and_restore_roundtrip() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("test.py");
        let original_content = "def main():\n    pass";
        fs::write(&file, original_content).unwrap();

        // Create backup
        FixApplicator::backup_file(&file).unwrap();

        // Apply fix
        let fixed_content = "def main():\n    return 0";
        FixApplicator::apply_fix(&file, fixed_content).unwrap();

        // Verify fix was applied
        let content = fs::read_to_string(&file).unwrap();
        assert_eq!(content, fixed_content);

        // Restore from backup
        FixApplicator::restore_from_backup(&file).unwrap();

        // Verify restoration
        let restored = fs::read_to_string(&file).unwrap();
        assert_eq!(restored, original_content);

        // Verify backup was removed
        assert!(!FixApplicator::backup_exists(&file));
    }
}
