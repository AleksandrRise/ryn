use rusqlite::Connection;
use anyhow::{Result, Context};
use crate::models::Control;

const SCHEMA_SQL: &str = include_str!("schema.sql");

/// Run all database migrations
pub fn run_migrations(conn: &Connection) -> Result<()> {
    // Check if migrations have already run by looking for projects table
    let table_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='projects')",
            [],
            |row| row.get(0),
        )
        .context("Failed to check if migrations have run")?;

    if table_exists {
        return Ok(());
    }

    // Execute all migrations from schema
    conn.execute_batch(SCHEMA_SQL)
        .context("Failed to execute schema migrations")?;

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
    fn test_run_migrations() {
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
    }

    #[test]
    fn test_run_migrations_idempotent() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Run migrations twice
        assert!(run_migrations(&conn).is_ok());
        assert!(run_migrations(&conn).is_ok());

        // Verify table count doesn't double (exclude sqlite_sequence)
        let table_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'", [], |row| {
                row.get(0)
            })
            .unwrap();

        assert_eq!(table_count, 7); // Exactly 7 tables
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
