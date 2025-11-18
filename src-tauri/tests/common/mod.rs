//! Common test helpers for integration tests
//!
//! This module provides utilities for setting up isolated test environments,
//! creating test data, and asserting database state across all integration tests.

use rusqlite::Connection;
use tempfile::TempDir;
use anyhow::Result;
use std::path::{Path, PathBuf};
use std::fs;

/// Test project with isolated temporary database
///
/// Each TestProject creates a unique temporary directory and SQLite database,
/// ensuring complete isolation between tests. The database is automatically
/// cleaned up when the TestProject is dropped.
///
/// # Examples
///
/// ```
/// use common::TestProject;
///
/// #[test]
/// fn test_something() {
///     let project = TestProject::new("my-test").unwrap();
///     let conn = project.connection();
///
///     // Use connection for testing
///     let count: i64 = conn.query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0)).unwrap();
///     assert_eq!(count, 0);
/// }
/// ```
pub struct TestProject {
    /// Temporary directory (kept alive until drop)
    #[allow(dead_code)]
    temp_dir: TempDir,

    /// Path to the test database file
    db_path: PathBuf,

    /// Database connection
    conn: Connection,

    /// Path to temporary project directory for file scanning tests
    project_dir: PathBuf,
}

impl TestProject {
    /// Create a new test project with isolated database
    ///
    /// This function:
    /// 1. Creates a temporary directory for the database
    /// 2. Sets RYN_DATA_DIR environment variable to point to temp dir
    /// 3. Opens a SQLite connection
    /// 4. Runs all migrations (v1 and v2)
    /// 5. Seeds SOC 2 controls
    /// 6. Creates a temporary project directory for file scanning tests
    pub fn new(test_name: &str) -> Result<Self> {
        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join(format!("{}.db", test_name));

        // Set environment variable for this test
        std::env::set_var("RYN_DATA_DIR", temp_dir.path());

        // Open connection with proper configuration
        let conn = Connection::open(&db_path)?;
        conn.execute("PRAGMA foreign_keys = ON", [])?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;

        // Import migrations directly (avoid singleton from main crate)
        run_test_migrations(&conn)?;
        seed_test_controls(&conn)?;

        // Create project directory for file scanning tests
        let project_dir = temp_dir.path().join("test-project");
        fs::create_dir_all(&project_dir)?;

        Ok(Self {
            temp_dir,
            db_path,
            conn,
            project_dir,
        })
    }

    /// Get reference to the database connection
    pub fn connection(&self) -> &Connection {
        &self.conn
    }

    /// Get path to the test database
    pub fn db_path(&self) -> &Path {
        &self.db_path
    }

    /// Get path to the temporary project directory
    ///
    /// Use this for creating test files that will be scanned
    pub fn project_dir(&self) -> &Path {
        &self.project_dir
    }

    /// Create a test file in the project directory
    ///
    /// # Arguments
    ///
    /// * `relative_path` - Path relative to project_dir (e.g., "app.py", "src/auth.py")
    /// * `content` - File content
    pub fn create_file(&self, relative_path: &str, content: &str) -> Result<PathBuf> {
        let file_path = self.project_dir.join(relative_path);

        // Create parent directories if needed
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(&file_path, content)?;
        Ok(file_path)
    }

    /// Insert a test project into the database
    ///
    /// Returns the project_id for use in other test operations
    pub fn insert_project(&self, name: &str, path: &str, framework: Option<&str>) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO projects (name, path, framework) VALUES (?, ?, ?)",
            rusqlite::params![name, path, framework],
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    /// Insert a test scan into the database
    ///
    /// Returns the scan_id for use in other test operations
    pub fn insert_scan(&self, project_id: i64, status: &str) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO scans (project_id, status, files_scanned, total_files) VALUES (?, ?, 0, 0)",
            rusqlite::params![project_id, status],
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    /// Insert a test violation into the database
    ///
    /// Returns the violation_id for use in other test operations
    #[allow(clippy::too_many_arguments)]
    pub fn insert_violation(
        &self,
        scan_id: i64,
        control_id: &str,
        severity: &str,
        description: &str,
        file_path: &str,
        line_number: i64,
        code_snippet: &str,
        detection_method: Option<&str>,
        confidence_score: Option<i64>,
        llm_reasoning: Option<&str>,
        regex_reasoning: Option<&str>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO violations
             (scan_id, control_id, severity, description, file_path, line_number, code_snippet,
              detection_method, confidence_score, llm_reasoning, regex_reasoning)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                scan_id,
                control_id,
                severity,
                description,
                file_path,
                line_number,
                code_snippet,
                detection_method.unwrap_or("regex"),
                confidence_score,
                llm_reasoning,
                regex_reasoning,
            ],
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    /// Insert a test fix into the database
    ///
    /// Returns the fix_id for use in other test operations
    pub fn insert_fix(
        &self,
        violation_id: i64,
        original_code: &str,
        fixed_code: &str,
        explanation: &str,
        trust_level: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO fixes (violation_id, original_code, fixed_code, explanation, trust_level)
             VALUES (?, ?, ?, ?, ?)",
            rusqlite::params![violation_id, original_code, fixed_code, explanation, trust_level],
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    /// Insert a test scan cost record
    ///
    /// Returns the scan_cost_id for use in other test operations
    pub fn insert_scan_cost(
        &self,
        scan_id: i64,
        files_analyzed: i64,
        input_tokens: i64,
        output_tokens: i64,
        cache_read_tokens: i64,
        cache_write_tokens: i64,
        total_cost_usd: f64,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO scan_costs
             (scan_id, files_analyzed_with_llm, input_tokens, output_tokens,
              cache_read_tokens, cache_write_tokens, total_cost_usd)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                scan_id,
                files_analyzed,
                input_tokens,
                output_tokens,
                cache_read_tokens,
                cache_write_tokens,
                total_cost_usd,
            ],
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    /// Insert a test setting
    pub fn insert_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
            rusqlite::params![key, value],
        )?;

        Ok(())
    }

    /// Get a setting value
    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let result = self.conn.query_row(
            "SELECT value FROM settings WHERE key = ?",
            rusqlite::params![key],
            |row| row.get(0),
        );

        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Count rows in a table
    pub fn count_rows(&self, table: &str) -> Result<i64> {
        let query = format!("SELECT COUNT(*) FROM {}", table);
        let count: i64 = self.conn.query_row(&query, [], |row| row.get(0))?;
        Ok(count)
    }

    /// Get schema version
    pub fn get_schema_version(&self) -> Result<i64> {
        let version: i64 = self.conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
        Ok(version)
    }

    /// Check if a table exists
    pub fn table_exists(&self, table_name: &str) -> Result<bool> {
        let exists: bool = self.conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?)",
            rusqlite::params![table_name],
            |row| row.get(0),
        )?;

        Ok(exists)
    }

    /// Check if a column exists in a table
    pub fn column_exists(&self, table_name: &str, column_name: &str) -> Result<bool> {
        let mut stmt = self.conn.prepare(&format!("PRAGMA table_info({})", table_name))?;

        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(columns.contains(&column_name.to_string()))
    }

    /// Get list of all tables in the database
    pub fn list_tables(&self) -> Result<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )?;

        let tables: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(tables)
    }

    /// Get list of all indexes in the database
    pub fn list_indexes(&self) -> Result<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name"
        )?;

        let indexes: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(indexes)
    }
}

/// Run migrations for test database
///
/// This is a standalone version of the migrations from src/db/migrations.rs
/// to avoid dependency on the main singleton connection.
fn run_test_migrations(conn: &Connection) -> Result<()> {
    let current_version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    // Migration v0 -> v1: Initial schema
    if current_version < 1 {
        migrate_test_to_v1(conn)?;
        conn.execute("PRAGMA user_version = 1", [])?;
    }

    // Migration v1 -> v2: Hybrid scanning schema
    if current_version < 2 {
        migrate_test_to_v2(conn)?;
        conn.execute("PRAGMA user_version = 2", [])?;
    }

    // Migration v2 -> v3: Tree-sitter context fields
    if current_version < 3 {
        migrate_test_to_v3(conn)?;
        conn.execute("PRAGMA user_version = 3", [])?;
    }

    // Seed default settings
    seed_test_settings(conn)?;

    Ok(())
}

/// Migrate to v1 (initial schema)
fn migrate_test_to_v1(conn: &Connection) -> Result<()> {
    // Create all 7 initial tables
    conn.execute_batch(include_str!("../../src/db/schema.sql"))?;

    // Create indexes
    conn.execute_batch("
        CREATE INDEX IF NOT EXISTS idx_violations_scan_id ON violations(scan_id);
        CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
        CREATE INDEX IF NOT EXISTS idx_fixes_violation_id ON fixes(violation_id);
        CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_scans_project_id ON scans(project_id);
        CREATE INDEX IF NOT EXISTS idx_audit_events_project_id ON audit_events(project_id);
        CREATE INDEX IF NOT EXISTS idx_violations_file_path ON violations(file_path);
        CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
    ")?;

    Ok(())
}

/// Migrate to v2 (hybrid scanning schema)
fn migrate_test_to_v2(conn: &Connection) -> Result<()> {
    // Add detection_method column
    conn.execute(
        "ALTER TABLE violations ADD COLUMN detection_method TEXT NOT NULL DEFAULT 'regex'
         CHECK(detection_method IN ('regex', 'llm', 'hybrid'))",
        [],
    )?;

    // Add confidence_score column
    conn.execute(
        "ALTER TABLE violations ADD COLUMN confidence_score INTEGER
         CHECK(confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100))",
        [],
    )?;

    // Add llm_reasoning column
    conn.execute(
        "ALTER TABLE violations ADD COLUMN llm_reasoning TEXT",
        [],
    )?;

    // Add regex_reasoning column
    conn.execute(
        "ALTER TABLE violations ADD COLUMN regex_reasoning TEXT",
        [],
    )?;

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
    )?;

    // Create scan_costs indexes
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_scan_costs_created_at ON scan_costs(created_at)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_scan_costs_scan_id ON scan_costs(scan_id)",
        [],
    )?;

    Ok(())
}

/// Migrate to v3 (tree-sitter context fields)
fn migrate_test_to_v3(conn: &Connection) -> Result<()> {
    // Add function_name column
    conn.execute(
        "ALTER TABLE violations ADD COLUMN function_name TEXT",
        [],
    )?;

    // Add class_name column
    conn.execute(
        "ALTER TABLE violations ADD COLUMN class_name TEXT",
        [],
    )?;

    Ok(())
}

/// Seed default settings for test database
fn seed_test_settings(conn: &Connection) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        ["llm_scan_mode", "regex_only"],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        ["cost_limit_per_scan", "1.0"],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        ["onboarding_completed", "false"],
    )?;

    Ok(())
}

/// Seed SOC 2 controls for test database
fn seed_test_controls(conn: &Connection) -> Result<()> {
    // Check if controls already seeded
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM controls", [], |row| row.get(0))?;

    if count > 0 {
        return Ok(());
    }

    // Insert all 4 SOC 2 controls
    let controls = [
        (
            "CC6.1",
            "Logical and Physical Access Controls",
            "The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet the entity's objectives.",
            "All sensitive operations must require authentication and authorization. Missing @login_required decorators, authenticate() middleware, or isAuthenticated checks are violations.",
            "Access Control",
        ),
        (
            "CC6.7",
            "Transmission and Movement of Information",
            "The entity restricts the transmission, movement, and removal of information to authorized internal and external users and processes, and protects it during transmission, movement, or removal to meet the entity's objectives.",
            "Credentials, API keys, tokens, and secrets must never be hardcoded in source code. Use environment variables, secrets management systems, or secure configuration.",
            "Secrets Management",
        ),
        (
            "CC7.2",
            "System Monitoring",
            "The entity monitors its system and takes action to maintain, support, and improve controls over information technology processing to meet the entity's objectives.",
            "Critical operations (authentication, authorization, data access, configuration changes) must be logged for audit trails. Missing logging on sensitive operations is a violation.",
            "Logging & Monitoring",
        ),
        (
            "A1.2",
            "System Inputs",
            "The entity authorizes, designs, develops or acquires, implements, operates, approves, maintains, and monitors environmental protections, software, data backup processes, and recovery infrastructure to meet its objectives.",
            "All external inputs, database queries, and API calls must have proper error handling and timeouts. Missing try/catch, error handling, or timeout configuration is a violation.",
            "Resilience & Error Handling",
        ),
    ];

    for (id, name, description, requirement, category) in &controls {
        conn.execute(
            "INSERT INTO controls (id, name, description, requirement, category) VALUES (?, ?, ?, ?, ?)",
            rusqlite::params![id, name, description, requirement, category],
        )?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_creation() {
        let project = TestProject::new("test_project_creation").unwrap();

        // Verify database path exists
        assert!(project.db_path().exists());

        // Verify project directory exists
        assert!(project.project_dir().exists());

        // Verify connection works
        let count: i64 = project.connection()
            .query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))
            .unwrap();

        assert_eq!(count, 0);
    }

    #[test]
    fn test_schema_version() {
        let project = TestProject::new("test_schema_version").unwrap();

        // Schema should be at version 3 after migrations
        let version = project.get_schema_version().unwrap();
        assert_eq!(version, 3);
    }

    #[test]
    fn test_tables_exist() {
        let project = TestProject::new("test_tables_exist").unwrap();

        let tables = project.list_tables().unwrap();

        // Should have 8 tables (7 original + scan_costs)
        let expected_tables = vec![
            "audit_events", "controls", "fixes", "projects",
            "scan_costs", "scans", "settings", "violations",
        ];

        for expected in expected_tables {
            assert!(
                tables.contains(&expected.to_string()),
                "Table {} not found in {:?}",
                expected,
                tables
            );
        }
    }

    #[test]
    fn test_controls_seeded() {
        let project = TestProject::new("test_controls_seeded").unwrap();

        let count = project.count_rows("controls").unwrap();
        assert_eq!(count, 4, "Should have 4 SOC 2 controls");
    }

    #[test]
    fn test_settings_seeded() {
        let project = TestProject::new("test_settings_seeded").unwrap();

        let llm_mode = project.get_setting("llm_scan_mode").unwrap();
        assert_eq!(llm_mode, Some("regex_only".to_string()));

        let cost_limit = project.get_setting("cost_limit_per_scan").unwrap();
        assert_eq!(cost_limit, Some("1.0".to_string()));

        let onboarding = project.get_setting("onboarding_completed").unwrap();
        assert_eq!(onboarding, Some("false".to_string()));
    }

    #[test]
    fn test_insert_project() {
        let project = TestProject::new("test_insert_project").unwrap();

        let project_id = project.insert_project(
            "Test Project",
            "/tmp/test",
            Some("django"),
        ).unwrap();

        assert!(project_id > 0);

        let count = project.count_rows("projects").unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_insert_scan() {
        let project = TestProject::new("test_insert_scan").unwrap();

        let project_id = project.insert_project("Test", "/tmp/test", None).unwrap();
        let scan_id = project.insert_scan(project_id, "completed").unwrap();

        assert!(scan_id > 0);

        let count = project.count_rows("scans").unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_insert_violation() {
        let project = TestProject::new("test_insert_violation").unwrap();

        let project_id = project.insert_project("Test", "/tmp/test", None).unwrap();
        let scan_id = project.insert_scan(project_id, "completed").unwrap();

        let violation_id = project.insert_violation(
            scan_id,
            "CC6.1",
            "high",
            "Missing authentication",
            "app.py",
            42,
            "def view(): pass",
            Some("regex"),
            None,
            None,
            Some("Missing @login_required decorator"),
        ).unwrap();

        assert!(violation_id > 0);

        let count = project.count_rows("violations").unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_insert_fix() {
        let project = TestProject::new("test_insert_fix").unwrap();

        let project_id = project.insert_project("Test", "/tmp/test", None).unwrap();
        let scan_id = project.insert_scan(project_id, "completed").unwrap();
        let violation_id = project.insert_violation(
            scan_id, "CC6.1", "high", "Test", "app.py", 1, "code",
            None, None, None, None,
        ).unwrap();

        let fix_id = project.insert_fix(
            violation_id,
            "def view(): pass",
            "@login_required\ndef view(): pass",
            "Added authentication decorator",
            "review",
        ).unwrap();

        assert!(fix_id > 0);

        let count = project.count_rows("fixes").unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_insert_scan_cost() {
        let project = TestProject::new("test_insert_scan_cost").unwrap();

        let project_id = project.insert_project("Test", "/tmp/test", None).unwrap();
        let scan_id = project.insert_scan(project_id, "completed").unwrap();

        let cost_id = project.insert_scan_cost(
            scan_id,
            10,      // files_analyzed
            5000,    // input_tokens
            1000,    // output_tokens
            2000,    // cache_read_tokens
            500,     // cache_write_tokens
            0.025,   // total_cost_usd
        ).unwrap();

        assert!(cost_id > 0);

        let count = project.count_rows("scan_costs").unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_create_file() {
        let project = TestProject::new("test_create_file").unwrap();

        let file_path = project.create_file(
            "app.py",
            "def hello(): return 'world'",
        ).unwrap();

        assert!(file_path.exists());
        assert!(file_path.is_file());

        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "def hello(): return 'world'");
    }

    #[test]
    fn test_create_file_with_subdirs() {
        let project = TestProject::new("test_create_file_subdirs").unwrap();

        let file_path = project.create_file(
            "src/auth/login.py",
            "# auth code",
        ).unwrap();

        assert!(file_path.exists());
        assert!(file_path.parent().unwrap().exists());
    }

    #[test]
    fn test_column_exists() {
        let project = TestProject::new("test_column_exists").unwrap();

        // Test v2 migration columns
        assert!(project.column_exists("violations", "detection_method").unwrap());
        assert!(project.column_exists("violations", "confidence_score").unwrap());
        assert!(project.column_exists("violations", "llm_reasoning").unwrap());
        assert!(project.column_exists("violations", "regex_reasoning").unwrap());

        // Test non-existent column
        assert!(!project.column_exists("violations", "nonexistent_column").unwrap());
    }

    #[test]
    fn test_list_indexes() {
        let project = TestProject::new("test_list_indexes").unwrap();

        let indexes = project.list_indexes().unwrap();

        // Should have at least 10 indexes (8 from v1 + 2 from v2)
        assert!(indexes.len() >= 10, "Expected at least 10 indexes, got {}", indexes.len());

        // Verify v2 indexes exist
        assert!(indexes.contains(&"idx_scan_costs_created_at".to_string()));
        assert!(indexes.contains(&"idx_scan_costs_scan_id".to_string()));
    }
}
