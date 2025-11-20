use rusqlite::{Connection, params, OptionalExtension};
use anyhow::{Result, Context};
use crate::models::*;

// ===== PROJECT CRUD =====

pub fn insert_project(conn: &Connection, name: &str, path: &str, framework: Option<&str>) -> Result<i64> {
    conn.execute(
        "INSERT INTO projects (name, path, framework) VALUES (?, ?, ?)",
        params![name, path, framework],
    ).context("Failed to insert project")?;

    Ok(conn.last_insert_rowid())
}

pub fn select_projects(conn: &Connection) -> Result<Vec<Project>> {
    let mut stmt = conn
        .prepare("SELECT id, name, path, framework, created_at, updated_at FROM projects ORDER BY created_at DESC")
        .context("Failed to prepare select projects query")?;

    let projects = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                framework: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .context("Failed to map projects from query")?
        .collect::<std::result::Result<Vec<_>, _>>()
        .context("Failed to collect projects")?;

    Ok(projects)
}

pub fn select_project(conn: &Connection, id: i64) -> Result<Option<Project>> {
    let mut stmt = conn
        .prepare("SELECT id, name, path, framework, created_at, updated_at FROM projects WHERE id = ?")
        .context("Failed to prepare select project query")?;

    let project = stmt
        .query_row(params![id], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                framework: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .optional()
        .context("Failed to query project")?;

    Ok(project)
}

pub fn select_project_by_path(conn: &Connection, path: &str) -> Result<Option<Project>> {
    let mut stmt = conn
        .prepare("SELECT id, name, path, framework, created_at, updated_at FROM projects WHERE path = ?")
        .context("Failed to prepare select project by path query")?;

    let project = stmt
        .query_row(params![path], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                framework: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .optional()
        .context("Failed to query project by path")?;

    Ok(project)
}

pub fn update_project(conn: &Connection, id: i64, name: &str, framework: Option<&str>) -> Result<()> {
    let updated_at = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE projects SET name = ?, framework = ?, updated_at = ? WHERE id = ?",
        params![name, framework, updated_at, id],
    ).context("Failed to update project")?;

    Ok(())
}

pub fn delete_project(conn: &Connection, id: i64) -> Result<()> {
    conn.execute(
        "DELETE FROM projects WHERE id = ?",
        params![id],
    ).context("Failed to delete project")?;

    Ok(())
}

// ===== SCAN CRUD =====

pub fn insert_scan(conn: &Connection, project_id: i64, scan_mode: &str) -> Result<i64> {
    conn.execute(
        "INSERT INTO scans (project_id, status, scan_mode) VALUES (?, ?, ?)",
        params![project_id, "running", scan_mode],
    ).context("Failed to insert scan")?;

    Ok(conn.last_insert_rowid())
}

pub fn select_scans(conn: &Connection, project_id: i64) -> Result<Vec<Scan>> {
    let mut stmt = conn
        .prepare("SELECT id, project_id, started_at, completed_at, files_scanned, total_files, violations_found, status, scan_mode FROM scans WHERE project_id = ? ORDER BY started_at DESC")
        .context("Failed to prepare select scans query")?;

    let scans = stmt
        .query_map(params![project_id], |row| {
            Ok(Scan {
                id: row.get(0)?,
                project_id: row.get(1)?,
                started_at: row.get(2)?,
                completed_at: row.get(3)?,
                files_scanned: row.get(4)?,
                total_files: row.get(5)?,
                violations_found: row.get(6)?,
                status: row.get(7)?,
                scan_mode: row.get(8)?,
                critical_count: 0,
                high_count: 0,
                medium_count: 0,
                low_count: 0,
            })
        })
        .context("Failed to map scans from query")?
        .collect::<std::result::Result<Vec<_>, _>>()
        .context("Failed to collect scans")?;

    Ok(scans)
}

pub fn select_scan(conn: &Connection, id: i64) -> Result<Option<Scan>> {
    let mut stmt = conn
        .prepare("SELECT id, project_id, started_at, completed_at, files_scanned, total_files, violations_found, status, scan_mode FROM scans WHERE id = ?")
        .context("Failed to prepare select scan query")?;

    let scan = stmt
        .query_row(params![id], |row| {
            Ok(Scan {
                id: row.get(0)?,
                project_id: row.get(1)?,
                started_at: row.get(2)?,
                completed_at: row.get(3)?,
                files_scanned: row.get(4)?,
                total_files: row.get(5)?,
                violations_found: row.get(6)?,
                status: row.get(7)?,
                scan_mode: row.get(8)?,
                critical_count: 0,
                high_count: 0,
                medium_count: 0,
                low_count: 0,
            })
        })
        .optional()
        .context("Failed to query scan")?;

    Ok(scan)
}

pub fn update_scan_status(conn: &Connection, id: i64, status: &str, completed_at: Option<&str>) -> Result<()> {
    conn.execute(
        "UPDATE scans SET status = ?, completed_at = ? WHERE id = ?",
        params![status, completed_at, id],
    ).context("Failed to update scan status")?;

    Ok(())
}

pub fn update_scan_results(conn: &Connection, id: i64, files_scanned: i32, total_files: i32, violations_found: i32) -> Result<()> {
    conn.execute(
        "UPDATE scans SET files_scanned = ?, total_files = ?, violations_found = ? WHERE id = ?",
        params![files_scanned, total_files, violations_found, id],
    ).context("Failed to update scan results")?;

    Ok(())
}

// ===== VIOLATION CRUD =====

pub fn insert_violation(conn: &Connection, violation: &Violation) -> Result<i64> {
    conn.execute(
        "INSERT INTO violations (scan_id, control_id, severity, description, file_path, line_number, code_snippet, status, detection_method, confidence_score, llm_reasoning, regex_reasoning, function_name, class_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            violation.scan_id,
            violation.control_id,
            violation.severity,
            violation.description,
            violation.file_path,
            violation.line_number,
            violation.code_snippet,
            violation.status,
            violation.detection_method,
            violation.confidence_score,
            violation.llm_reasoning,
            violation.regex_reasoning,
            violation.function_name,
            violation.class_name,
        ],
    ).context("Failed to insert violation")?;

    Ok(conn.last_insert_rowid())
}

pub fn select_violations(conn: &Connection, scan_id: i64) -> Result<Vec<Violation>> {
    let mut stmt = conn
        .prepare("SELECT id, scan_id, control_id, severity, description, file_path, line_number, code_snippet, status, detected_at, detection_method, confidence_score, llm_reasoning, regex_reasoning, function_name, class_name FROM violations WHERE scan_id = ? ORDER BY severity DESC, line_number ASC")
        .context("Failed to prepare select violations query")?;

    let violations = stmt
        .query_map(params![scan_id], |row| {
            Ok(Violation {
                id: row.get(0)?,
                scan_id: row.get(1)?,
                control_id: row.get(2)?,
                severity: row.get(3)?,
                description: row.get(4)?,
                file_path: row.get(5)?,
                line_number: row.get(6)?,
                code_snippet: row.get(7)?,
                status: row.get(8)?,
                detected_at: row.get(9)?,
                detection_method: row.get(10)?,
                confidence_score: row.get(11)?,
                llm_reasoning: row.get(12)?,
                regex_reasoning: row.get(13)?,
                function_name: row.get(14)?,
                class_name: row.get(15)?,
            })
        })
        .context("Failed to map violations from query")?
        .collect::<std::result::Result<Vec<_>, _>>()
        .context("Failed to collect violations")?;

    Ok(violations)
}

pub fn select_violation(conn: &Connection, id: i64) -> Result<Option<Violation>> {
    let mut stmt = conn
        .prepare("SELECT id, scan_id, control_id, severity, description, file_path, line_number, code_snippet, status, detected_at, detection_method, confidence_score, llm_reasoning, regex_reasoning, function_name, class_name FROM violations WHERE id = ?")
        .context("Failed to prepare select violation query")?;

    let violation = stmt
        .query_row(params![id], |row| {
            Ok(Violation {
                id: row.get(0)?,
                scan_id: row.get(1)?,
                control_id: row.get(2)?,
                severity: row.get(3)?,
                description: row.get(4)?,
                file_path: row.get(5)?,
                line_number: row.get(6)?,
                code_snippet: row.get(7)?,
                status: row.get(8)?,
                detected_at: row.get(9)?,
                detection_method: row.get(10)?,
                confidence_score: row.get(11)?,
                llm_reasoning: row.get(12)?,
                regex_reasoning: row.get(13)?,
                function_name: row.get(14)?,
                class_name: row.get(15)?,
            })
        })
        .optional()
        .context("Failed to query violation")?;

    Ok(violation)
}

pub fn update_violation_status(conn: &Connection, id: i64, status: &str) -> Result<()> {
    conn.execute(
        "UPDATE violations SET status = ? WHERE id = ?",
        params![status, id],
    ).context("Failed to update violation status")?;

    Ok(())
}

// ===== FIX CRUD =====

pub fn insert_fix(conn: &Connection, fix: &Fix) -> Result<i64> {
    conn.execute(
        "INSERT INTO fixes (violation_id, original_code, fixed_code, explanation, trust_level, applied_by) VALUES (?, ?, ?, ?, ?, ?)",
        params![
            fix.violation_id,
            fix.original_code,
            fix.fixed_code,
            fix.explanation,
            fix.trust_level,
            fix.applied_by,
        ],
    ).context("Failed to insert fix")?;

    Ok(conn.last_insert_rowid())
}

pub fn select_fix(conn: &Connection, id: i64) -> Result<Option<Fix>> {
    let mut stmt = conn
        .prepare("SELECT id, violation_id, original_code, fixed_code, explanation, trust_level, applied_at, applied_by, git_commit_sha, backup_path FROM fixes WHERE id = ?")
        .context("Failed to prepare select fix query")?;

    let fix = stmt
        .query_row(params![id], |row| {
            Ok(Fix {
                id: row.get(0)?,
                violation_id: row.get(1)?,
                original_code: row.get(2)?,
                fixed_code: row.get(3)?,
                explanation: row.get(4)?,
                trust_level: row.get(5)?,
                applied_at: row.get(6)?,
                applied_by: row.get(7)?,
                git_commit_sha: row.get(8)?,
                backup_path: row.get(9)?,
            })
        })
        .optional()
        .context("Failed to query fix")?;

    Ok(fix)
}

pub fn select_fix_for_violation(conn: &Connection, violation_id: i64) -> Result<Option<Fix>> {
    let mut stmt = conn
        .prepare("SELECT id, violation_id, original_code, fixed_code, explanation, trust_level, applied_at, applied_by, git_commit_sha, backup_path FROM fixes WHERE violation_id = ? LIMIT 1")
        .context("Failed to prepare select fix query")?;

    let fix = stmt
        .query_row(params![violation_id], |row| {
            Ok(Fix {
                id: row.get(0)?,
                violation_id: row.get(1)?,
                original_code: row.get(2)?,
                fixed_code: row.get(3)?,
                explanation: row.get(4)?,
                trust_level: row.get(5)?,
                applied_at: row.get(6)?,
                applied_by: row.get(7)?,
                git_commit_sha: row.get(8)?,
                backup_path: row.get(9)?,
            })
        })
        .optional()
        .context("Failed to query fix")?;

    Ok(fix)
}

pub fn update_fix_applied(conn: &Connection, id: i64, git_commit_sha: &str, backup_path: Option<&str>) -> Result<()> {
    let applied_at = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE fixes SET applied_at = ?, git_commit_sha = ?, backup_path = ? WHERE id = ?",
        params![applied_at, git_commit_sha, backup_path, id],
    ).context("Failed to update fix applied")?;

    Ok(())
}

// ===== AUDIT EVENT CRUD =====

pub fn insert_audit_event(conn: &Connection, event: &AuditEvent) -> Result<i64> {
    conn.execute(
        "INSERT INTO audit_events (event_type, project_id, violation_id, fix_id, description, metadata) VALUES (?, ?, ?, ?, ?, ?)",
        params![
            event.event_type,
            event.project_id,
            event.violation_id,
            event.fix_id,
            event.description,
            event.metadata,
        ],
    ).context("Failed to insert audit event")?;

    Ok(conn.last_insert_rowid())
}

pub fn select_audit_events(conn: &Connection, limit: i64) -> Result<Vec<AuditEvent>> {
    let mut stmt = conn
        .prepare("SELECT id, event_type, project_id, violation_id, fix_id, description, metadata, created_at FROM audit_events ORDER BY created_at DESC LIMIT ?")
        .context("Failed to prepare select audit events query")?;

    let events = stmt
        .query_map(params![limit], |row| {
            Ok(AuditEvent {
                id: row.get(0)?,
                event_type: row.get(1)?,
                project_id: row.get(2)?,
                violation_id: row.get(3)?,
                fix_id: row.get(4)?,
                description: row.get(5)?,
                metadata: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .context("Failed to map audit events from query")?
        .collect::<std::result::Result<Vec<_>, _>>()
        .context("Failed to collect audit events")?;

    Ok(events)
}

pub fn select_audit_events_by_project(conn: &Connection, project_id: i64) -> Result<Vec<AuditEvent>> {
    let mut stmt = conn
        .prepare("SELECT id, event_type, project_id, violation_id, fix_id, description, metadata, created_at FROM audit_events WHERE project_id = ? ORDER BY created_at DESC")
        .context("Failed to prepare select audit events query")?;

    let events = stmt
        .query_map(params![project_id], |row| {
            Ok(AuditEvent {
                id: row.get(0)?,
                event_type: row.get(1)?,
                project_id: row.get(2)?,
                violation_id: row.get(3)?,
                fix_id: row.get(4)?,
                description: row.get(5)?,
                metadata: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .context("Failed to map audit events from query")?
        .collect::<std::result::Result<Vec<_>, _>>()
        .context("Failed to collect audit events")?;

    Ok(events)
}

// ===== CONTROL QUERIES =====

pub fn select_controls(conn: &Connection) -> Result<Vec<Control>> {
    let mut stmt = conn
        .prepare("SELECT id, name, description, requirement, category FROM controls ORDER BY id")
        .context("Failed to prepare select controls query")?;

    let controls = stmt
        .query_map([], |row| {
            Ok(Control::new(
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })
        .context("Failed to map controls from query")?
        .collect::<std::result::Result<Vec<_>, _>>()
        .context("Failed to collect controls")?;

    Ok(controls)
}

pub fn select_control(conn: &Connection, id: &str) -> Result<Option<Control>> {
    let mut stmt = conn
        .prepare("SELECT id, name, description, requirement, category FROM controls WHERE id = ?")
        .context("Failed to prepare select control query")?;

    let control = stmt
        .query_row(params![id], |row| {
            Ok(Control::new(
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })
        .optional()
        .context("Failed to query control")?;

    Ok(control)
}

// ===== SETTINGS CRUD =====

pub fn insert_or_update_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    let updated_at = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
        params![key, value, updated_at],
    ).context("Failed to insert or update setting")?;

    Ok(())
}

pub fn select_setting(conn: &Connection, key: &str) -> Result<Option<Settings>> {
    let mut stmt = conn
        .prepare("SELECT key, value, updated_at FROM settings WHERE key = ?")
        .context("Failed to prepare select setting query")?;

    let setting = stmt
        .query_row(params![key], |row| {
            Ok(Settings {
                key: row.get(0)?,
                value: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })
        .optional()
        .context("Failed to query setting")?;

    Ok(setting)
}

pub fn select_all_settings(conn: &Connection) -> Result<Vec<Settings>> {
    let mut stmt = conn
        .prepare("SELECT key, value, updated_at FROM settings ORDER BY key")
        .context("Failed to prepare select settings query")?;

    let settings = stmt
        .query_map([], |row| {
            Ok(Settings {
                key: row.get(0)?,
                value: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })
        .context("Failed to map settings from query")?
        .collect::<std::result::Result<Vec<_>, _>>()
        .context("Failed to collect settings")?;

    Ok(settings)
}

pub fn delete_setting(conn: &Connection, key: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM settings WHERE key = ?",
        params![key],
    ).context("Failed to delete setting")?;

    Ok(())
}

// Export queries - fetch all data across all projects

pub fn select_all_projects(conn: &Connection) -> Result<Vec<Project>> {
    select_projects(conn)
}

pub fn select_all_scans(conn: &Connection) -> Result<Vec<Scan>> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, status, files_scanned, total_files, violations_found, started_at, completed_at, scan_mode
         FROM scans
         ORDER BY started_at DESC"
    ).context("Failed to prepare select all scans statement")?;

    let scans = stmt.query_map([], |row| {
        Ok(Scan {
            id: row.get(0)?,
            project_id: row.get(1)?,
            status: row.get(2)?,
            files_scanned: row.get(3)?,
            total_files: row.get(4)?,
            violations_found: row.get(5)?,
            started_at: row.get(6)?,
            completed_at: row.get(7)?,
            scan_mode: row.get(8)?,
            critical_count: 0,
            high_count: 0,
            medium_count: 0,
            low_count: 0,
        })
    })
    .context("Failed to query all scans")?
    .collect::<rusqlite::Result<Vec<_>>>()
    .context("Failed to collect all scans")?;

    Ok(scans)
}

pub fn select_all_violations(conn: &Connection) -> Result<Vec<Violation>> {
    let mut stmt = conn.prepare(
        "SELECT id, scan_id, control_id, severity, description, file_path, line_number, code_snippet, status, detected_at, detection_method, confidence_score, llm_reasoning, regex_reasoning, function_name, class_name
         FROM violations
         ORDER BY detected_at DESC"
    ).context("Failed to prepare select all violations statement")?;

    let violations = stmt.query_map([], |row| {
        Ok(Violation {
            id: row.get(0)?,
            scan_id: row.get(1)?,
            control_id: row.get(2)?,
            severity: row.get(3)?,
            description: row.get(4)?,
            file_path: row.get(5)?,
            line_number: row.get(6)?,
            code_snippet: row.get(7)?,
            status: row.get(8)?,
            detected_at: row.get(9)?,
            detection_method: row.get(10)?,
            confidence_score: row.get(11)?,
            llm_reasoning: row.get(12)?,
            regex_reasoning: row.get(13)?,
            function_name: row.get(14)?,
            class_name: row.get(15)?,
        })
    })
    .context("Failed to query all violations")?
    .collect::<rusqlite::Result<Vec<_>>>()
    .context("Failed to collect all violations")?;

    Ok(violations)
}

pub fn select_all_fixes(conn: &Connection) -> Result<Vec<Fix>> {
    let mut stmt = conn.prepare(
        "SELECT id, violation_id, original_code, fixed_code, explanation, trust_level, applied_at, applied_by, git_commit_sha, backup_path
         FROM fixes
         ORDER BY id DESC"
    ).context("Failed to prepare select all fixes statement")?;

    let fixes = stmt.query_map([], |row| {
        Ok(Fix {
            id: row.get(0)?,
            violation_id: row.get(1)?,
            original_code: row.get(2)?,
            fixed_code: row.get(3)?,
            explanation: row.get(4)?,
            trust_level: row.get(5)?,
            applied_at: row.get(6)?,
            applied_by: row.get(7)?,
            git_commit_sha: row.get(8)?,
            backup_path: row.get(9)?,
        })
    })
    .context("Failed to query all fixes")?
    .collect::<rusqlite::Result<Vec<_>>>()
    .context("Failed to collect all fixes")?;

    Ok(fixes)
}

pub fn select_all_audit_events(conn: &Connection) -> Result<Vec<AuditEvent>> {
    let mut stmt = conn.prepare(
        "SELECT id, event_type, project_id, violation_id, fix_id, description, metadata, created_at
         FROM audit_events
         ORDER BY created_at DESC"
    ).context("Failed to prepare select all audit events statement")?;

    let events = stmt.query_map([], |row| {
        Ok(AuditEvent {
            id: row.get(0)?,
            event_type: row.get(1)?,
            project_id: row.get(2)?,
            violation_id: row.get(3)?,
            fix_id: row.get(4)?,
            description: row.get(5)?,
            metadata: row.get(6)?,
            created_at: row.get(7)?,
        })
    })
    .context("Failed to query all audit events")?
    .collect::<rusqlite::Result<Vec<_>>>()
    .context("Failed to collect all audit events")?;

    Ok(events)
}

/// Get violation counts by severity for a scan
///
/// Returns tuple of (critical, high, medium, low) counts
pub fn get_severity_counts(conn: &Connection, scan_id: i64) -> Result<(i32, i32, i32, i32)> {
    let mut stmt = conn.prepare(
        "SELECT severity, COUNT(*) FROM violations WHERE scan_id = ? GROUP BY severity"
    ).context("Failed to prepare severity counts query")?;

    let mut critical = 0;
    let mut high = 0;
    let mut medium = 0;
    let mut low = 0;

    let rows = stmt.query_map([scan_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?))
    }).context("Failed to query severity counts")?;

    for result in rows {
        let (severity, count) = result.context("Failed to process severity row")?;
        match severity.as_str() {
            "critical" => critical = count,
            "high" => high = count,
            "medium" => medium = count,
            "low" => low = count,
            _ => {}
        }
    }

    Ok((critical, high, medium, low))
}

// ===== SCAN COSTS CRUD =====

pub fn insert_scan_cost(conn: &Connection, scan_cost: &ScanCost) -> Result<i64> {
    conn.execute(
        "INSERT INTO scan_costs (scan_id, files_analyzed_with_llm, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_cost_usd, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            scan_cost.scan_id,
            scan_cost.files_analyzed_with_llm,
            scan_cost.input_tokens,
            scan_cost.output_tokens,
            scan_cost.cache_read_tokens,
            scan_cost.cache_write_tokens,
            scan_cost.total_cost_usd,
            scan_cost.created_at
        ],
    ).context("Failed to insert scan cost")?;

    Ok(conn.last_insert_rowid())
}

pub fn select_scan_cost(conn: &Connection, id: i64) -> Result<Option<ScanCost>> {
    let mut stmt = conn
        .prepare("SELECT id, scan_id, files_analyzed_with_llm, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_cost_usd, created_at FROM scan_costs WHERE id = ?")
        .context("Failed to prepare select scan cost query")?;

    let scan_cost = stmt
        .query_row(params![id], |row| {
            Ok(ScanCost {
                id: row.get(0)?,
                scan_id: row.get(1)?,
                files_analyzed_with_llm: row.get(2)?,
                input_tokens: row.get(3)?,
                output_tokens: row.get(4)?,
                cache_read_tokens: row.get(5)?,
                cache_write_tokens: row.get(6)?,
                total_cost_usd: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .optional()
        .context("Failed to query scan cost")?;

    Ok(scan_cost)
}

pub fn select_scan_cost_by_scan_id(conn: &Connection, scan_id: i64) -> Result<Option<ScanCost>> {
    let mut stmt = conn
        .prepare("SELECT id, scan_id, files_analyzed_with_llm, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_cost_usd, created_at FROM scan_costs WHERE scan_id = ?")
        .context("Failed to prepare select scan cost by scan_id query")?;

    let scan_cost = stmt
        .query_row(params![scan_id], |row| {
            Ok(ScanCost {
                id: row.get(0)?,
                scan_id: row.get(1)?,
                files_analyzed_with_llm: row.get(2)?,
                input_tokens: row.get(3)?,
                output_tokens: row.get(4)?,
                cache_read_tokens: row.get(5)?,
                cache_write_tokens: row.get(6)?,
                total_cost_usd: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .optional()
        .context("Failed to query scan cost by scan_id")?;

    Ok(scan_cost)
}

/// Get all scan costs since a given timestamp (RFC3339 format)
/// Used for analytics dashboard to show costs over time
pub fn select_scan_costs_since(conn: &Connection, since: &str) -> Result<Vec<ScanCost>> {
    let mut stmt = conn
        .prepare("SELECT id, scan_id, files_analyzed_with_llm, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_cost_usd, created_at FROM scan_costs WHERE created_at >= ? ORDER BY created_at DESC")
        .context("Failed to prepare select scan costs since query")?;

    let scan_costs = stmt
        .query_map(params![since], |row| {
            Ok(ScanCost {
                id: row.get(0)?,
                scan_id: row.get(1)?,
                files_analyzed_with_llm: row.get(2)?,
                input_tokens: row.get(3)?,
                output_tokens: row.get(4)?,
                cache_read_tokens: row.get(5)?,
                cache_write_tokens: row.get(6)?,
                total_cost_usd: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .context("Failed to map scan costs from query")?
        .collect::<std::result::Result<Vec<_>, _>>()
        .context("Failed to collect scan costs")?;

    Ok(scan_costs)
}

pub fn select_all_scan_costs(conn: &Connection) -> Result<Vec<ScanCost>> {
    let mut stmt = conn
        .prepare("SELECT id, scan_id, files_analyzed_with_llm, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_cost_usd, created_at FROM scan_costs ORDER BY created_at DESC")
        .context("Failed to prepare select all scan costs query")?;

    let scan_costs = stmt
        .query_map([], |row| {
            Ok(ScanCost {
                id: row.get(0)?,
                scan_id: row.get(1)?,
                files_analyzed_with_llm: row.get(2)?,
                input_tokens: row.get(3)?,
                output_tokens: row.get(4)?,
                cache_read_tokens: row.get(5)?,
                cache_write_tokens: row.get(6)?,
                total_cost_usd: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .context("Failed to map scan costs from query")?
        .collect::<std::result::Result<Vec<_>, _>>()
        .context("Failed to collect scan costs")?;

    Ok(scan_costs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use crate::db::{init_db};

    fn setup_test_db() -> (TempDir, Connection) {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("RYN_DATA_DIR", temp_dir.path());
        let conn = init_db().unwrap();
        (temp_dir, conn)
    }

    #[test]
    fn test_project_crud() {
        let (_temp_dir, conn) = setup_test_db();

        // Create
        let id = insert_project(&conn, "test-app", "/path/to/app", Some("Django")).unwrap();
        assert!(id > 0);

        // Read
        let project = select_project(&conn, id).unwrap();
        assert!(project.is_some());
        let p = project.unwrap();
        assert_eq!(p.name, "test-app");
        assert_eq!(p.path, "/path/to/app");
        assert_eq!(p.framework, Some("Django".to_string()));

        // Update
        update_project(&conn, id, "updated-app", Some("Flask")).unwrap();
        let updated = select_project(&conn, id).unwrap().unwrap();
        assert_eq!(updated.name, "updated-app");
        assert_eq!(updated.framework, Some("Flask".to_string()));

        // Delete
        delete_project(&conn, id).unwrap();
        let deleted = select_project(&conn, id).unwrap();
        assert!(deleted.is_none());
    }

    #[test]
    fn test_scan_crud() {
        let (_temp_dir, conn) = setup_test_db();

        // Create project first
        let project_id = insert_project(&conn, "test", "/path", None).unwrap();

        // Create scan
        let scan_id = insert_scan(&conn, project_id).unwrap();
        assert!(scan_id > 0);

        // Read
        let scan = select_scan(&conn, scan_id).unwrap();
        assert!(scan.is_some());
        let s = scan.unwrap();
        assert_eq!(s.project_id, project_id);
        assert_eq!(s.status, "running");

        // Update status
        let completed_at = chrono::Utc::now().to_rfc3339();
        update_scan_status(&conn, scan_id, "completed", Some(&completed_at)).unwrap();
        let updated = select_scan(&conn, scan_id).unwrap().unwrap();
        assert_eq!(updated.status, "completed");

        // Update results
        update_scan_results(&conn, scan_id, 100, 150, 5).unwrap();
        let with_results = select_scan(&conn, scan_id).unwrap().unwrap();
        assert_eq!(with_results.files_scanned, 100);
        assert_eq!(with_results.total_files, 150);
        assert_eq!(with_results.violations_found, 5);
    }

    #[test]
    fn test_violation_crud() {
        let (_temp_dir, conn) = setup_test_db();

        let project_id = insert_project(&conn, "test", "/path", None).unwrap();
        let scan_id = insert_scan(&conn, project_id).unwrap();

        let violation = Violation::new(
            scan_id,
            "CC6.1".to_string(),
            Severity::Critical,
            "Missing auth".to_string(),
            "app/views.py".to_string(),
            42,
            "def view():".to_string(),
        );

        let viol_id = insert_violation(&conn, &violation).unwrap();
        assert!(viol_id > 0);

        let stored = select_violation(&conn, viol_id).unwrap().unwrap();
        assert_eq!(stored.control_id, "CC6.1");
        assert_eq!(stored.severity, "critical");

        update_violation_status(&conn, viol_id, "fixed").unwrap();
        let fixed = select_violation(&conn, viol_id).unwrap().unwrap();
        assert_eq!(fixed.status, "fixed");
    }

    #[test]
    fn test_control_queries() {
        let (_temp_dir, conn) = setup_test_db();

        let controls = select_controls(&conn).unwrap();
        assert_eq!(controls.len(), 4);

        let cc6_1 = select_control(&conn, "CC6.1").unwrap();
        assert!(cc6_1.is_some());
        let control = cc6_1.unwrap();
        assert_eq!(control.id, "CC6.1");
    }

    #[test]
    fn test_settings_crud() {
        let (_temp_dir, conn) = setup_test_db();

        insert_or_update_setting(&conn, "theme", "dark").unwrap();
        let theme = select_setting(&conn, "theme").unwrap();
        assert!(theme.is_some());
        assert_eq!(theme.unwrap().value, "dark");

        insert_or_update_setting(&conn, "theme", "light").unwrap();
        let updated = select_setting(&conn, "theme").unwrap().unwrap();
        assert_eq!(updated.value, "light");

        delete_setting(&conn, "theme").unwrap();
        let deleted = select_setting(&conn, "theme").unwrap();
        assert!(deleted.is_none());
    }
}
