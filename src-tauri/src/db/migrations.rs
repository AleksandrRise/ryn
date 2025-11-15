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
/// TODO: Will be implemented in next task
fn migrate_to_v2(_conn: &Connection) -> Result<()> {
    // Placeholder for v2 migrations:
    // - ALTER TABLE violations ADD COLUMN detection_method TEXT DEFAULT 'regex'
    // - ALTER TABLE violations ADD COLUMN confidence_score INTEGER
    // - ALTER TABLE violations ADD COLUMN llm_reasoning TEXT
    // - ALTER TABLE violations ADD COLUMN regex_reasoning TEXT
    // - ALTER TABLE settings ADD COLUMN llm_scan_mode TEXT DEFAULT 'regex_only'
    // - ALTER TABLE settings ADD COLUMN cost_limit_per_scan REAL
    // - ALTER TABLE settings ADD COLUMN onboarding_completed INTEGER DEFAULT 0
    // - CREATE TABLE scan_costs (...)

    // For now, do nothing (v2 not yet implemented)
    Ok(())
}

/// Run all database migrations
/// Uses PRAGMA user_version to track schema state:
/// - v0: Empty database (no tables)
/// - v1: Initial schema (7 tables, 8 indexes)
/// - v2: Hybrid scanning schema (detection_method, scan_costs, etc.)
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

        // Verify schema version is set to 2 (latest)
        let version = get_schema_version(&conn).unwrap();
        assert_eq!(version, 2, "Schema version should be 2 after all migrations");
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

        assert_eq!(table_count, 7, "Should have exactly 7 tables");

        // Verify schema version stays at 2
        let version = get_schema_version(&conn).unwrap();
        assert_eq!(version, 2, "Schema version should remain 2 after multiple runs");
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

        // Verify all tables still exist
        let table_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(table_count, 7);
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

        // Verify final version is 2
        assert_eq!(get_schema_version(&conn).unwrap(), 2);

        // Verify all tables exist
        let table_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(table_count, 7);
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
}
