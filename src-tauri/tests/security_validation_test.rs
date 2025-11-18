//! Security and Input Validation Tests
//! Tests for SQL injection, XSS, path traversal, and input sanitization

mod common;

use common::TestProject;
use rusqlite::Result;
use ryn::db::queries;

#[test]
fn test_sql_injection_in_project_name() {
    let test_project = TestProject::new("test_sql_injection_in_project_name").unwrap();
    let conn = test_project.connection();

    // Attempt SQL injection in project name
    let malicious_name = "test'; DROP TABLE projects; --";
    let path = test_project.create_file("test.py", "print('test')").unwrap();

    let project_id = queries::insert_project(&conn, malicious_name, path.to_str().unwrap(), None).unwrap();

    // Verify project was inserted with the malicious string as literal text
    let project = queries::select_project(&conn, project_id).unwrap().unwrap();
    assert_eq!(project.name, malicious_name);

    // Verify projects table still exists
    let projects = queries::select_projects(&conn).unwrap();
    assert!(!projects.is_empty());
}

#[test]
fn test_sql_injection_in_setting_key() {
    let test_project = TestProject::new("test_sql_injection_in_setting_key").unwrap();
    let conn = test_project.connection();

    let malicious_key = "key'; DELETE FROM settings WHERE '1'='1";
    let result = queries::insert_or_update_setting(conn, malicious_key, "value");

    // Should either succeed with escaped value or fail gracefully
    match result {
        Ok(_) => {
            // Verify settings table still exists and has data
            let settings = queries::select_all_settings(conn).unwrap();
            assert!(!settings.is_empty(), "Settings table should not be empty");
        }
        Err(_) => {
            // Graceful failure is acceptable
        }
    }
}

#[test]
fn test_xss_in_violation_description() {
    let test_project = TestProject::new("test_xss_in_violation_description").unwrap();
    let conn = test_project.connection();

    let project_id = test_project.insert_project("test-project", "/tmp/test", None).unwrap();
    let scan_id = test_project.insert_scan(project_id, "completed").unwrap();

    let xss_payload = "<script>alert('XSS')</script>";
    let violation_id = test_project.insert_violation(
        scan_id,
        "CC6.1",
        "critical",
        xss_payload,
        "/test/file.py",
        1,
        "print('test')",
        Some("regex"),
        None,
        None,
        None,
    ).unwrap();

    // Verify XSS payload stored as literal text
    let violation = queries::select_violation(&conn, violation_id).unwrap().unwrap();
    assert_eq!(violation.description, xss_payload);
}

#[test]
fn test_path_traversal_in_project_path() {
    let test_project = TestProject::new("test_path_traversal_in_project_path").unwrap();
    let conn = test_project.connection();

    // Attempt path traversal
    let traversal_path = "../../../etc/passwd";
    let result = queries::insert_project(&conn, "malicious", traversal_path, None);

    // Should either sanitize or store as-is (validation happens at command layer)
    match result {
        Ok(project_id) => {
            let project = queries::select_project(&conn, project_id).unwrap().unwrap();
            assert_eq!(project.path, traversal_path); // Stored literally
        }
        Err(_) => {
            // Rejection is also acceptable
        }
    }
}

#[test]
fn test_path_traversal_in_file_path() {
    let test_project = TestProject::new("test_path_traversal_in_file_path").unwrap();
    let conn = test_project.connection();

    let project_id = test_project.insert_project("test-project", "/tmp/test", None).unwrap();
    let scan_id = test_project.insert_scan(project_id, "completed").unwrap();

    let traversal_file = "../../../../etc/shadow";
    let result = test_project.insert_violation(
        scan_id,
        "CC6.1",
        "critical",
        "Path traversal attempt",
        traversal_file,
        1,
        "code",
        Some("regex"),
        None,
        None,
        None,
    );

    assert!(result.is_ok(), "Should store file path literally");
}

#[test]
fn test_unicode_in_project_name() {
    let test_project = TestProject::new("test_unicode_in_project_name").unwrap();
    let conn = test_project.connection();

    let unicode_name = "项目测试 🚀 Тест مشروع";
    let path = test_project.create_file("test.py", "print('test')").unwrap();

    let project_id = queries::insert_project(&conn, unicode_name, path.to_str().unwrap(), None).unwrap();
    let project = queries::select_project(&conn, project_id).unwrap().unwrap();

    assert_eq!(project.name, unicode_name);
}

#[test]
fn test_null_byte_injection() {
    let test_project = TestProject::new("test_null_byte_injection").unwrap();
    let conn = test_project.connection();

    let null_byte_name = "test\0.py";
    let path = test_project.create_file("test.py", "print('test')").unwrap();

    // Null bytes should be handled or rejected
    let result = queries::insert_project(&conn, null_byte_name, path.to_str().unwrap(), None);

    match result {
        Ok(project_id) => {
            let project = queries::select_project(&conn, project_id).unwrap().unwrap();
            // Verify null byte handling
            assert!(project.name.contains("test"));
        }
        Err(_) => {
            // Rejection is acceptable
        }
    }
}

#[test]
fn test_very_long_string_project_name() {
    let test_project = TestProject::new("test_very_long_string_project_name").unwrap();
    let conn = test_project.connection();

    // 10,000 character string
    let long_name = "a".repeat(10000);
    let path = test_project.create_file("test.py", "print('test')").unwrap();

    let result = queries::insert_project(&conn, &long_name, path.to_str().unwrap(), None);

    // Should handle gracefully (truncate, error, or accept)
    match result {
        Ok(project_id) => {
            let project = queries::select_project(&conn, project_id).unwrap().unwrap();
            assert!(!project.name.is_empty());
        }
        Err(e) => {
            // Database limit error is acceptable
            assert!(e.to_string().contains("too") || e.to_string().contains("large"));
        }
    }
}

#[test]
fn test_control_characters_in_description() {
    let test_project = TestProject::new("test_control_characters_in_description").unwrap();
    let conn = test_project.connection();

    let project_id = test_project.insert_project("test-project", "/tmp/test", None).unwrap();
    let scan_id = test_project.insert_scan(project_id, "completed").unwrap();

    // Description with control characters (tab, newline, carriage return, etc.)
    let control_chars = "Line1\nLine2\rLine3\tTabbed\x00Null\x1BEscape";

    let result = test_project.insert_violation(
        scan_id,
        "CC6.1",
        "critical",
        control_chars,
        "/test/file.py",
        1,
        "code",
        Some("regex"),
        None,
        None,
        None,
    );

    assert!(result.is_ok(), "Should handle control characters");
}

#[test]
fn test_special_characters_in_code_snippet() {
    let test_project = TestProject::new("test_special_characters_in_code_snippet").unwrap();
    let conn = test_project.connection();

    let project_id = test_project.insert_project("test-project", "/tmp/test", None).unwrap();
    let scan_id = test_project.insert_scan(project_id, "completed").unwrap();

    let special_code = r#"code = '<>&"\'`$(){}[]|;!@#%^*?~'"#;

    let violation_id = test_project.insert_violation(
        scan_id,
        "CC6.1",
        "medium",
        "Test",
        "/test/file.py",
        1,
        special_code,
        Some("regex"),
        None,
        None,
        None,
    ).unwrap();

    let violation = queries::select_violation(&conn, violation_id).unwrap().unwrap();
    assert_eq!(violation.code_snippet, special_code);
}

#[test]
fn test_negative_line_number() {
    let test_project = TestProject::new("test_negative_line_number").unwrap();
    let conn = test_project.connection();

    let project_id = test_project.insert_project("test-project", "/tmp/test", None).unwrap();
    let scan_id = test_project.insert_scan(project_id, "completed").unwrap();

    let result = test_project.insert_violation(
        scan_id,
        "CC6.1",
        "critical",
        "Test",
        "/test/file.py",
        -1, // Negative line number
        "code",
        Some("regex"),
        None,
        None,
        None,
    );

    // Should either reject or store (validation at command layer)
    match result {
        Ok(violation_id) => {
            let violation = queries::select_violation(&conn, violation_id).unwrap().unwrap();
            assert_eq!(violation.line_number, -1);
        }
        Err(_) => {
            // Rejection is acceptable
        }
    }
}

#[test]
fn test_invalid_severity_value() {
    let test_project = TestProject::new("test_invalid_severity_value").unwrap();
    let conn = test_project.connection();

    let project_id = test_project.insert_project("test-project", "/tmp/test", None).unwrap();
    let scan_id = test_project.insert_scan(project_id, "completed").unwrap();

    // Invalid severity (not critical/high/medium/low)
    let result = test_project.insert_violation(
        scan_id,
        "CC6.1",
        "invalid_severity",
        "Test",
        "/test/file.py",
        1,
        "code",
        Some("regex"),
        None,
        None,
        None,
    );

    // Should store as-is or reject (no enum constraint at DB level)
    match result {
        Ok(violation_id) => {
            let violation = queries::select_violation(&conn, violation_id).unwrap().unwrap();
            assert_eq!(violation.severity, "invalid_severity");
        }
        Err(_) => {
            // Rejection is acceptable
        }
    }
}

#[test]
fn test_invalid_detection_method() {
    let test_project = TestProject::new("test_invalid_detection_method").unwrap();
    let conn = test_project.connection();

    let project_id = test_project.insert_project("test-project", "/tmp/test", None).unwrap();
    let scan_id = test_project.insert_scan(project_id, "completed").unwrap();

    // Invalid detection method (not regex/llm/hybrid)
    let result = test_project.insert_violation(
        scan_id,
        "CC6.1",
        "critical",
        "Test",
        "/test/file.py",
        1,
        "code",
        Some("invalid_method"),
        None,
        None,
        None,
    );

    // Should store as-is or reject
    match result {
        Ok(_) => {
            // Stored literally
        }
        Err(_) => {
            // Rejection is acceptable
        }
    }
}

#[test]
fn test_empty_strings_in_required_fields() {
    let test_project = TestProject::new("test_empty_strings_in_required_fields").unwrap();
    let conn = test_project.connection();

    let project_id = test_project.insert_project("test-project", "/tmp/test", None).unwrap();
    let scan_id = test_project.insert_scan(project_id, "completed").unwrap();

    // Empty strings in required fields
    let result = test_project.insert_violation(
        scan_id,
        "",  // Empty control_id
        "critical",
        "",  // Empty description
        "",  // Empty file_path
        1,
        "",  // Empty code_snippet
        Some("regex"),
        None,
        None,
        None,
    );

    // Should handle gracefully
    match result {
        Ok(violation_id) => {
            let violation = queries::select_violation(&conn, violation_id).unwrap().unwrap();
            assert_eq!(violation.control_id, "");
            assert_eq!(violation.description, "");
        }
        Err(_) => {
            // Rejection is acceptable
        }
    }
}
