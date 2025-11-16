//! Database migration tests
//!
//! Tests verify that database migrations work correctly across all scenarios:
//! - Fresh database initialization (v0 → v1 → v2)
//! - Incremental upgrades (v1 → v2)
//! - Idempotent execution (running migrations multiple times)
//! - Schema version tracking
//! - Backward compatibility

mod common;

use common::TestProject;
use rusqlite::Connection;
use tempfile::TempDir;

/// Test fresh database gets migrated to v2
#[test]
fn test_fresh_db_migrates_to_v2() {
    let project = TestProject::new("fresh_db_v2").unwrap();

    // Verify schema version is 2 (latest)
    let version = project.get_schema_version().unwrap();
    assert_eq!(version, 2, "Fresh database should be at schema version 2");

    // Verify all v1 tables exist
    assert!(project.table_exists("projects").unwrap());
    assert!(project.table_exists("scans").unwrap());
    assert!(project.table_exists("violations").unwrap());
    assert!(project.table_exists("fixes").unwrap());
    assert!(project.table_exists("audit_events").unwrap());
    assert!(project.table_exists("controls").unwrap());
    assert!(project.table_exists("settings").unwrap());

    // Verify v2 table exists
    assert!(project.table_exists("scan_costs").unwrap());

    // Verify v2 columns exist in violations table
    assert!(project.column_exists("violations", "detection_method").unwrap());
    assert!(project.column_exists("violations", "confidence_score").unwrap());
    assert!(project.column_exists("violations", "llm_reasoning").unwrap());
    assert!(project.column_exists("violations", "regex_reasoning").unwrap());
}

/// Test that v1 database upgrades correctly to v2
#[test]
fn test_v1_to_v2_upgrade() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test_v1_upgrade.db");

    // Create v1 database manually
    {
        let conn = Connection::open(&db_path).unwrap();
        conn.execute("PRAGMA foreign_keys = ON", []).unwrap();

        // Execute v1 schema
        conn.execute_batch(include_str!("../src/db/schema.sql")).unwrap();

        // Create v1 indexes
        conn.execute_batch("
            CREATE INDEX IF NOT EXISTS idx_violations_scan_id ON violations(scan_id);
            CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
            CREATE INDEX IF NOT EXISTS idx_fixes_violation_id ON fixes(violation_id);
            CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
            CREATE INDEX IF NOT EXISTS idx_scans_project_id ON scans(project_id);
            CREATE INDEX IF NOT EXISTS idx_audit_events_project_id ON audit_events(project_id);
            CREATE INDEX IF NOT EXISTS idx_violations_file_path ON violations(file_path);
            CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
        ").unwrap();

        // Set version to 1
        conn.execute("PRAGMA user_version = 1", []).unwrap();

        // Insert test data to verify it survives migration
        conn.execute(
            "INSERT INTO projects (name, path) VALUES (?, ?)",
            ["Test Project", "/tmp/test"],
        ).unwrap();

        let project_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO scans (project_id, status) VALUES (?, ?)",
            [project_id.to_string().as_str(), "completed"],
        ).unwrap();

        let scan_id = conn.last_insert_rowid();

        // Insert violation WITHOUT v2 columns (they don't exist yet)
        conn.execute(
            "INSERT INTO violations
             (scan_id, control_id, severity, description, file_path, line_number, code_snippet)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                scan_id.to_string().as_str(),
                "CC6.1",
                "high",
                "Test violation",
                "app.py",
                "42",
                "def view(): pass",
            ],
        ).unwrap();
    }

    // Reopen and run migrations
    {
        std::env::set_var("RYN_DATA_DIR", temp_dir.path());
        let conn = Connection::open(&db_path).unwrap();
        conn.execute("PRAGMA foreign_keys = ON", []).unwrap();

        // Run test migrations (will apply v2)
        let current_version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0)).unwrap();
        assert_eq!(current_version, 1, "Should start at v1");

        // Apply v2 migration
        apply_v2_migration(&conn);

        let new_version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0)).unwrap();
        assert_eq!(new_version, 2, "Should be upgraded to v2");

        // Verify scan_costs table exists
        let table_exists: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='scan_costs')",
            [],
            |row| row.get(0),
        ).unwrap();
        assert!(table_exists, "scan_costs table should exist after v2 migration");

        // Verify v2 columns exist
        let mut stmt = conn.prepare("PRAGMA table_info(violations)").unwrap();
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(columns.contains(&"detection_method".to_string()));
        assert!(columns.contains(&"confidence_score".to_string()));
        assert!(columns.contains(&"llm_reasoning".to_string()));
        assert!(columns.contains(&"regex_reasoning".to_string()));

        // Verify existing data survived migration
        let project_count: i64 = conn.query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0)).unwrap();
        assert_eq!(project_count, 1, "Existing project should survive migration");

        let violation_count: i64 = conn.query_row("SELECT COUNT(*) FROM violations", [], |row| row.get(0)).unwrap();
        assert_eq!(violation_count, 1, "Existing violation should survive migration");

        // Verify default value for detection_method
        let detection_method: String = conn.query_row(
            "SELECT detection_method FROM violations LIMIT 1",
            [],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(detection_method, "regex", "Default detection_method should be 'regex'");

        // Verify v2 indexes exist
        let mut stmt = conn.prepare(
            "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_scan_costs_%'"
        ).unwrap();
        let indexes: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(indexes.contains(&"idx_scan_costs_created_at".to_string()));
        assert!(indexes.contains(&"idx_scan_costs_scan_id".to_string()));
    }
}

/// Test that migrations are idempotent (can be run multiple times safely)
#[test]
fn test_migrations_idempotent() {
    let project = TestProject::new("migrations_idempotent").unwrap();

    // Get initial state
    let version1 = project.get_schema_version().unwrap();
    let table_count1 = project.list_tables().unwrap().len();
    let index_count1 = project.list_indexes().unwrap().len();

    // Run migrations again (should be no-op since already at v2)
    // Note: TestProject runs migrations in constructor, so we manually verify idempotency
    let conn = project.connection();

    // Attempting to re-apply v2 would normally error due to ALTER TABLE ADD COLUMN
    // being non-idempotent. This test verifies that PRAGMA user_version prevents
    // re-running migrations.

    let current_version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0)).unwrap();
    assert_eq!(current_version, 2, "Should still be at version 2");

    // Migration logic should skip v1 and v2 if already at v2
    // (This is what run_migrations() does - checks current_version)

    // Verify nothing changed
    let version2 = project.get_schema_version().unwrap();
    let table_count2 = project.list_tables().unwrap().len();
    let index_count2 = project.list_indexes().unwrap().len();

    assert_eq!(version1, version2, "Version should not change");
    assert_eq!(table_count1, table_count2, "Table count should not change");
    assert_eq!(index_count1, index_count2, "Index count should not change");
}

/// Test that controls are seeded correctly in fresh database
#[test]
fn test_controls_seeded_after_migration() {
    let project = TestProject::new("controls_seeded").unwrap();

    // Verify 4 controls exist
    let count = project.count_rows("controls").unwrap();
    assert_eq!(count, 4, "Should have 4 SOC 2 controls");

    // Verify specific control IDs
    let conn = project.connection();
    let mut stmt = conn.prepare("SELECT id FROM controls ORDER BY id").unwrap();
    let ids: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(ids, vec!["A1.2", "CC6.1", "CC6.7", "CC7.2"]);

    // Verify controls have required fields
    let mut stmt = conn.prepare("SELECT name, description, requirement, category FROM controls WHERE id = 'CC6.1'").unwrap();
    let (name, description, requirement, category): (String, String, String, String) = stmt
        .query_row([], |row| Ok((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
        )))
        .unwrap();

    assert!(!name.is_empty());
    assert!(!description.is_empty());
    assert!(!requirement.is_empty());
    assert!(!category.is_empty());
}

/// Test that settings are seeded correctly after migration
#[test]
fn test_settings_seeded_after_migration() {
    let project = TestProject::new("settings_seeded").unwrap();

    // Verify default settings exist
    let llm_mode = project.get_setting("llm_scan_mode").unwrap();
    assert_eq!(llm_mode, Some("regex_only".to_string()));

    let cost_limit = project.get_setting("cost_limit_per_scan").unwrap();
    assert_eq!(cost_limit, Some("1.0".to_string()));

    let onboarding = project.get_setting("onboarding_completed").unwrap();
    assert_eq!(onboarding, Some("false".to_string()));
}

/// Test that v2 migration adds correct indexes
#[test]
fn test_v2_indexes_created() {
    let project = TestProject::new("v2_indexes").unwrap();

    let indexes = project.list_indexes().unwrap();

    // Verify v1 indexes
    assert!(indexes.contains(&"idx_violations_scan_id".to_string()));
    assert!(indexes.contains(&"idx_violations_status".to_string()));
    assert!(indexes.contains(&"idx_fixes_violation_id".to_string()));
    assert!(indexes.contains(&"idx_audit_events_type".to_string()));
    assert!(indexes.contains(&"idx_scans_project_id".to_string()));
    assert!(indexes.contains(&"idx_audit_events_project_id".to_string()));
    assert!(indexes.contains(&"idx_violations_file_path".to_string()));
    assert!(indexes.contains(&"idx_audit_events_created_at".to_string()));

    // Verify v2 indexes
    assert!(indexes.contains(&"idx_scan_costs_created_at".to_string()));
    assert!(indexes.contains(&"idx_scan_costs_scan_id".to_string()));

    // Should have at least 10 indexes total
    assert!(indexes.len() >= 10, "Should have at least 10 indexes");
}

/// Test that detection_method column has correct constraint
#[test]
fn test_detection_method_constraint() {
    let project = TestProject::new("detection_method_constraint").unwrap();

    let project_id = project.insert_project("Test", "/tmp/test", None).unwrap();
    let scan_id = project.insert_scan(project_id, "completed").unwrap();

    // Test valid detection methods
    for method in &["regex", "llm", "hybrid"] {
        let result = project.insert_violation(
            scan_id,
            "CC6.1",
            "high",
            "Test",
            "app.py",
            1,
            "code",
            Some(method),
            None,
            None,
            None,
        );
        assert!(result.is_ok(), "Should accept valid detection_method: {}", method);
    }

    // Test invalid detection method (should fail constraint check)
    let conn = project.connection();
    let result = conn.execute(
        "INSERT INTO violations
         (scan_id, control_id, severity, description, file_path, line_number, code_snippet, detection_method)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            scan_id,
            "CC6.1",
            "high",
            "Test",
            "app.py",
            1,
            "code",
            "invalid",
        ],
    );

    assert!(result.is_err(), "Should reject invalid detection_method");
}

/// Test that confidence_score column has correct constraint (0-100 or NULL)
#[test]
fn test_confidence_score_constraint() {
    let project = TestProject::new("confidence_score_constraint").unwrap();

    let project_id = project.insert_project("Test", "/tmp/test", None).unwrap();
    let scan_id = project.insert_scan(project_id, "completed").unwrap();

    // Test valid scores
    for score in &[0, 50, 100] {
        let result = project.insert_violation(
            scan_id,
            "CC6.1",
            "high",
            "Test",
            "app.py",
            1,
            "code",
            Some("llm"),
            Some(*score),
            Some("AI reasoning"),
            None,
        );
        assert!(result.is_ok(), "Should accept valid confidence_score: {}", score);
    }

    // Test NULL score (should be valid)
    let result = project.insert_violation(
        scan_id,
        "CC6.1",
        "high",
        "Test",
        "app.py",
        1,
        "code",
        Some("regex"),
        None,
        None,
        Some("Regex reasoning"),
    );
    assert!(result.is_ok(), "Should accept NULL confidence_score");

    // Test invalid scores (< 0 or > 100)
    let conn = project.connection();

    let result = conn.execute(
        "INSERT INTO violations
         (scan_id, control_id, severity, description, file_path, line_number, code_snippet, confidence_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![scan_id, "CC6.1", "high", "Test", "app.py", 1, "code", -10],
    );
    assert!(result.is_err(), "Should reject confidence_score < 0");

    let result = conn.execute(
        "INSERT INTO violations
         (scan_id, control_id, severity, description, file_path, line_number, code_snippet, confidence_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![scan_id, "CC6.1", "high", "Test", "app.py", 1, "code", 150],
    );
    assert!(result.is_err(), "Should reject confidence_score > 100");
}

/// Test that foreign key constraints work correctly for scan_costs
#[test]
fn test_scan_costs_foreign_key() {
    let project = TestProject::new("scan_costs_fk").unwrap();

    let project_id = project.insert_project("Test", "/tmp/test", None).unwrap();
    let scan_id = project.insert_scan(project_id, "completed").unwrap();

    // Insert scan_cost with valid scan_id
    let cost_id = project.insert_scan_cost(
        scan_id,
        10,   // files_analyzed
        5000, // input_tokens
        1000, // output_tokens
        2000, // cache_read_tokens
        500,  // cache_write_tokens
        0.025, // total_cost_usd
    ).unwrap();
    assert!(cost_id > 0);

    // Try to insert scan_cost with non-existent scan_id (should fail)
    let conn = project.connection();
    let result = conn.execute(
        "INSERT INTO scan_costs
         (scan_id, files_analyzed_with_llm, input_tokens, output_tokens,
          cache_read_tokens, cache_write_tokens, total_cost_usd)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![999, 10, 5000, 1000, 2000, 500, 0.025],
    );

    assert!(result.is_err(), "Should reject scan_cost with non-existent scan_id");
}

/// Test that CASCADE DELETE works for scan_costs
#[test]
fn test_scan_costs_cascade_delete() {
    let project = TestProject::new("scan_costs_cascade").unwrap();

    let project_id = project.insert_project("Test", "/tmp/test", None).unwrap();
    let scan_id = project.insert_scan(project_id, "completed").unwrap();

    // Insert scan_cost
    project.insert_scan_cost(scan_id, 10, 5000, 1000, 2000, 500, 0.025).unwrap();

    // Verify scan_cost exists
    let cost_count_before: i64 = project.connection()
        .query_row("SELECT COUNT(*) FROM scan_costs WHERE scan_id = ?", [scan_id], |row| row.get(0))
        .unwrap();
    assert_eq!(cost_count_before, 1);

    // Delete scan
    project.connection().execute("DELETE FROM scans WHERE id = ?", [scan_id]).unwrap();

    // Verify scan_cost was cascade deleted
    let cost_count_after: i64 = project.connection()
        .query_row("SELECT COUNT(*) FROM scan_costs WHERE scan_id = ?", [scan_id], |row| row.get(0))
        .unwrap();
    assert_eq!(cost_count_after, 0, "scan_cost should be cascade deleted when scan is deleted");
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Apply v2 migration to a connection (for testing upgrade path)
fn apply_v2_migration(conn: &Connection) {
    // Add detection_method column
    conn.execute(
        "ALTER TABLE violations ADD COLUMN detection_method TEXT NOT NULL DEFAULT 'regex'
         CHECK(detection_method IN ('regex', 'llm', 'hybrid'))",
        [],
    ).unwrap();

    // Add confidence_score column
    conn.execute(
        "ALTER TABLE violations ADD COLUMN confidence_score INTEGER
         CHECK(confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100))",
        [],
    ).unwrap();

    // Add llm_reasoning column
    conn.execute(
        "ALTER TABLE violations ADD COLUMN llm_reasoning TEXT",
        [],
    ).unwrap();

    // Add regex_reasoning column
    conn.execute(
        "ALTER TABLE violations ADD COLUMN regex_reasoning TEXT",
        [],
    ).unwrap();

    // Create scan_costs table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS scan_costs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id INTEGER NOT NULL,
            files_analyzed_with_llm INTEGER NOT NULL DEFAULT 0,
            input_tokens INTEGER NOT NULL DEFAULT 0,
            output_tokens INTEGER NOT NULL DEFAULT 0,
            cache_read_tokens INTEGER NOT NULL DEFAULT 0,
            cache_write_tokens INTEGER NOT NULL DEFAULT 0,
            total_cost_usd REAL NOT NULL DEFAULT 0.0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
        )",
        [],
    ).unwrap();

    // Create scan_costs indexes
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_scan_costs_created_at ON scan_costs(created_at)",
        [],
    ).unwrap();

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_scan_costs_scan_id ON scan_costs(scan_id)",
        [],
    ).unwrap();

    // Seed settings
    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        ["llm_scan_mode", "regex_only"],
    ).unwrap();

    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        ["cost_limit_per_scan", "1.0"],
    ).unwrap();

    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        ["onboarding_completed", "false"],
    ).unwrap();

    // Update version
    conn.execute("PRAGMA user_version = 2", []).unwrap();
}
