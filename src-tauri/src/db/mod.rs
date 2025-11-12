use rusqlite::Connection;
use std::path::PathBuf;
use anyhow::{Result, Context};

pub mod migrations;
pub mod queries;

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
