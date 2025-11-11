# Ryn Complete Implementation Plan: Desktop App with LangGraph Agents

## Core Architecture (Aligned with rynspec)
- **Product**: Ryn (desktop app that behaves like an IDE extension via file watching)
- **Framework**: Tauri 2.0 (current architecture is correct)
- **Agent Orchestration**: LangGraph for multi-agent code analysis workflow
- **Code Analysis**: tree-sitter parsing + LangGraph semantic agents
- **Languages**: Python (Django/Flask) + JavaScript/TypeScript (Node.js/Express/React)
- **SOC 2 Controls**: All 4 (CC6.1, CC6.7, CC7.2, A1.2)
- **API Keys**: .env file (ANTHROPIC_API_KEY for Claude Haiku 4.5)
- **Fix Strategy**: Direct file modification + git commit
- **Test Coverage**: 99% with all edge cases
- **Database**: SQLite with manual SQL migrations
- **Frontend**: Progressive integration as backend builds

---

## Phase 1: Foundation (Day 1-2)

### 1.1 Update Cargo Dependencies
**File**: `src-tauri/Cargo.toml`
**Action**: Add these exact dependencies:
```toml
[dependencies]
# Existing
tauri = "2.0"
tauri-plugin-sql = { version = "2.0", features = ["sqlite"] }
tauri-plugin-fs = "2.0"
tauri-plugin-dialog = "2.0"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }

# NEW
tree-sitter = "0.22"
tree-sitter-python = "0.21"
tree-sitter-javascript = "0.21"
tree-sitter-typescript = "0.21"
walkdir = "2"
regex = "1"
git2 = "0.19"
dotenv = "0.15"
thiserror = "1"
anyhow = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json", "stream"] }
rusqlite = { version = "0.31", features = ["bundled"] }
notify = "6"  # File watching
async-channel = "2"

[dev-dependencies]
rstest = "0.21"
tempfile = "3"
mockall = "0.12"
serial_test = "3"
```

### 1.2 Add Node.js Dependencies for LangGraph
**File**: `package.json`
**Action**: Add to dependencies and devDependencies:
```json
{
  "dependencies": {
    "@langchain/core": "^0.2.0",
    "@langchain/langgraph": "^0.0.20",
    "@langchain/anthropic": "^0.2.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@testing-library/react": "^15.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/user-event": "^14.5.0",
    "@tauri-apps/api": "^2.0.0",
    "playwright": "^1.45.0",
    "happy-dom": "^14.12.0"
  }
}
```

### 1.3 Create .env Template
**File**: `.env.example` (CREATE NEW)
```
# Anthropic API Key for Claude Haiku 4.5
ANTHROPIC_API_KEY=your_api_key_here

# Optional: OpenAI fallback
OPENAI_API_KEY=your_openai_key_here
```

**File**: `.env` (CREATE NEW, add to .gitignore)
```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

### 1.4 Update .gitignore
**File**: `.gitignore`
**Action**: Ensure these lines exist:
```
.env
*.db
*.db-*
src-tauri/target/
```

### 1.5 Create Rust Module Structure
**Action**: Create this exact directory structure:
```
src-tauri/src/
├── main.rs (refactor)
├── lib.rs (CREATE - re-export modules)
├── commands/
│   ├── mod.rs
│   ├── project.rs
│   ├── scan.rs
│   ├── violation.rs
│   ├── fix.rs
│   ├── audit.rs
│   └── settings.rs
├── models/
│   ├── mod.rs
│   ├── project.rs
│   ├── scan.rs
│   ├── violation.rs
│   ├── fix.rs
│   ├── audit.rs
│   ├── control.rs
│   └── settings.rs
├── db/
│   ├── mod.rs
│   ├── schema.sql
│   ├── migrations.rs
│   └── queries.rs
├── scanner/
│   ├── mod.rs
│   ├── framework_detector.rs
│   ├── file_watcher.rs
│   ├── python_scanner.rs
│   ├── javascript_scanner.rs
│   └── tree_sitter_utils.rs
├── langgraph/
│   ├── mod.rs
│   ├── agent_runner.rs
│   ├── nodes.rs
│   └── state.rs
├── rules/
│   ├── mod.rs
│   ├── cc6_1_access_control.rs
│   ├── cc6_7_secrets.rs
│   ├── cc7_2_logging.rs
│   └── a1_2_resilience.rs
├── fix_generator/
│   ├── mod.rs
│   ├── claude_client.rs
│   └── fix_applicator.rs
├── git/
│   ├── mod.rs
│   └── operations.rs
└── utils/
    ├── mod.rs
    └── env.rs
```

### 1.6 Create Test Configuration
**File**: `vitest.config.ts` (CREATE)
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 99,
        statements: 99
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

**File**: `vitest.setup.ts` (CREATE)
```typescript
import '@testing-library/jest-dom'
import { mockIPC } from '@tauri-apps/api/mocks'
import { beforeAll } from 'vitest'

beforeAll(() => {
  Object.defineProperty(window, 'crypto', {
    value: {
      getRandomValues: (buffer: any) => {
        return crypto.getRandomValues(buffer)
      },
    },
  })
})
```

---

## Phase 2: Database Layer (Day 2-3)

### 2.1 Database Schema
**File**: `src-tauri/src/db/schema.sql` (CREATE)

```sql
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    framework TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scans table
CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    files_scanned INTEGER DEFAULT 0,
    violations_found INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')) DEFAULT 'running',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Violations table
CREATE TABLE IF NOT EXISTS violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id INTEGER NOT NULL,
    control_id TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    description TEXT NOT NULL,
    file_path TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    code_snippet TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('open', 'fixed', 'dismissed')) DEFAULT 'open',
    detected_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

-- Fixes table
CREATE TABLE IF NOT EXISTS fixes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    violation_id INTEGER NOT NULL,
    original_code TEXT NOT NULL,
    fixed_code TEXT NOT NULL,
    explanation TEXT NOT NULL,
    trust_level TEXT NOT NULL CHECK(trust_level IN ('auto', 'review', 'manual')),
    applied_at TEXT,
    applied_by TEXT NOT NULL DEFAULT 'ryn-ai',
    git_commit_sha TEXT,
    FOREIGN KEY (violation_id) REFERENCES violations(id) ON DELETE CASCADE
);

-- Audit events table
CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL CHECK(event_type IN ('scan', 'violation', 'fix', 'project_selected', 'settings_changed')),
    project_id INTEGER,
    violation_id INTEGER,
    fix_id INTEGER,
    description TEXT NOT NULL,
    metadata TEXT, -- JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (violation_id) REFERENCES violations(id) ON DELETE SET NULL,
    FOREIGN KEY (fix_id) REFERENCES fixes(id) ON DELETE SET NULL
);

-- SOC 2 Controls reference table
CREATE TABLE IF NOT EXISTS controls (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    requirement TEXT NOT NULL,
    category TEXT NOT NULL
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_violations_scan_id ON violations(scan_id);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
CREATE INDEX IF NOT EXISTS idx_fixes_violation_id ON fixes(violation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_scans_project_id ON scans(project_id);
```

### 2.2 Implement Database Models

**File**: `src-tauri/src/models/mod.rs` (CREATE)
```rust
pub mod project;
pub mod scan;
pub mod violation;
pub mod fix;
pub mod audit;
pub mod control;
pub mod settings;

pub use project::*;
pub use scan::*;
pub use violation::*;
pub use fix::*;
pub use audit::*;
pub use control::*;
pub use settings::*;
```

**File**: `src-tauri/src/models/violation.rs` (CREATE)
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
}

impl std::fmt::Display for Severity {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            Severity::Critical => write!(f, "critical"),
            Severity::High => write!(f, "high"),
            Severity::Medium => write!(f, "medium"),
            Severity::Low => write!(f, "low"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ViolationStatus {
    Open,
    Fixed,
    Dismissed,
}

impl std::fmt::Display for ViolationStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            ViolationStatus::Open => write!(f, "open"),
            ViolationStatus::Fixed => write!(f, "fixed"),
            ViolationStatus::Dismissed => write!(f, "dismissed"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Violation {
    pub id: i64,
    pub scan_id: i64,
    pub control_id: String,
    pub severity: Severity,
    pub description: String,
    pub file_path: String,
    pub line_number: i32,
    pub code_snippet: String,
    pub status: ViolationStatus,
    pub detected_at: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_severity_display() {
        assert_eq!(Severity::Critical.to_string(), "critical");
        assert_eq!(Severity::High.to_string(), "high");
        assert_eq!(Severity::Medium.to_string(), "medium");
        assert_eq!(Severity::Low.to_string(), "low");
    }

    #[test]
    fn test_violation_status_display() {
        assert_eq!(ViolationStatus::Open.to_string(), "open");
        assert_eq!(ViolationStatus::Fixed.to_string(), "fixed");
        assert_eq!(ViolationStatus::Dismissed.to_string(), "dismissed");
    }

    #[test]
    fn test_violation_creation() {
        let violation = Violation {
            id: 1,
            scan_id: 1,
            control_id: "CC6.1".to_string(),
            severity: Severity::Critical,
            description: "Missing MFA".to_string(),
            file_path: "/app/auth.py".to_string(),
            line_number: 42,
            code_snippet: "def login():".to_string(),
            status: ViolationStatus::Open,
            detected_at: "2025-11-11T00:00:00Z".to_string(),
        };

        assert_eq!(violation.id, 1);
        assert_eq!(violation.severity, Severity::Critical);
        assert_eq!(violation.status, ViolationStatus::Open);
    }
}
```

### 2.3 Implement Database Operations

**File**: `src-tauri/src/db/mod.rs` (CREATE)
```rust
pub mod migrations;
pub mod queries;

use rusqlite::{Connection, Result as SqlResult};
use std::path::PathBuf;
use tauri::AppHandle;

pub const DB_NAME: &str = "ryn.db";

pub fn get_db_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to get app data dir")
        .join(DB_NAME)
}

pub fn init_db(app: &AppHandle) -> SqlResult<Connection> {
    let db_path = get_db_path(app);

    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).expect("failed to create app data dir");
    }

    let conn = Connection::open(db_path)?;
    migrations::run_migrations(&conn)?;

    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_db_initialization() {
        // Initialize in-memory database for testing
        let conn = Connection::open_in_memory().unwrap();
        migrations::run_migrations(&conn).unwrap();

        // Verify database is initialized
        let query = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'");
        assert!(query.is_ok());
    }
}
```

**File**: `src-tauri/src/db/migrations.rs` (CREATE)
```rust
use rusqlite::{Connection, Result as SqlResult};

const SCHEMA: &str = include_str!("schema.sql");

const SEED_CONTROLS: &str = r#"
INSERT OR IGNORE INTO controls (id, name, description, requirement, category) VALUES
('CC6.1', 'Logical and Physical Access Controls', 'Implements multi-factor authentication and role-based access control', 'All systems must enforce MFA and RBAC with audit logging', 'Access Control'),
('CC6.7', 'Encryption and Secrets Management', 'Protects data through encryption and secure secrets management', 'Encrypt data at rest and in transit. No hardcoded secrets.', 'Data Protection'),
('CC7.2', 'System Monitoring', 'Monitors system components to detect anomalies', 'Implement comprehensive audit logging for all sensitive operations', 'Monitoring'),
('CC7.3', 'Log Evaluation', 'Reviews logs to detect issues', 'Logs must be tamper-proof with correlation IDs and retention policies', 'Monitoring'),
('A1.2', 'Data Processing and Availability', 'Ensures processing integrity and availability', 'Implement error handling, circuit breakers, and graceful degradation', 'Availability');
"#;

pub fn run_migrations(conn: &Connection) -> SqlResult<()> {
    // Execute schema
    conn.execute_batch(SCHEMA)?;

    // Seed reference data
    conn.execute_batch(SEED_CONTROLS)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrations_create_all_tables() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();

        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(tables, vec![
            "audit_events",
            "controls",
            "fixes",
            "projects",
            "scans",
            "settings",
            "violations"
        ]);
    }

    #[test]
    fn test_migrations_seed_controls() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM controls", [], |row| row.get(0))
            .unwrap();

        assert_eq!(count, 5);
    }

    #[test]
    fn test_foreign_key_constraints() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        conn.execute("PRAGMA foreign_keys = ON", []).unwrap();

        let result = conn.execute(
            "INSERT INTO violations (scan_id, control_id, severity, description, file_path, line_number, code_snippet)
             VALUES (999, 'CC6.1', 'high', 'test', '/test.py', 1, 'code')",
            []
        );

        assert!(result.is_err());
    }
}
```

---

## Phase 3: LangGraph Agent System (Day 3-5)

### 3.1 Create LangGraph State Machine

**File**: `lib/langgraph/agent.ts` (CREATE NEW)
```typescript
import { StateGraph, Annotation } from "@langchain/langgraph"
import { ChatAnthropic } from "@langchain/anthropic"
import { ToolNode } from "@langchain/langgraph/prebuilt"

// Agent state definition
const AgentState = Annotation.Root({
  filePath: Annotation<string>,
  code: Annotation<string>,
  framework: Annotation<string>,
  violations: Annotation<Array<any>>({
    default: () => [],
    reducer: (x: any, y: any) => y || x,
  }),
  fixes: Annotation<Array<any>>({
    default: () => [],
    reducer: (x: any, y: any) => y || x,
  }),
  currentStep: Annotation<string>,
})

// Node implementations
async function parseNode(state: typeof AgentState.State) {
  return {
    ...state,
    currentStep: "parsed",
  }
}

async function analyzeNode(state: typeof AgentState.State) {
  return {
    ...state,
    currentStep: "analyzed",
  }
}

async function generateFixesNode(state: typeof AgentState.State) {
  return {
    ...state,
    currentStep: "fixes_generated",
  }
}

async function validateNode(state: typeof AgentState.State) {
  return {
    ...state,
    currentStep: "validated",
  }
}

// Build graph
const workflow = new StateGraph(AgentState)
  .addNode("parse", parseNode)
  .addNode("analyze", analyzeNode)
  .addNode("generate_fixes", generateFixesNode)
  .addNode("validate", validateNode)
  .addEdge("parse", "analyze")
  .addEdge("analyze", "generate_fixes")
  .addEdge("generate_fixes", "validate")
  .setEntryPoint("parse")
  .addEdge("validate", "__end__")

export const agent = workflow.compile()
```

### 3.2 Rust-TypeScript Bridge for Agents

**File**: `src-tauri/src/langgraph/agent_runner.rs` (CREATE)
```rust
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisRequest {
    pub file_path: String,
    pub code: String,
    pub framework: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub violations: Vec<Violation>,
    pub fixes: Vec<Fix>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Violation {
    pub control_id: String,
    pub severity: String,
    pub description: String,
    pub line_number: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Fix {
    pub violation_id: String,
    pub original_code: String,
    pub fixed_code: String,
    pub explanation: String,
}

pub async fn run_analysis<R: Runtime>(
    _app: &AppHandle<R>,
    request: AnalysisRequest,
) -> Result<AnalysisResult, String> {
    // Placeholder: Will invoke Node.js LangGraph agent
    // For now, return empty result
    Ok(AnalysisResult {
        violations: vec![],
        fixes: vec![],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analysis_request_serialization() {
        let request = AnalysisRequest {
            file_path: "/app/auth.py".to_string(),
            code: "def login(): pass".to_string(),
            framework: "Django".to_string(),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: AnalysisRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.file_path, "/app/auth.py");
    }
}
```

---

## Phase 4: Scanning Engine (Day 5-8)

### 4.1 Framework Detection

**File**: `src-tauri/src/scanner/framework_detector.rs` (CREATE)
```rust
use std::path::Path;
use anyhow::Result;

#[derive(Debug, PartialEq, Clone)]
pub enum Framework {
    Django,
    Flask,
    Express,
    NextJs,
    React,
    Unknown,
}

impl Framework {
    pub fn as_str(&self) -> &str {
        match self {
            Framework::Django => "Django",
            Framework::Flask => "Flask",
            Framework::Express => "Express",
            Framework::NextJs => "Next.js",
            Framework::React => "React",
            Framework::Unknown => "Unknown",
        }
    }
}

pub fn detect_framework(project_path: &Path) -> Result<Framework> {
    // Check for package.json (Node.js projects)
    let package_json = project_path.join("package.json");
    if package_json.exists() {
        let content = std::fs::read_to_string(package_json)?;
        if content.contains("\"next\"") {
            return Ok(Framework::NextJs);
        }
        if content.contains("\"express\"") {
            return Ok(Framework::Express);
        }
        if content.contains("\"react\"") {
            return Ok(Framework::React);
        }
    }

    // Check for requirements.txt or Pipfile (Python projects)
    let requirements = project_path.join("requirements.txt");
    let pipfile = project_path.join("Pipfile");

    if requirements.exists() {
        let content = std::fs::read_to_string(requirements)?;
        if content.to_lowercase().contains("django") {
            return Ok(Framework::Django);
        }
        if content.to_lowercase().contains("flask") {
            return Ok(Framework::Flask);
        }
    }

    if pipfile.exists() {
        let content = std::fs::read_to_string(pipfile)?;
        if content.to_lowercase().contains("django") {
            return Ok(Framework::Django);
        }
        if content.to_lowercase().contains("flask") {
            return Ok(Framework::Flask);
        }
    }

    // Check for manage.py (Django)
    if project_path.join("manage.py").exists() {
        return Ok(Framework::Django);
    }

    Ok(Framework::Unknown)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_detect_django_from_requirements() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("requirements.txt"), "Django==4.2.0\npsycopg2==2.9.0").unwrap();

        let framework = detect_framework(dir.path()).unwrap();
        assert_eq!(framework, Framework::Django);
    }

    #[test]
    fn test_detect_django_from_manage_py() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("manage.py"), "#!/usr/bin/env python").unwrap();

        let framework = detect_framework(dir.path()).unwrap();
        assert_eq!(framework, Framework::Django);
    }

    #[test]
    fn test_detect_flask_from_requirements() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("requirements.txt"), "Flask==2.3.0").unwrap();

        let framework = detect_framework(dir.path()).unwrap();
        assert_eq!(framework, Framework::Flask);
    }

    #[test]
    fn test_detect_express_from_package_json() {
        let dir = TempDir::new().unwrap();
        fs::write(
            dir.path().join("package.json"),
            r#"{"dependencies": {"express": "^4.18.0"}}"#
        ).unwrap();

        let framework = detect_framework(dir.path()).unwrap();
        assert_eq!(framework, Framework::Express);
    }

    #[test]
    fn test_detect_nextjs_from_package_json() {
        let dir = TempDir::new().unwrap();
        fs::write(
            dir.path().join("package.json"),
            r#"{"dependencies": {"next": "14.0.0", "react": "18.2.0"}}"#
        ).unwrap();

        let framework = detect_framework(dir.path()).unwrap();
        assert_eq!(framework, Framework::NextJs);
    }

    #[test]
    fn test_detect_unknown_framework() {
        let dir = TempDir::new().unwrap();
        let framework = detect_framework(dir.path()).unwrap();
        assert_eq!(framework, Framework::Unknown);
    }

    #[test]
    fn test_framework_as_str() {
        assert_eq!(Framework::Django.as_str(), "Django");
        assert_eq!(Framework::Flask.as_str(), "Flask");
        assert_eq!(Framework::Express.as_str(), "Express");
        assert_eq!(Framework::NextJs.as_str(), "Next.js");
        assert_eq!(Framework::React.as_str(), "React");
        assert_eq!(Framework::Unknown.as_str(), "Unknown");
    }
}
```

### 4.2 File Watcher (Real-time IDE-like behavior)

**File**: `src-tauri/src/scanner/file_watcher.rs` (CREATE)
```rust
use anyhow::Result;
use async_channel::{Receiver, Sender};
use notify::{Watcher, RecursiveMode, Result as NotifyResult, Event, EventKind};
use std::path::{Path, PathBuf};

pub enum FileWatcherEvent {
    FileModified(PathBuf),
    FileCreated(PathBuf),
    FileDeleted(PathBuf),
    Error(String),
}

pub struct FileWatcher {
    sender: Sender<FileWatcherEvent>,
    receiver: Receiver<FileWatcherEvent>,
    watcher: Option<notify::RecommendedWatcher>,
}

impl FileWatcher {
    pub fn new() -> Result<(Self, Receiver<FileWatcherEvent>)> {
        let (sender, receiver) = async_channel::unbounded();
        let receiver_clone = receiver.clone();

        Ok((
            FileWatcher {
                sender,
                receiver: receiver_clone,
                watcher: None,
            },
            receiver,
        ))
    }

    pub fn start(&mut self, path: &Path) -> Result<()> {
        let sender = self.sender.clone();

        let mut watcher =
            notify::recommended_watcher(move |res: NotifyResult<Event>| {
                let _ = match res {
                    Ok(event) => match event.kind {
                        EventKind::Modify(_) => {
                            sender.try_send(FileWatcherEvent::FileModified(
                                event.paths.first().unwrap().clone(),
                            ))
                        }
                        EventKind::Create(_) => {
                            sender.try_send(FileWatcherEvent::FileCreated(
                                event.paths.first().unwrap().clone(),
                            ))
                        }
                        EventKind::Remove(_) => {
                            sender.try_send(FileWatcherEvent::FileDeleted(
                                event.paths.first().unwrap().clone(),
                            ))
                        }
                        _ => Ok(()),
                    },
                    Err(e) => {
                        sender.try_send(FileWatcherEvent::Error(e.to_string()))
                    }
                };
            })?;

        watcher.watch(path, RecursiveMode::Recursive)?;
        self.watcher = Some(watcher);

        Ok(())
    }

    pub fn stop(&mut self) -> Result<()> {
        if let Some(mut watcher) = self.watcher.take() {
            watcher.unwatch(&PathBuf::new())?;
        }
        Ok(())
    }

    pub async fn next_event(&self) -> Option<FileWatcherEvent> {
        self.receiver.recv().await.ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::fs;
    use tokio::time::{sleep, Duration};

    #[tokio::test]
    async fn test_file_watcher_creation() {
        let (watcher, _receiver) = FileWatcher::new().unwrap();
        assert!(watcher.watcher.is_none());
    }

    #[tokio::test]
    async fn test_file_watcher_modification_detection() {
        let dir = TempDir::new().unwrap();
        let test_file = dir.path().join("test.txt");
        fs::write(&test_file, "initial content").unwrap();

        let (mut watcher, mut receiver) = FileWatcher::new().unwrap();
        watcher.start(dir.path()).unwrap();

        // Give the watcher time to register
        sleep(Duration::from_millis(100)).await;

        // Modify file
        fs::write(&test_file, "modified content").unwrap();

        // Wait for event with timeout
        tokio::select! {
            _ = sleep(Duration::from_secs(2)) => {
                panic!("Timeout waiting for file modification event");
            }
            event = receiver.recv() => {
                match event {
                    Ok(FileWatcherEvent::FileModified(path)) => {
                        assert_eq!(path, test_file);
                    }
                    _ => panic!("Unexpected event type"),
                }
            }
        }

        watcher.stop().unwrap();
    }
}
```

### 4.3 tree-sitter Integration

**File**: `src-tauri/src/scanner/tree_sitter_utils.rs` (CREATE)
```rust
use tree_sitter::{Language, Parser};
use anyhow::Result;

extern "C" {
    fn tree_sitter_python() -> Language;
    fn tree_sitter_javascript() -> Language;
    fn tree_sitter_typescript() -> Language;
}

pub struct CodeParser {
    python_parser: Parser,
    javascript_parser: Parser,
    typescript_parser: Parser,
}

impl CodeParser {
    pub fn new() -> Result<Self> {
        let mut python_parser = Parser::new();
        python_parser.set_language(unsafe { tree_sitter_python() })?;

        let mut javascript_parser = Parser::new();
        javascript_parser.set_language(unsafe { tree_sitter_javascript() })?;

        let mut typescript_parser = Parser::new();
        typescript_parser.set_language(unsafe { tree_sitter_typescript() })?;

        Ok(CodeParser {
            python_parser,
            javascript_parser,
            typescript_parser,
        })
    }

    pub fn parse_python(&mut self, code: &str) -> Result<tree_sitter::Tree> {
        Ok(self
            .python_parser
            .parse(code, None)
            .expect("Failed to parse Python code"))
    }

    pub fn parse_javascript(&mut self, code: &str) -> Result<tree_sitter::Tree> {
        Ok(self
            .javascript_parser
            .parse(code, None)
            .expect("Failed to parse JavaScript code"))
    }

    pub fn parse_typescript(&mut self, code: &str) -> Result<tree_sitter::Tree> {
        Ok(self
            .typescript_parser
            .parse(code, None)
            .expect("Failed to parse TypeScript code"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parser_creation() {
        let parser = CodeParser::new();
        assert!(parser.is_ok());
    }

    #[test]
    fn test_parse_simple_python() {
        let mut parser = CodeParser::new().unwrap();
        let tree = parser.parse_python("def hello(): pass");
        assert!(tree.is_ok());
    }

    #[test]
    fn test_parse_simple_javascript() {
        let mut parser = CodeParser::new().unwrap();
        let tree = parser.parse_javascript("function hello() {}");
        assert!(tree.is_ok());
    }
}
```

---

## Phase 5: SOC 2 Rule Engine (Day 8-12)

### 5.1 CC6.1 - Access Control Rules

**File**: `src-tauri/src/rules/cc6_1_access_control.rs` (CREATE)
```rust
use regex::Regex;

pub struct AccessControlRule;

impl AccessControlRule {
    /// Detect missing authentication decorators on Django views
    pub fn detect_missing_auth_django(code: &str) -> Vec<(usize, String)> {
        let mut issues = vec![];

        // Pattern: function definition without @login_required or @permission_required
        let view_pattern = Regex::new(r"def\s+\w+\s*\(").unwrap();
        let auth_pattern = Regex::new(r"@(login_required|permission_required)").unwrap();

        let mut line_num = 1;
        for line in code.lines() {
            if view_pattern.is_match(line) && !auth_pattern.is_match(line) {
                issues.push((
                    line_num,
                    "Missing authentication decorator on view".to_string(),
                ));
            }
            line_num += 1;
        }

        issues
    }

    /// Detect missing RBAC checks
    pub fn detect_missing_rbac(code: &str) -> Vec<(usize, String)> {
        let mut issues = vec![];

        // Pattern: accessing sensitive data without permission checks
        let sensitive_pattern = Regex::new(r"(user|customer|data|secret)").unwrap();

        let mut line_num = 1;
        for line in code.lines() {
            if sensitive_pattern.is_match(line) && !line.contains("permission") && !line.contains("check") {
                issues.push((
                    line_num,
                    "Potential missing RBAC check".to_string(),
                ));
            }
            line_num += 1;
        }

        issues
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_missing_auth_django() {
        let code = r#"
def get_user_profile(request):
    user = User.objects.get(id=request.user.id)
    return JsonResponse(user)

@login_required
def protected_view(request):
    return JsonResponse({})
        "#;

        let issues = AccessControlRule::detect_missing_auth_django(code);
        assert!(issues.len() > 0);
        assert!(issues.iter().any(|(_, msg)| msg.contains("Missing authentication")));
    }

    #[test]
    fn test_detect_missing_rbac() {
        let code = "customer_data = get_customer(id)";
        let issues = AccessControlRule::detect_missing_rbac(code);
        assert!(issues.len() > 0);
    }
}
```

### 5.2 CC6.7 - Secrets Management

**File**: `src-tauri/src/rules/cc6_7_secrets.rs` (CREATE)
```rust
use regex::Regex;

pub struct SecretsManagementRule;

impl SecretsManagementRule {
    /// Detect hardcoded secrets
    pub fn detect_hardcoded_secrets(code: &str) -> Vec<(usize, String)> {
        let mut issues = vec![];

        let secret_patterns = vec![
            Regex::new(r#"(password|secret|key|token)\s*=\s*['\"].*['\"]"#).unwrap(),
            Regex::new(r#"(API_KEY|api_key)\s*=\s*['\"]sk_.*['\"]"#).unwrap(),
            Regex::new(r#"(password|passwd|pwd)\s*:\s*['\"].*['\"]"#).unwrap(),
        ];

        let mut line_num = 1;
        for line in code.lines() {
            for pattern in &secret_patterns {
                if pattern.is_match(line) {
                    issues.push((
                        line_num,
                        "Potential hardcoded secret detected".to_string(),
                    ));
                    break;
                }
            }
            line_num += 1;
        }

        issues
    }

    /// Detect missing TLS enforcement
    pub fn detect_missing_tls(code: &str) -> Vec<(usize, String)> {
        let mut issues = vec![];

        let http_pattern = Regex::new(r#"http://[^s]"#).unwrap();

        let mut line_num = 1;
        for line in code.lines() {
            if http_pattern.is_match(line) {
                issues.push((
                    line_num,
                    "Plaintext HTTP connection detected".to_string(),
                ));
            }
            line_num += 1;
        }

        issues
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_hardcoded_password() {
        let code = r#"password = "super_secret_123""#;
        let issues = SecretsManagementRule::detect_hardcoded_secrets(code);
        assert_eq!(issues.len(), 1);
    }

    #[test]
    fn test_detect_hardcoded_api_key() {
        let code = r#"API_KEY = "sk_live_abc123xyz""#;
        let issues = SecretsManagementRule::detect_hardcoded_secrets(code);
        assert_eq!(issues.len(), 1);
    }

    #[test]
    fn test_detect_missing_tls() {
        let code = r#"url = "http://example.com/api""#;
        let issues = SecretsManagementRule::detect_missing_tls(code);
        assert_eq!(issues.len(), 1);
    }

    #[test]
    fn test_https_not_flagged() {
        let code = r#"url = "https://example.com/api""#;
        let issues = SecretsManagementRule::detect_missing_tls(code);
        assert_eq!(issues.len(), 0);
    }
}
```

### 5.3 CC7.2/7.3 - Logging Rules

**File**: `src-tauri/src/rules/cc7_2_logging.rs` (CREATE)
```rust
use regex::Regex;

pub struct LoggingRule;

impl LoggingRule {
    /// Detect missing audit logs on sensitive operations
    pub fn detect_missing_audit_logs(code: &str) -> Vec<(usize, String)> {
        let mut issues = vec![];

        let sensitive_ops = vec![
            Regex::new(r"\.delete\(").unwrap(),
            Regex::new(r"\.update\(").unwrap(),
            Regex::new(r"\.save\(").unwrap(),
            Regex::new(r"os\.remove").unwrap(),
        ];

        let log_pattern = Regex::new(r"(log|audit|record)").unwrap();

        let mut line_num = 1;
        for line in code.lines() {
            let has_sensitive_op = sensitive_ops.iter().any(|p| p.is_match(line));
            if has_sensitive_op && !log_pattern.is_match(line) {
                issues.push((
                    line_num,
                    "Sensitive operation without audit logging".to_string(),
                ));
            }
            line_num += 1;
        }

        issues
    }

    /// Detect logging sensitive data
    pub fn detect_sensitive_data_in_logs(code: &str) -> Vec<(usize, String)> {
        let mut issues = vec![];

        let log_patterns = vec![
            (Regex::new(r#"(log|print).*password"#).unwrap(), "password"),
            (Regex::new(r#"(log|print).*token"#).unwrap(), "token"),
            (Regex::new(r#"(log|print).*secret"#).unwrap(), "secret"),
            (Regex::new(r#"(log|print).*ssn"#).unwrap(), "SSN"),
        ];

        let mut line_num = 1;
        for line in code.lines() {
            for (pattern, sensitive_type) in &log_patterns {
                if pattern.is_match(line) {
                    issues.push((
                        line_num,
                        format!("{} may be logged", sensitive_type),
                    ));
                    break;
                }
            }
            line_num += 1;
        }

        issues
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_missing_audit_logs() {
        let code = r#"
user.delete()
print("User deleted")
        "#;
        let issues = LoggingRule::detect_missing_audit_logs(code);
        assert!(issues.len() > 0);
    }

    #[test]
    fn test_detect_sensitive_data_in_logs() {
        let code = r#"logger.info(f"User password: {password}")"#;
        let issues = LoggingRule::detect_sensitive_data_in_logs(code);
        assert_eq!(issues.len(), 1);
    }

    #[test]
    fn test_delete_with_logging() {
        let code = r#"
audit_log.record("DELETE", user_id)
user.delete()
        "#;
        let issues = LoggingRule::detect_missing_audit_logs(code);
        assert_eq!(issues.len(), 0);
    }
}
```

### 5.4 A1.2 - Resilience Rules

**File**: `src-tauri/src/rules/a1_2_resilience.rs` (CREATE)
```rust
use regex::Regex;

pub struct ResilienceRule;

impl ResilienceRule {
    /// Detect missing error handling
    pub fn detect_missing_error_handling(code: &str) -> Vec<(usize, String)> {
        let mut issues = vec![];

        let risky_ops = vec![
            Regex::new(r"\.get\(|\.pop\(").unwrap(),
            Regex::new(r"json\.loads|json\.parse").unwrap(),
            Regex::new(r"open\(").unwrap(),
        ];

        let try_pattern = Regex::new(r"try:|except:|catch|try\s*{").unwrap();

        let mut line_num = 1;
        let mut in_try_block = false;

        for line in code.lines() {
            if try_pattern.is_match(line) {
                in_try_block = true;
            }

            let has_risky_op = risky_ops.iter().any(|p| p.is_match(line));
            if has_risky_op && !in_try_block {
                issues.push((
                    line_num,
                    "Risky operation without error handling".to_string(),
                ));
            }

            line_num += 1;
        }

        issues
    }

    /// Detect missing circuit breakers or retries
    pub fn detect_missing_resilience_patterns(code: &str) -> Vec<(usize, String)> {
        let mut issues = vec![];

        let external_calls = vec![
            Regex::new(r"requests\.").unwrap(),
            Regex::new(r"urllib").unwrap(),
            Regex::new(r"\.fetch\(").unwrap(),
        ];

        let resilience_pattern = Regex::new(r"(retry|circuit|backoff|timeout)").unwrap();

        let mut line_num = 1;
        for line in code.lines() {
            let has_external_call = external_calls.iter().any(|p| p.is_match(line));
            if has_external_call && !resilience_pattern.is_match(line) {
                issues.push((
                    line_num,
                    "External call without resilience pattern".to_string(),
                ));
            }
            line_num += 1;
        }

        issues
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_missing_error_handling() {
        let code = r#"
data = response.json()
print(data['user'])
        "#;
        let issues = ResilienceRule::detect_missing_error_handling(code);
        assert!(issues.len() > 0);
    }

    #[test]
    fn test_detect_missing_resilience() {
        let code = r#"response = requests.get("https://api.example.com/data")"#;
        let issues = ResilienceRule::detect_missing_resilience_patterns(code);
        assert_eq!(issues.len(), 1);
    }

    #[test]
    fn test_error_handling_prevents_flag() {
        let code = r#"
try:
    data = response.json()
except Exception:
    pass
        "#;
        let issues = ResilienceRule::detect_missing_error_handling(code);
        assert_eq!(issues.len(), 0);
    }
}
```

---

## Phase 6: Fix Generation with Claude (Day 12-15)

### 6.1 Claude API Client

**File**: `src-tauri/src/fix_generator/claude_client.rs` (CREATE)
```rust
use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<Message>,
}

#[derive(Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ClaudeResponse {
    content: Vec<ContentBlock>,
}

#[derive(Deserialize)]
struct ContentBlock {
    text: String,
}

pub struct ClaudeClient {
    api_key: String,
    client: Client,
}

impl ClaudeClient {
    pub fn new() -> Result<Self> {
        let api_key = env::var("ANTHROPIC_API_KEY")
            .map_err(|_| anyhow::anyhow!("ANTHROPIC_API_KEY not set"))?;

        Ok(ClaudeClient {
            api_key,
            client: Client::new(),
        })
    }

    pub async fn generate_fix(
        &self,
        violation_type: &str,
        original_code: &str,
        description: &str,
    ) -> Result<String> {
        let prompt = format!(
            "Fix the following {} violation:\n\nCode:\n{}\n\nDescription: {}\n\nProvide only the fixed code.",
            violation_type, original_code, description
        );

        let request = ClaudeRequest {
            model: "claude-3-5-haiku-20241022".to_string(),
            max_tokens: 2000,
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt,
            }],
        };

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .bearer_auth(&self.api_key)
            .json(&request)
            .send()
            .await?;

        let data: ClaudeResponse = response.json().await?;
        Ok(data.content.first().map(|c| c.text.clone()).unwrap_or_default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_claude_client_requires_api_key() {
        env::remove_var("ANTHROPIC_API_KEY");
        let result = ClaudeClient::new();
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_generate_fix_request_structure() {
        env::set_var("ANTHROPIC_API_KEY", "test_key");
        let client = ClaudeClient::new().unwrap();

        // This will fail without valid API key, but demonstrates structure
        let result = client
            .generate_fix("CC6.1", "password = 'secret'", "Hardcoded secret")
            .await;

        // In real tests, would mock the HTTP client
        let _ = result; // Suppress unused
    }
}
```

### 6.2 Prompt Engineering

**File**: `lib/langgraph/prompts.ts` (CREATE)
```typescript
export const SOC2_PROMPTS = {
  CC6_1: {
    name: "Access Control",
    system: `You are an expert at fixing SOC 2 CC6.1 (Access Control) violations.
You understand Django, Flask, Express, and Node.js authentication patterns.
Generate fixes that add proper authentication decorators, permission checks, and MFA enforcement.
Only output the fixed code without explanations.`,

    template: `Fix this CC6.1 violation in {framework}:
Code:
{code}

Issue: {issue}

Provide ONLY the fixed code:`,
  },

  CC6_7: {
    name: "Secrets Management",
    system: `You are an expert at fixing SOC 2 CC6.7 (Encryption and Secrets) violations.
You understand environment variables, vault integration, and TLS enforcement.
Generate fixes that remove hardcoded secrets, add proper encryption, and enforce HTTPS.
Only output the fixed code without explanations.`,

    template: `Fix this CC6.7 violation in {framework}:
Code:
{code}

Issue: {issue}

Provide ONLY the fixed code:`,
  },

  CC7_2: {
    name: "Audit Logging",
    system: `You are an expert at fixing SOC 2 CC7.2/7.3 (Logging and Monitoring) violations.
You understand structured logging, audit events, and log retention.
Generate fixes that add comprehensive audit logging to sensitive operations.
Only output the fixed code without explanations.`,

    template: `Fix this CC7.2 violation in {framework}:
Code:
{code}

Issue: {issue}

Provide ONLY the fixed code:`,
  },

  A1_2: {
    name: "Resilience",
    system: `You are an expert at fixing SOC 2 A1.2 (Data Processing and Availability) violations.
You understand error handling, circuit breakers, and graceful degradation.
Generate fixes that add robust error handling and resilience patterns.
Only output the fixed code without explanations.`,

    template: `Fix this A1.2 violation in {framework}:
Code:
{code}

Issue: {issue}

Provide ONLY the fixed code:`,
  },
}

export function buildPrompt(
  controlId: string,
  framework: string,
  code: string,
  issue: string
): string {
  const prompt = SOC2_PROMPTS[controlId as keyof typeof SOC2_PROMPTS]
  if (!prompt) throw new Error(`Unknown control: ${controlId}`)

  return prompt.template
    .replace("{framework}", framework)
    .replace("{code}", code)
    .replace("{issue}", issue)
}
```

---

## Phase 7: Git Integration (Day 15-16)

### 7.1 Git Operations

**File**: `src-tauri/src/git/operations.rs` (CREATE)
```rust
use anyhow::Result;
use git2::{Repository, Signature, IndexAddOption};
use std::path::Path;

pub struct GitOperations;

impl GitOperations {
    /// Create a commit with the applied fix
    pub fn commit_fix(
        repo_path: &Path,
        file_path: &Path,
        violation_id: i64,
        control_id: &str,
    ) -> Result<String> {
        let repo = Repository::open(repo_path)?;
        let mut index = repo.index()?;

        // Stage the modified file
        index.add_path(file_path)?;
        index.write()?;

        // Create commit
        let signature = Signature::now("Ryn", "ryn@compliance.local")?;
        let tree_id = index.write_tree()?;
        let tree = repo.find_tree(tree_id)?;

        let head = repo.head()?;
        let parent_commit = repo.find_commit(head.target().unwrap())?;

        let commit_message = format!(
            "[Ryn] Fix {} violation (ID: {})\n\nAutomatically applied fix for SOC 2 {} control.",
            control_id, violation_id, control_id
        );

        let commit_oid = repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            &commit_message,
            &tree,
            &[&parent_commit],
        )?;

        Ok(commit_oid.to_string())
    }

    /// Check if repository is clean
    pub fn is_clean(repo_path: &Path) -> Result<bool> {
        let repo = Repository::open(repo_path)?;
        let statuses = repo.statuses(None)?;

        Ok(statuses.is_empty())
    }

    /// Get current branch name
    pub fn get_current_branch(repo_path: &Path) -> Result<String> {
        let repo = Repository::open(repo_path)?;
        let head = repo.head()?;

        Ok(head
            .shorthand()
            .unwrap_or("detached")
            .to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_git_operations_requires_valid_repo() {
        let dir = TempDir::new().unwrap();
        let result = GitOperations::is_clean(dir.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_repo_is_clean() {
        let dir = TempDir::new().unwrap();
        Repository::init(dir.path()).unwrap();

        let is_clean = GitOperations::is_clean(dir.path()).unwrap();
        assert!(is_clean);
    }
}
```

---

## Phase 8: Tauri Commands (Day 16-17)

### 8.1 Implement All Commands

**Commands to implement**:
1. `select_project_folder()` ✓ (stub exists)
2. `detect_framework(path)` ✓ (stub exists)
3. `scan_project(path)` ✓ (stub exists)
4. `get_scan_progress(scan_id)`
5. `get_violations(scan_id, filters)`
6. `get_violation(id)`
7. `generate_fix(violation_id)`
8. `apply_fix(fix_id)`
9. `dismiss_violation(id)`
10. `get_audit_events(filters)`
11. `get_settings()`
12. `update_settings(settings)`
13. `start_file_watcher(path)`
14. `stop_file_watcher()`

Each with complete test suite (20+ tests per command minimum).

---

## Phase 9: Frontend Integration (Day 17-19)

### 9.1 Update Tauri Commands Interface

**File**: `lib/tauri/commands.ts`
Replace all mock functions with real `invoke()` calls:
```typescript
import { invoke } from '@tauri-apps/api/core'

export async function scanProject(projectId: number): Promise<ScanResult> {
  return await invoke('scan_project', { projectId })
}

export async function getViolations(
  scanId: number,
  filters?: ViolationFilters
): Promise<Violation[]> {
  return await invoke('get_violations', { scanId, filters })
}

// ... implement all 14 commands
```

### 9.2 Update Components Progressively
1. **Scan Page** (`app/scan/page.tsx`) - Connect to real scan commands
2. **Violation Detail** (`app/violation/[id]/page.tsx`) - Real violation data + fix generation
3. **Dashboard** (`app/page.tsx`) - Real compliance calculations
4. **Audit Trail** (`app/audit/page.tsx`) - Real audit events
5. **Settings** (`app/settings/page.tsx`) - Persist to database

### 9.3 Real-time Updates
**Add Event System**:
```typescript
import { listen } from '@tauri-apps/api/event'

await listen('scan-progress', (event) => {
  // Update UI in real-time
})
```

---

## Phase 10: Comprehensive Testing (Day 19-20)

### 10.1 Rust Unit Tests
- Target: 99% coverage across all modules
- Run: `cargo test --workspace`
- Each module has dedicated test file
- Edge cases documented

### 10.2 Frontend Component Tests
Create `*.test.tsx` for all components with @testing-library/react

### 10.3 E2E Tests with Playwright
```typescript
test('complete scan workflow', async ({ page }) => {
  // 1. Select project folder
  // 2. Detect framework
  // 3. Run scan
  // 4. View violations
  // 5. Apply fix
  // 6. Verify git commit
})
```

### 10.4 Integration Tests
- Scan Python Django project → Detect violations → Generate fixes → Apply → Git commit
- Scan JavaScript Express project → Detect violations → Generate fixes → Apply → Git commit
- File watcher triggers scan → Real-time violation updates → Frontend displays

---

## Testing Strategy Summary

**99% Coverage Requirements**:
- **Rust**: Every function in every module has tests
- **TypeScript**: All Tauri command wrappers tested
- **Components**: Critical UI flows tested
- **E2E**: Full user workflows tested
- **Edge Cases**: Error handling, retries, rollbacks, concurrent operations

---

## Timeline

- **Day 1-2**: Foundation & dependencies
- **Day 2-3**: Database layer
- **Day 3-5**: LangGraph agents
- **Day 5-8**: Scanning engine
- **Day 8-12**: SOC 2 rules
- **Day 12-15**: Fix generation
- **Day 15-16**: Git integration
- **Day 16-17**: Tauri commands
- **Day 17-19**: Frontend integration
- **Day 19-20**: Testing

**Total: 20 days for complete, production-ready implementation with 99% test coverage**

---

## Success Criteria

✅ All 14 Tauri commands fully implemented and tested
✅ 99% test coverage across all modules
✅ File watcher provides real-time compliance feedback
✅ All 4 SOC 2 controls (CC6.1, CC6.7, CC7.2, A1.2) detected and fixed
✅ Claude Haiku 4.5 fix generation working
✅ Git commit integration working
✅ Frontend progressively updated with real backend data
✅ Complete CI/CD ready for production

---

## Assumptions

- User has ANTHROPIC_API_KEY set in .env
- Project uses Python (Django/Flask) or JavaScript/TypeScript (Express/Next.js)
- Git repository is initialized and clean before fixes applied
- Claude Haiku 4.5 API is accessible
- Tauri dev environment working (pnpm tauri dev)
