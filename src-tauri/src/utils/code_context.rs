//! Code context extraction utilities
//!
//! Provides functions to extract code snippets with surrounding lines for better violation display

use std::fs;
use std::path::Path;

/// Extract code block with context from in-memory code string
///
/// # Arguments
/// * `code` - The full source code as a string
/// * `target_line` - The line number where the violation occurs (1-indexed)
/// * `context_lines` - Number of lines to include before and after (default: 5)
///
/// # Returns
/// * `(snippet, relative_line)` - Multi-line code snippet with line numbers and the relative line number of the problematic line
///
/// # Example
/// ```
/// let code = "line1\nline2\nline3\nline4\nline5";
/// let (snippet, relative_line) = extract_context_from_string(code, 3, 1);
/// // Returns lines 2-4 with line numbers, relative_line = 2
/// ```
pub fn extract_context_from_string(
    code: &str,
    target_line: i64,
    context_lines: usize,
) -> (String, i64) {
    let lines: Vec<&str> = code.lines().collect();
    let total_lines = lines.len();

    // Validate and clamp target line
    let target_line = target_line.max(1).min(total_lines as i64);
    let target_idx = (target_line - 1) as usize;

    // Calculate range with context
    let start_idx = target_idx.saturating_sub(context_lines);
    let end_idx = (target_idx + context_lines + 1).min(total_lines);

    // Extract the snippet with line numbers
    let snippet_lines: Vec<String> = lines[start_idx..end_idx]
        .iter()
        .enumerate()
        .map(|(idx, line)| {
            let actual_line_num = start_idx + idx + 1;
            format!("{:4} | {}", actual_line_num, line)
        })
        .collect();

    let snippet = snippet_lines.join("\n");

    // Calculate relative line number within the snippet (1-indexed)
    let relative_line = (target_idx - start_idx + 1) as i64;

    (snippet, relative_line)
}

/// Extract code block with surrounding context lines
///
/// # Arguments
/// * `file_path` - Path to the source file
/// * `target_line` - The line number where the violation occurs (1-indexed)
/// * `context_lines` - Number of lines to include before and after (default: 5)
///
/// # Returns
/// * `Ok((snippet, relative_line))` - Multi-line code snippet and the relative line number (1-indexed) of the problematic line within the snippet
/// * `Err(...)` - If file cannot be read
///
/// # Example
/// ```
/// let (snippet, relative_line) = extract_code_block_with_context("/path/to/file.py", 10, 5)?;
/// // Returns lines 5-15 with relative_line = 6 (line 10 is the 6th line in the snippet)
/// ```
pub fn extract_code_block_with_context(
    file_path: &Path,
    target_line: i64,
    context_lines: usize,
) -> Result<(String, i64), String> {
    // Read the entire file
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file {}: {}", file_path.display(), e))?;

    let lines: Vec<&str> = content.lines().collect();
    let total_lines = lines.len();

    // Validate target line
    if target_line < 1 || target_line > total_lines as i64 {
        return Err(format!(
            "Invalid line number: {} (file has {} lines)",
            target_line, total_lines
        ));
    }

    // Convert to 0-indexed
    let target_idx = (target_line - 1) as usize;

    // Calculate range with context
    let start_idx = target_idx.saturating_sub(context_lines);
    let end_idx = (target_idx + context_lines + 1).min(total_lines);

    // Extract the snippet
    let snippet_lines: Vec<String> = lines[start_idx..end_idx]
        .iter()
        .enumerate()
        .map(|(idx, line)| {
            // Add line numbers for readability
            let actual_line_num = start_idx + idx + 1;
            format!("{:4} | {}", actual_line_num, line)
        })
        .collect();

    let snippet = snippet_lines.join("\n");

    // Calculate relative line number within the snippet (1-indexed)
    let relative_line = (target_idx - start_idx + 1) as i64;

    Ok((snippet, relative_line))
}

/// Extract code block without line numbers (for Claude API)
///
/// # Arguments
/// * `file_path` - Path to the source file
/// * `target_line` - The line number where the violation occurs (1-indexed)
/// * `context_lines` - Number of lines to include before and after
///
/// # Returns
/// * `Ok(snippet)` - Multi-line code snippet without line numbers
/// * `Err(...)` - If file cannot be read
pub fn extract_code_block_plain(
    file_path: &Path,
    target_line: i64,
    context_lines: usize,
) -> Result<String, String> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file {}: {}", file_path.display(), e))?;

    let lines: Vec<&str> = content.lines().collect();
    let total_lines = lines.len();

    if target_line < 1 || target_line > total_lines as i64 {
        return Err(format!(
            "Invalid line number: {} (file has {} lines)",
            target_line, total_lines
        ));
    }

    let target_idx = (target_line - 1) as usize;
    let start_idx = target_idx.saturating_sub(context_lines);
    let end_idx = (target_idx + context_lines + 1).min(total_lines);

    let snippet = lines[start_idx..end_idx].join("\n");

    Ok(snippet)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn create_test_file(content: &str) -> NamedTempFile {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(content.as_bytes()).unwrap();
        file.flush().unwrap();
        file
    }

    #[test]
    fn test_extract_with_full_context() {
        let content = "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\n";
        let file = create_test_file(content);

        let (snippet, relative_line) =
            extract_code_block_with_context(file.path(), 5, 2).unwrap();

        // Should extract lines 3-7 (5 lines total: 2 before + target + 2 after)
        assert!(snippet.contains("line 3"));
        assert!(snippet.contains("line 7"));
        assert_eq!(relative_line, 3); // Line 5 is the 3rd line in the snippet (lines 3,4,5,6,7)
    }

    #[test]
    fn test_extract_at_file_start() {
        let content = "line 1\nline 2\nline 3\nline 4\nline 5\n";
        let file = create_test_file(content);

        let (snippet, relative_line) =
            extract_code_block_with_context(file.path(), 1, 2).unwrap();

        // Should extract lines 1-3 (can't go before line 1)
        assert!(snippet.contains("line 1"));
        assert!(snippet.contains("line 3"));
        assert_eq!(relative_line, 1); // Line 1 is the 1st line in the snippet
    }

    #[test]
    fn test_extract_at_file_end() {
        let content = "line 1\nline 2\nline 3\nline 4\nline 5\n";
        let file = create_test_file(content);

        let (snippet, relative_line) =
            extract_code_block_with_context(file.path(), 5, 2).unwrap();

        // Should extract lines 3-5 (can't go past line 5)
        assert!(snippet.contains("line 3"));
        assert!(snippet.contains("line 5"));
        assert_eq!(relative_line, 3); // Line 5 is the 3rd line in the snippet
    }

    #[test]
    fn test_extract_invalid_line() {
        let content = "line 1\nline 2\nline 3\n";
        let file = create_test_file(content);

        let result = extract_code_block_with_context(file.path(), 10, 2);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid line number"));
    }

    #[test]
    fn test_extract_plain() {
        let content = "line 1\nline 2\nline 3\nline 4\nline 5\n";
        let file = create_test_file(content);

        let snippet = extract_code_block_plain(file.path(), 3, 1).unwrap();

        // Should extract lines 2-4 without line numbers
        assert!(snippet.contains("line 2"));
        assert!(snippet.contains("line 3"));
        assert!(snippet.contains("line 4"));
        assert!(!snippet.contains("|")); // No line number formatting
    }
}
