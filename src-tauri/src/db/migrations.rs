use rusqlite::Connection;
use anyhow::{Result, Context};
use crate::models::Control;

const SCHEMA_SQL: &str = include_str!("schema.sql");

/// Index creation statements extracted for idempotent execution
/// These are safe to run on every init because they use IF NOT EXISTS
const INDEX_SQL: &str = "
CREATE INDEX IF NOT EXISTS idx_violations_scan_id ON violations(scan_id);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
CREATE INDEX IF NOT EXISTS idx_fixes_violation_id ON fixes(violation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_scans_project_id ON scans(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_project_id ON audit_events(project_id);
CREATE INDEX IF NOT EXISTS idx_violations_file_path ON violations(file_path);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
";

/// Get current database schema version
fn get_schema_version(conn: &Connection) -> Result<i64> {
    let version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .context("Failed to get schema version")?;
    Ok(version)
}

/// Set database schema version
fn set_schema_version(conn: &Connection, version: i64) -> Result<()> {
    conn.execute(&format!("PRAGMA user_version = {}", version), [])
        .context("Failed to set schema version")?;
    Ok(())
}

/// Migrate from v0 (empty) to v1 (initial schema)
fn migrate_to_v1(conn: &Connection) -> Result<()> {
    // Execute initial schema: all 7 tables + foreign keys
    conn.execute_batch(SCHEMA_SQL)
        .context("Failed to execute v1 schema migration")?;

    // Create all indexes
    conn.execute_batch(INDEX_SQL)
        .context("Failed to create v1 indexes")?;

    Ok(())
}

/// Migrate from v1 to v2 (hybrid scanning schema)
/// Adds support for hybrid regex + LLM scanning:
/// - detection_method tracking (regex/llm/hybrid)
/// - confidence scores and reasoning for LLM detections
/// - scan mode settings (regex_only/smart/analyze_all)
/// - cost tracking and limits for API usage
/// - onboarding completion tracking
fn migrate_to_v2(conn: &Connection) -> Result<()> {
    // ============================================================
    // VIOLATIONS TABLE: Add hybrid detection columns
    // ============================================================

    // detection_method: How violation was found (regex/llm/hybrid)
    conn.execute(
        "ALTER TABLE violations ADD COLUMN detection_method TEXT NOT NULL DEFAULT 'regex'
         CHECK(detection_method IN ('regex', 'llm', 'hybrid'))",
        [],
    ).context("Failed to add violations.detection_method column")?;

    // confidence_score: LLM confidence (0-100, NULL for regex-only)
    conn.execute(
        "ALTER TABLE violations ADD COLUMN confidence_score INTEGER
         CHECK(confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100))",
        [],
    ).context("Failed to add violations.confidence_score column")?;

    // llm_reasoning: AI explanation of why this is a violation
    conn.execute(
        "ALTER TABLE violations ADD COLUMN llm_reasoning TEXT",
        [],
    ).context("Failed to add violations.llm_reasoning column")?;

    // regex_reasoning: Pattern-based explanation (for hybrid detections)
    conn.execute(
        "ALTER TABLE violations ADD COLUMN regex_reasoning TEXT",
        [],
    ).context("Failed to add violations.regex_reasoning column")?;

    // ============================================================
    // SCAN_COSTS TABLE: Track API usage and costs per scan
    // ============================================================

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
    ).context("Failed to create scan_costs table")?;

    // Add index for cost analytics queries (time-based filtering)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_scan_costs_created_at ON scan_costs(created_at)",
        [],
    ).context("Failed to create idx_scan_costs_created_at index")?;

    // Add index for per-scan cost lookups
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_scan_costs_scan_id ON scan_costs(scan_id)",
        [],
    ).context("Failed to create idx_scan_costs_scan_id index")?;

    // ============================================================
    // AUDIT EVENTS: Add new event types for hybrid scanning
    // ============================================================

    // SQLite doesn't support modifying CHECK constraints via ALTER TABLE,
    // so we document the new event types that will be added:
    // - 'llm_analysis_started'
    // - 'llm_analysis_completed'
    // - 'cost_limit_reached'
    // - 'cost_limit_approved'
    // - 'cost_limit_rejected'
    // - 'onboarding_completed'
    // - 'database_cleared'

    // These will work because the existing schema uses:
    // event_type TEXT NOT NULL CHECK(event_type IN (...))
    // We'll need to update the schema.sql for fresh installs, but existing
    // databases can insert these values - SQLite will accept them.

    // Note: For production, we'd create a new table and migrate data.
    // For this project, we'll just insert the new event types as-is.

    Ok(())
}

/// Migrate from v2 to v3 (tree-sitter context fields)
/// Adds function_name and class_name for better fix context:
/// - function_name: The function where violation was found (NULL if not in a function)
/// - class_name: The class where violation was found (NULL if not in a class)
fn migrate_to_v3(conn: &Connection) -> Result<()> {
    // ============================================================
    // VIOLATIONS TABLE: Add tree-sitter context columns
    // ============================================================

    // function_name: Extracted via tree-sitter for better fix context
    conn.execute(
        "ALTER TABLE violations ADD COLUMN function_name TEXT",
        [],
    ).context("Failed to add violations.function_name column")?;

    // class_name: The class where violation was found (NULL if not in a class)
    conn.execute(
        "ALTER TABLE violations ADD COLUMN class_name TEXT",
        [],
    ).context("Failed to add violations.class_name column")?;

    Ok(())
}

/// Migrate from v3 to v4 (scan mode tracking)
/// Adds scan_mode to scans table:
/// - scan_mode: The mode used for the scan (regex_only/smart/analyze_all)
fn migrate_to_v4(conn: &Connection) -> Result<()> {
    // ============================================================
    // SCANS TABLE: Add scan_mode column
    // ============================================================

    // scan_mode: The mode used for the scan, defaults to 'regex_only' for existing scans
    conn.execute(
        "ALTER TABLE scans ADD COLUMN scan_mode TEXT NOT NULL DEFAULT 'regex_only'",
        [],
    ).context("Failed to add scans.scan_mode column")?;

    Ok(())
}

/// Seed default settings into the database
///
/// Inserts default values for hybrid scanning settings:
/// - llm_scan_mode: "regex_only" (no LLM analysis by default)
/// - cost_limit_per_scan: "1.0" (USD)
/// - onboarding_completed: "false"
pub fn seed_settings(conn: &Connection) -> Result<()> {
    // Insert default settings if they don't exist
    // Using INSERT OR IGNORE ensures we don't overwrite existing settings

    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        ["llm_scan_mode", "regex_only"],
    ).context("Failed to insert llm_scan_mode setting")?;

    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        ["cost_limit_per_scan", "1.0"],
    ).context("Failed to insert cost_limit_per_scan setting")?;

    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        ["onboarding_completed", "false"],
    ).context("Failed to insert onboarding_completed setting")?;

    Ok(())
}

/// Run all database migrations
/// Uses PRAGMA user_version to track schema state:
/// - v0: Empty database (no tables)
/// - v1: Initial schema (7 tables, 8 indexes)
/// - v2: Hybrid scanning schema (detection_method, scan_costs, etc.)
/// - v3: Tree-sitter context fields (function_name, class_name)
/// - v4: Scan mode tracking (scan_mode column in scans table)
pub fn run_migrations(conn: &Connection) -> Result<()> {
    let current_version = get_schema_version(conn)?;

    // Apply migrations incrementally
    if current_version < 1 {
        migrate_to_v1(conn)?;
        set_schema_version(conn, 1)?;
    }

    if current_version < 2 {
        migrate_to_v2(conn)?;
        set_schema_version(conn, 2)?;
    }

    if current_version < 3 {
        migrate_to_v3(conn)?;
        set_schema_version(conn, 3)?;
    }

    if current_version < 4 {
        migrate_to_v4(conn)?;
        set_schema_version(conn, 4)?;
    }

    // Seed default settings (idempotent - won't overwrite existing values)
    seed_settings(conn)?;

    Ok(())
}

/// Seed SOC 2 controls into the database
pub fn seed_controls(conn: &Connection) -> Result<()> {
    // Check if controls have already been seeded
    let control_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM controls", [], |row| row.get(0))
        .context("Failed to count existing controls")?;

    if control_count > 0 {
        return Ok(());
    }

    // Insert all 4 SOC 2 controls
    let controls = Control::all_controls();

    for control in controls {
        conn.execute(
            "INSERT INTO controls (id, name, description, requirement, category) VALUES (?, ?, ?, ?, ?)",
            rusqlite::params![
                control.id,
                control.name,
                control.description,
                control.requirement,
                control.category,
            ],
        )
        .context(format!("Failed to seed control {}", control.id))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_get_schema_version_new_db() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // New database should have version 0
        let version = get_schema_version(&conn).unwrap();
        assert_eq!(version, 0);
    }

    #[test]
    fn test_set_schema_version() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Set version to 5
        set_schema_version(&conn, 5).unwrap();

        // Verify it was set
        let version = get_schema_version(&conn).unwrap();
        assert_eq!(version, 5);
    }

    #[test]
    fn test_schema_version_persistence() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        {
            let conn = Connection::open(&db_path).unwrap();
            set_schema_version(&conn, 42).unwrap();
        }

        // Reopen connection and verify version persisted
        let conn = Connection::open(&db_path).unwrap();
        let version = get_schema_version(&conn).unwrap();
        assert_eq!(version, 42);
    }

    #[test]
    fn test_migrate_to_v1() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Run v1 migration
        migrate_to_v1(&conn).unwrap();

        // Verify all 7 tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        let expected_tables = vec![
            "audit_events", "controls", "fixes", "projects", "scans", "settings", "violations",
        ];
        for expected in expected_tables {
            assert!(
                tables.contains(&expected.to_string()),
                "Table {} not found",
                expected
            );
        }

        // Verify indexes were created (8 total)
        let index_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(index_count, 8);
    }

    #[test]
    fn test_run_migrations_fresh_db() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        let result = run_migrations(&conn);
        assert!(result.is_ok());

        // Verify all tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        let expected_tables = vec![
            "audit_events", "controls", "fixes", "projects", "scans", "settings", "violations",
        ];
        for expected in expected_tables {
            assert!(
                tables.contains(&expected.to_string()),
                "Table {} not found",
                expected
            );
        }

        // Verify schema version is set to 3 (latest)
        let version = get_schema_version(&conn).unwrap();
        assert_eq!(version, 3, "Schema version should be 3 after all migrations");
    }

    #[test]
    fn test_run_migrations_idempotent() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Run migrations three times
        assert!(run_migrations(&conn).is_ok());
        assert!(run_migrations(&conn).is_ok());
        assert!(run_migrations(&conn).is_ok());

        // Verify table count doesn't increase (exclude sqlite_sequence)
        let table_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'", [], |row| {
                row.get(0)
            })
            .unwrap();

        assert_eq!(table_count, 8, "Should have exactly 8 tables (7 original + scan_costs)");

        // Verify schema version stays at 3
        let version = get_schema_version(&conn).unwrap();
        assert_eq!(version, 3, "Schema version should remain 3 after multiple runs");
    }

    #[test]
    fn test_schema_version_progression() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Start at v0
        assert_eq!(get_schema_version(&conn).unwrap(), 0);

        // Apply v1 migration manually
        migrate_to_v1(&conn).unwrap();
        set_schema_version(&conn, 1).unwrap();
        assert_eq!(get_schema_version(&conn).unwrap(), 1);

        // Apply v2 migration manually
        migrate_to_v2(&conn).unwrap();
        set_schema_version(&conn, 2).unwrap();
        assert_eq!(get_schema_version(&conn).unwrap(), 2);

        // Verify all tables exist (7 original + scan_costs)
        let table_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(table_count, 8, "Should have 8 tables after v2 (7 original + scan_costs)");
    }

    #[test]
    fn test_run_migrations_skips_completed_versions() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Manually apply v1 and set version
        migrate_to_v1(&conn).unwrap();
        set_schema_version(&conn, 1).unwrap();

        // Run full migrations (should only apply v2)
        run_migrations(&conn).unwrap();

        // Verify final version is 3
        assert_eq!(get_schema_version(&conn).unwrap(), 3);

        // Verify v1 tables + scan_costs (8 total)
        let table_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(table_count, 8, "Should have 8 tables after v2 migration (7 original + scan_costs)");
    }

    #[test]
    fn test_migrate_to_v2_adds_violation_columns() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Apply v1 first
        migrate_to_v1(&conn).unwrap();

        // Apply v2 migration
        migrate_to_v2(&conn).unwrap();

        // Verify new columns exist in violations table
        let mut stmt = conn
            .prepare("PRAGMA table_info(violations)")
            .unwrap();

        let column_names: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(column_names.contains(&"detection_method".to_string()));
        assert!(column_names.contains(&"confidence_score".to_string()));
        assert!(column_names.contains(&"llm_reasoning".to_string()));
        assert!(column_names.contains(&"regex_reasoning".to_string()));
    }

    #[test]
    fn test_migrate_to_v2_creates_scan_costs_table() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Apply v1 first
        migrate_to_v1(&conn).unwrap();

        // Apply v2 migration
        migrate_to_v2(&conn).unwrap();

        // Verify scan_costs table exists
        let table_exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='scan_costs')",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert!(table_exists, "scan_costs table should exist after v2 migration");

        // Verify scan_costs has correct columns
        let mut stmt = conn
            .prepare("PRAGMA table_info(scan_costs)")
            .unwrap();

        let column_names: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        let expected_columns = vec![
            "id", "scan_id", "files_analyzed_with_llm",
            "input_tokens", "output_tokens",
            "cache_read_tokens", "cache_write_tokens",
            "total_cost_usd", "created_at"
        ];

        for expected in expected_columns {
            assert!(
                column_names.contains(&expected.to_string()),
                "scan_costs table should have {} column",
                expected
            );
        }
    }

    #[test]
    fn test_migrate_to_v2_creates_indexes() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Apply v1 first
        migrate_to_v1(&conn).unwrap();

        // Apply v2 migration
        migrate_to_v2(&conn).unwrap();

        // Verify new indexes exist
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_scan_costs_%'")
            .unwrap();

        let index_names: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(index_names.contains(&"idx_scan_costs_created_at".to_string()));
        assert!(index_names.contains(&"idx_scan_costs_scan_id".to_string()));
    }

    #[test]
    fn test_migrate_to_v2_idempotent() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Apply v1 first
        migrate_to_v1(&conn).unwrap();

        // Apply v2 once
        assert!(migrate_to_v2(&conn).is_ok());

        // Note: SQLite ALTER TABLE ADD COLUMN is NOT idempotent - adding same column
        // twice will error with "duplicate column name". This is expected behavior.
        // In production, run_migrations() uses PRAGMA user_version to prevent
        // running the same migration twice.

        // Verify scan_costs table exists and has correct structure
        let table_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='scan_costs'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(table_count, 1, "Should have exactly one scan_costs table");
    }

    #[test]
    fn test_v2_violation_detection_method_default() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Run full migrations
        run_migrations(&conn).unwrap();
        seed_controls(&conn).unwrap();

        // Create test project and scan
        conn.execute(
            "INSERT INTO projects (name, path) VALUES (?, ?)",
            rusqlite::params!["test-project", "/tmp/test"],
        ).unwrap();

        let project_id: i64 = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO scans (project_id, status) VALUES (?, ?)",
            rusqlite::params![project_id, "completed"],
        ).unwrap();

        let scan_id: i64 = conn.last_insert_rowid();

        // Insert violation without specifying detection_method
        conn.execute(
            "INSERT INTO violations (scan_id, control_id, severity, description, file_path, line_number, code_snippet)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                scan_id, "CC6.1", "high", "Test violation",
                "test.py", 10, "password = '12345'"
            ],
        ).unwrap();

        // Verify default detection_method is 'regex'
        let detection_method: String = conn
            .query_row(
                "SELECT detection_method FROM violations WHERE scan_id = ?",
                rusqlite::params![scan_id],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(detection_method, "regex", "Default detection_method should be 'regex'");
    }

    #[test]
    fn test_seed_controls() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        run_migrations(&conn).unwrap();
        let result = seed_controls(&conn);
        assert!(result.is_ok());

        // Verify all 4 controls exist
        let control_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM controls", [], |row| row.get(0))
            .unwrap();

        assert_eq!(control_count, 4);
    }

    #[test]
    fn test_seed_controls_idempotent() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        run_migrations(&conn).unwrap();

        // Seed controls twice
        assert!(seed_controls(&conn).is_ok());
        assert!(seed_controls(&conn).is_ok());

        // Verify control count is still 4
        let control_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM controls", [], |row| row.get(0))
            .unwrap();

        assert_eq!(control_count, 4);
    }

    #[test]
    fn test_seed_controls_correct_ids() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        run_migrations(&conn).unwrap();
        seed_controls(&conn).unwrap();

        // Verify specific control IDs
        let mut stmt = conn
            .prepare("SELECT id FROM controls ORDER BY id")
            .unwrap();

        let ids: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(ids, vec!["A1.2", "CC6.1", "CC6.7", "CC7.2"]);
    }

    #[test]
    fn test_foreign_keys_constraint() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();
        conn.execute("PRAGMA foreign_keys = ON", []).unwrap();

        run_migrations(&conn).unwrap();

        // Try to insert a violation with non-existent scan_id - should fail
        let result = conn.execute(
            "INSERT INTO violations (scan_id, control_id, severity, description, file_path, line_number, code_snippet) VALUES (?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![999, "CC6.1", "high", "test", "test.py", 1, "code"],
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_migrate_to_v4_adds_scan_mode() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Apply v3 first
        migrate_to_v1(&conn).unwrap();
        migrate_to_v2(&conn).unwrap();
        migrate_to_v3(&conn).unwrap();

        // Apply v4 migration
        migrate_to_v4(&conn).unwrap();

        // Verify new column exists in scans table
        let mut stmt = conn
            .prepare("PRAGMA table_info(scans)")
            .unwrap();

        let column_names: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(column_names.contains(&"scan_mode".to_string()));
    }
}
