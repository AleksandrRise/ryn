//! Test isolation and database setup helpers
//!
//! Provides utilities for proper test database isolation without race conditions

use super::migrations;
use rusqlite::Connection;

/// Test database guard that manages an isolated test database
/// Each test gets its own temporary directory and database file
pub struct TestDbGuard {
    pub temp_dir: tempfile::TempDir,
}

impl TestDbGuard {
    /// Create a new test environment with SHARED test database
    ///
    /// All tests use /tmp/ryn-test/ to work with the singleton DB_CONNECTION
    /// Tests run serially (#[serial_test::serial]) so no conflicts occur
    pub fn new() -> Self {
        let test_dir = std::path::PathBuf::from("/tmp/ryn-test");
        std::fs::create_dir_all(&test_dir).unwrap();
        std::env::set_var("RYN_DATA_DIR", &test_dir);

        // Clear all data from existing database tables using the singleton connection
        // This ensures we're clearing the same connection that tests will use
        {
            let conn = super::get_connection();
            let _ = conn.execute("DELETE FROM fixes", []);
            let _ = conn.execute("DELETE FROM violations", []);
            let _ = conn.execute("DELETE FROM scans", []);
            let _ = conn.execute("DELETE FROM scan_costs", []);
            let _ = conn.execute("DELETE FROM audit_events", []);
            let _ = conn.execute("DELETE FROM projects", []);
            let _ = conn.execute("DELETE FROM settings", []);
            // Reset auto-increment counters so IDs start from 1 in each test
            let _ = conn.execute("DELETE FROM sqlite_sequence", []);
        } // Drop the MutexGuard here

        // Use a fake temp_dir to satisfy struct requirement
        let temp_dir = tempfile::TempDir::new().unwrap();

        TestDbGuard { temp_dir }
    }

    /// Initialize a fresh database with schema and seed data
    pub fn init_db(&self) -> anyhow::Result<Connection> {
        let db_path = self.temp_dir.path().join("ryn.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| anyhow::anyhow!("Failed to open database: {}", e))?;

        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", [])
            .map_err(|e| anyhow::anyhow!("Failed to enable foreign keys: {}", e))?;

        // Run migrations
        migrations::run_migrations(&conn)?;

        // Seed controls
        migrations::seed_controls(&conn)?;

        Ok(conn)
    }
}

impl Default for TestDbGuard {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_isolation() {
        // First test
        {
            let guard1 = TestDbGuard::new();
            let conn1 = guard1.init_db().expect("Failed to initialize database");

            let count: i64 = conn1
                .query_row("SELECT COUNT(*) FROM controls", [], |row| row.get(0))
                .unwrap();
            assert_eq!(count, 4);
        }

        // Second test - should have clean database
        {
            let guard2 = TestDbGuard::new();
            let conn2 = guard2.init_db().expect("Failed to initialize database");

            let count: i64 = conn2
                .query_row("SELECT COUNT(*) FROM controls", [], |row| row.get(0))
                .unwrap();
            assert_eq!(count, 4);
        }
    }

    #[test]
    fn test_multiple_guards_sequential() {
        let g1 = TestDbGuard::new();
        let c1 = g1.init_db().expect("Failed to initialize database");

        let projects1: i64 = c1
            .query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))
            .unwrap();
        assert_eq!(projects1, 0);
        drop(c1);
        drop(g1);

        // Second guard gets clean database
        let g2 = TestDbGuard::new();
        let c2 = g2.init_db().expect("Failed to initialize database");

        let projects2: i64 = c2
            .query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))
            .unwrap();
        assert_eq!(projects2, 0);
    }
}
