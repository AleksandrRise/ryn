use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use anyhow::{Result, Context};
use once_cell::sync::Lazy;

pub mod migrations;
pub mod queries;

#[cfg(test)]
pub mod test_helpers;

pub use migrations::{run_migrations, seed_controls};
pub use queries::*;

/// Singleton database connection
/// Initialized once on first access, then reused for all subsequent calls
static DB_CONNECTION: Lazy<Mutex<Connection>> = Lazy::new(|| {
    let conn = create_connection()
        .expect("Failed to initialize database connection");
    Mutex::new(conn)
});

/// Get the database file path
pub fn get_db_path() -> Result<PathBuf> {
    let data_dir = match std::env::var("RYN_DATA_DIR") {
        Ok(dir) => PathBuf::from(dir),
        Err(_) => {
            // Default to parent directory (../data) when running from src-tauri via Tauri CLI
            // This ensures the database is at the project root, not inside src-tauri
            PathBuf::from("../data")
        }
    };

    std::fs::create_dir_all(&data_dir)
        .context(format!("Failed to create data directory: {:?}", data_dir))?;

    Ok(data_dir.join("ryn.db"))
}

/// Create a new database connection with proper configuration
/// Called once by the singleton initialization
fn create_connection() -> Result<Connection> {
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path)
        .context(format!("Failed to open database at {:?}", db_path))?;

    // Enable foreign key support
    conn.execute("PRAGMA foreign_keys = ON", [])
        .context("Failed to enable foreign keys")?;

    // Set busy timeout to 5 seconds
    conn.busy_timeout(std::time::Duration::from_secs(5))
        .context("Failed to set busy timeout")?;

    // Run migrations
    run_migrations(&conn)?;

    // Seed controls
    seed_controls(&conn)?;

    Ok(conn)
}

/// Get a reference to the singleton database connection
/// This replaces init_db() and should be used in all commands
pub fn get_connection() -> std::sync::MutexGuard<'static, Connection> {
    DB_CONNECTION.lock().unwrap()
}

/// Initialize the database connection and run migrations
/// NOTE: This creates a NEW connection each time. For most use cases, prefer get_connection()
/// which returns the singleton connection. This function is primarily used in main.rs for
/// early initialization with explicit error handling.
pub fn init_db() -> Result<Connection> {
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path)
        .context(format!("Failed to open database at {:?}", db_path))?;

    // Enable foreign key support
    conn.execute("PRAGMA foreign_keys = ON", [])
        .context("Failed to enable foreign keys")?;

    // Run migrations
    run_migrations(&conn)?;

    // Seed controls
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
