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
    /// Create a new test environment with isolated database
    ///
    /// Uses a unique temporary directory and sets RYN_DATA_DIR env var
    pub fn new() -> Self {
        let temp_dir = tempfile::TempDir::new().unwrap();
        std::env::set_var("RYN_DATA_DIR", temp_dir.path());

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
