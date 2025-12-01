//! LSP Database Access
//!
//! Read-only access to the Ryn SQLite database for retrieving violations.

use anyhow::Result;
use rusqlite::{Connection, OpenFlags};
use std::path::PathBuf;

use crate::models::violation::Violation;

/// Read-only database connection for LSP server
pub struct ViolationDatabase {
    db_path: PathBuf,
}

impl ViolationDatabase {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    /// Open a read-only connection to the database
    fn open_readonly(&self) -> Result<Connection> {
        let conn = Connection::open_with_flags(&self.db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
        // Note: WAL mode is set by the main Ryn app when creating the database.
        // Read-only connections automatically work with WAL databases.
        Ok(conn)
    }

    /// Get all open violations for a specific file path
    pub fn get_violations_for_file(&self, file_path: &str) -> Result<Vec<Violation>> {
        let conn = self.open_readonly()?;

        let mut stmt = conn.prepare(
            "SELECT id, scan_id, control_id, severity, description,
                    file_path, line_number, code_snippet, status, detected_at,
                    detection_method, confidence_score, llm_reasoning,
                    regex_reasoning, function_name, class_name
             FROM violations
             WHERE file_path = ?1 AND status = 'open'
             ORDER BY line_number ASC",
        )?;

        let violations = stmt
            .query_map([file_path], |row| {
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
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(violations)
    }

    /// Find project ID by workspace root path
    #[allow(dead_code)]
    pub fn find_project_by_path(&self, path: &str) -> Result<Option<i64>> {
        let conn = self.open_readonly()?;

        let result = conn.query_row("SELECT id FROM projects WHERE path = ?1", [path], |row| {
            row.get(0)
        });

        match result {
            Ok(id) => Ok(Some(id)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_db() -> (TempDir, PathBuf) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE
            );
            CREATE TABLE scans (
                id INTEGER PRIMARY KEY,
                project_id INTEGER NOT NULL
            );
            CREATE TABLE violations (
                id INTEGER PRIMARY KEY,
                scan_id INTEGER NOT NULL,
                control_id TEXT NOT NULL,
                severity TEXT NOT NULL,
                description TEXT NOT NULL,
                file_path TEXT NOT NULL,
                line_number INTEGER NOT NULL,
                code_snippet TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open',
                detected_at TEXT NOT NULL,
                detection_method TEXT NOT NULL DEFAULT 'regex',
                confidence_score INTEGER,
                llm_reasoning TEXT,
                regex_reasoning TEXT,
                function_name TEXT,
                class_name TEXT
            );
            ",
        )
        .unwrap();

        (temp_dir, db_path)
    }

    #[test]
    fn test_get_violations_for_file_empty() {
        let (_temp_dir, db_path) = create_test_db();
        let db = ViolationDatabase::new(db_path);

        let violations = db.get_violations_for_file("nonexistent.py").unwrap();
        assert!(violations.is_empty());
    }

    #[test]
    fn test_get_violations_for_file() {
        let (_temp_dir, db_path) = create_test_db();

        // Insert test data
        {
            let conn = Connection::open(&db_path).unwrap();
            conn.execute(
                "INSERT INTO violations (scan_id, control_id, severity, description, file_path, line_number, code_snippet, status, detected_at, detection_method)
                 VALUES (1, 'CC6.1', 'high', 'Missing auth', 'src/auth.py', 10, 'def login():', 'open', '2024-01-01', 'regex')",
                [],
            ).unwrap();
        }

        let db = ViolationDatabase::new(db_path);
        let violations = db.get_violations_for_file("src/auth.py").unwrap();

        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].control_id, "CC6.1");
        assert_eq!(violations[0].line_number, 10);
    }

    #[test]
    fn test_find_project_by_path() {
        let (_temp_dir, db_path) = create_test_db();

        // Insert test project
        {
            let conn = Connection::open(&db_path).unwrap();
            conn.execute(
                "INSERT INTO projects (name, path) VALUES ('test', '/home/user/project')",
                [],
            )
            .unwrap();
        }

        let db = ViolationDatabase::new(db_path);

        let found = db.find_project_by_path("/home/user/project").unwrap();
        assert!(found.is_some());

        let not_found = db.find_project_by_path("/nonexistent").unwrap();
        assert!(not_found.is_none());
    }
}
