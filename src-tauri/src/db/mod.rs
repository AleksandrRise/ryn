use rusqlite::Connection;
use std::path::PathBuf;
use anyhow::{Result, Context};

pub mod migrations;
pub mod queries;

#[cfg(test)]
pub mod test_helpers;

pub use migrations::{run_migrations, seed_controls};
pub use queries::*;

/// Get the database file path
pub fn get_db_path() -> Result<PathBuf> {
    let data_dir = match std::env::var("RYN_DATA_DIR") {
        Ok(dir) => PathBuf::from(dir),
        Err(_) => {
            // Default to current directory for simplicity
            PathBuf::from("./data")
        }
    };

    std::fs::create_dir_all(&data_dir)
        .context(format!("Failed to create data directory: {:?}", data_dir))?;

    Ok(data_dir.join("ryn.db"))
}

/// Initialize the database connection and run migrations
/// Returns a new connection each time for thread safety
/// Each connection is automatically closed when dropped
pub fn init_db() -> Result<Connection> {
    let db_path = get_db_path()?;

    // Open connection with multi-threaded flags for better concurrency
    let conn = Connection::open_with_flags(
        &db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE
            | rusqlite::OpenFlags::SQLITE_OPEN_CREATE
            | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX, // Disable mutex for better performance
    ).context(format!("Failed to open database at {:?}", db_path))?;

    // Enable foreign key support
    conn.execute("PRAGMA foreign_keys = ON", [])
        .context("Failed to enable foreign keys")?;

    // Optimize for concurrent access
    conn.execute("PRAGMA journal_mode = WAL", [])
        .context("Failed to enable WAL mode")?;

    // Reduce blocking by setting busy timeout
    conn.busy_timeout(std::time::Duration::from_secs(5))?;

    // Run migrations (only runs once, safe to call multiple times)
    run_migrations(&conn)?;

    // Seed controls (only seeds once, safe to call multiple times)
    seed_controls(&conn)?;

    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_get_db_path() {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("RYN_DATA_DIR", temp_dir.path());

        let path = get_db_path().unwrap();
        assert!(path.to_string_lossy().contains("ryn.db"));
        assert!(path.parent().unwrap().exists());
    }

    #[test]
    fn test_init_db() {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("RYN_DATA_DIR", temp_dir.path());

        let conn = init_db().unwrap();

        // Verify tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(tables.contains(&"projects".to_string()));
        assert!(tables.contains(&"scans".to_string()));
        assert!(tables.contains(&"violations".to_string()));
        assert!(tables.contains(&"fixes".to_string()));
        assert!(tables.contains(&"audit_events".to_string()));
        assert!(tables.contains(&"controls".to_string()));
        assert!(tables.contains(&"settings".to_string()));
    }

    #[test]
    fn test_foreign_keys_enabled() {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("RYN_DATA_DIR", temp_dir.path());

        let conn = init_db().unwrap();

        let foreign_keys_enabled: bool = conn
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .unwrap();

        assert!(foreign_keys_enabled);
    }

    #[test]
    fn test_seed_controls_count() {
        let temp_dir = TempDir::new().unwrap();
        std::env::set_var("RYN_DATA_DIR", temp_dir.path());

        let conn = init_db().unwrap();

        let control_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM controls", [], |row| row.get(0))
            .unwrap();

        assert_eq!(control_count, 4);
    }
}
