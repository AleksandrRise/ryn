//! LSP Diagnostics Conversion
//!
//! Converts Ryn violations to LSP Diagnostic objects.

use anyhow::Result;
use std::fs;
use tower_lsp::lsp_types::{Diagnostic, DiagnosticSeverity, Position, Range, Url};

use crate::models::violation::Violation;

/// Convert a Ryn violation to an LSP diagnostic
pub fn violation_to_diagnostic(violation: &Violation, file_uri: &Url) -> Result<Diagnostic> {
    // Read the file to get the actual line content
    let file_path = file_uri
        .to_file_path()
        .map_err(|_| anyhow::anyhow!("Invalid file URI: {}", file_uri))?;

    let content = fs::read_to_string(&file_path)?;
    let lines: Vec<&str> = content.lines().collect();

    // Get the target line (violations use 1-indexed line numbers)
    let line_idx = (violation.line_number - 1) as usize;
    let line = lines.get(line_idx).unwrap_or(&"");

    // Find the diagnostic range using function_name or fallback
    let (start_col, end_col) = find_diagnostic_range(line, violation);

    // LSP uses 0-indexed line numbers
    let lsp_line = (violation.line_number - 1) as u32;

    Ok(Diagnostic {
        range: Range {
            start: Position {
                line: lsp_line,
                character: start_col as u32,
            },
            end: Position {
                line: lsp_line,
                character: end_col as u32,
            },
        },
        severity: Some(map_severity(&violation.severity)),
        code: Some(tower_lsp::lsp_types::NumberOrString::String(
            violation.control_id.clone(),
        )),
        source: Some("ryn".to_string()),
        message: violation.description.clone(),
        related_information: None,
        tags: None,
        code_description: None,
        data: None,
    })
}

/// Find the character range to highlight in the line
///
/// Uses a 3-level fallback:
/// 1. function_name if available and found in line
/// 2. class_name if available and found in line
/// 3. Skip leading whitespace, highlight rest of line
fn find_diagnostic_range(line: &str, violation: &Violation) -> (usize, usize) {
    // Priority 1: Use function_name if available
    if let Some(func) = &violation.function_name {
        if let Some(pos) = line.find(func.as_str()) {
            return (pos, pos + func.len());
        }
    }

    // Priority 2: Use class_name if available
    if let Some(class) = &violation.class_name {
        if let Some(pos) = line.find(class.as_str()) {
            return (pos, pos + class.len());
        }
    }

    // Priority 3: Skip leading whitespace, highlight rest of line
    let start = line.chars().take_while(|c| c.is_whitespace()).count();
    let end = line.trim_end().len();
    (start, end.max(start + 1))
}

/// Map Ryn severity to LSP DiagnosticSeverity
fn map_severity(severity: &str) -> DiagnosticSeverity {
    match severity {
        "critical" => DiagnosticSeverity::ERROR,
        "high" => DiagnosticSeverity::ERROR,
        "medium" => DiagnosticSeverity::WARNING,
        "low" => DiagnosticSeverity::INFORMATION,
        _ => DiagnosticSeverity::HINT,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_violation(function_name: Option<&str>, class_name: Option<&str>) -> Violation {
        Violation {
            id: 1,
            scan_id: 1,
            control_id: "CC6.1".to_string(),
            severity: "high".to_string(),
            description: "Test violation".to_string(),
            file_path: "test.py".to_string(),
            line_number: 1,
            code_snippet: "".to_string(),
            status: "open".to_string(),
            detected_at: "2024-01-01".to_string(),
            detection_method: "regex".to_string(),
            confidence_score: None,
            llm_reasoning: None,
            regex_reasoning: None,
            function_name: function_name.map(String::from),
            class_name: class_name.map(String::from),
        }
    }

    #[test]
    fn test_find_range_with_function_name() {
        let violation = make_violation(Some("login"), None);
        let line = "def login(username, password):";
        let (start, end) = find_diagnostic_range(line, &violation);

        assert_eq!(start, 4); // Position of "login"
        assert_eq!(end, 9); // End of "login"
    }

    #[test]
    fn test_find_range_with_class_name() {
        let violation = make_violation(None, Some("UserAuth"));
        let line = "class UserAuth:";
        let (start, end) = find_diagnostic_range(line, &violation);

        assert_eq!(start, 6); // Position of "UserAuth"
        assert_eq!(end, 14); // End of "UserAuth"
    }

    #[test]
    fn test_find_range_fallback() {
        let violation = make_violation(None, None);
        let line = "    return user.id";
        let (start, end) = find_diagnostic_range(line, &violation);

        assert_eq!(start, 4); // After leading whitespace
        assert!(end > start); // Highlights something
    }

    #[test]
    fn test_find_range_empty_line() {
        let violation = make_violation(None, None);
        let line = "";
        let (start, end) = find_diagnostic_range(line, &violation);

        assert_eq!(start, 0);
        assert_eq!(end, 1); // Minimum highlight of 1 char
    }

    #[test]
    fn test_map_severity() {
        assert_eq!(map_severity("critical"), DiagnosticSeverity::ERROR);
        assert_eq!(map_severity("high"), DiagnosticSeverity::ERROR);
        assert_eq!(map_severity("medium"), DiagnosticSeverity::WARNING);
        assert_eq!(map_severity("low"), DiagnosticSeverity::INFORMATION);
        assert_eq!(map_severity("unknown"), DiagnosticSeverity::HINT);
    }
}
