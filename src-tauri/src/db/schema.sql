-- Ryn SQLite Database Schema
-- SOC 2 Compliance Scanning and Automation

-- Projects table - tracks scanned projects
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    framework TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scans table - tracks individual scan executions
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

-- Violations table - compliance violations found during scans
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

-- Fixes table - AI-generated fixes for violations
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

-- Audit events table - track all actions for compliance audit trail
CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL CHECK(event_type IN (
        'scan_started', 'scan_completed', 'scan_failed',
        'violation_detected', 'violation_dismissed',
        'fix_generated', 'fix_applied',
        'project_created', 'project_selected', 'project_deleted',
        'settings_updated', 'settings_changed',
        'scan', 'violation', 'fix'  -- Legacy/test event types
    )),
    project_id INTEGER,
    violation_id INTEGER,
    fix_id INTEGER,
    description TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (violation_id) REFERENCES violations(id) ON DELETE SET NULL,
    FOREIGN KEY (fix_id) REFERENCES fixes(id) ON DELETE SET NULL
);

-- SOC 2 Controls reference table - master list of compliance controls
CREATE TABLE IF NOT EXISTS controls (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    requirement TEXT NOT NULL,
    category TEXT NOT NULL
);

-- Settings table - application configuration
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_violations_scan_id ON violations(scan_id);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
CREATE INDEX IF NOT EXISTS idx_fixes_violation_id ON fixes(violation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_scans_project_id ON scans(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_project_id ON audit_events(project_id);
CREATE INDEX IF NOT EXISTS idx_violations_file_path ON violations(file_path);
