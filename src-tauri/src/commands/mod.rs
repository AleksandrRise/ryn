//! Tauri IPC Commands - Frontend to Backend Communication
//!
//! This module contains all Tauri commands for frontend-backend communication:
//!
//! Project Commands (5):
//! - select_project_folder: Open file dialog to select project directory
//! - create_project: Create a new project in the database
//! - get_projects: Retrieve all projects
//! - delete_project: Delete a single project and associated data
//! - delete_all_projects: Delete all projects and associated data
//!
//! Scan Commands (4):
//! - detect_framework: Identify project framework
//! - scan_project: Run all rule engines to find violations
//! - get_scan_progress: Get status and statistics of a scan
//! - get_scans: List all scans for a project
//!
//! Violation Commands (3):
//! - get_violations: Query violations with optional filters
//! - get_violation: Get single violation with full details
//! - dismiss_violation: Mark violation as dismissed
//!
//! Fix Commands (2):
//! - generate_fix: Call Grok API to generate a fix
//! - apply_fix: Apply fix to file and commit to git
//!
//! Audit Commands (1):
//! - get_audit_events: Retrieve audit trail with filters
//!
//! Settings Commands (4):
//! - get_settings: Retrieve all settings
//! - update_settings: Create or update a setting
//! - clear_database: Clear all scan history (destructive)
//! - export_data: Export all data to JSON
//!
//! GitHub Commands (10):
//! - start_github_oauth: Start OAuth device flow
//! - poll_github_oauth: Poll for OAuth completion
//! - check_github_connection: Check connection status
//! - disconnect_github: Disconnect GitHub account
//! - fetch_github_repos: Fetch repos from GitHub API
//! - get_github_repos: Get cached repos
//! - track_repo: Track a repo for monitoring
//! - untrack_repo: Stop tracking a repo
//! - get_tracked_repos: Get tracked repos with details
//! - check_repo_for_changes: Poll repo for new commits
//! - scan_github_repo: Snapshot and scan a tracked repo

pub mod analytics;
pub mod audit;
pub mod fix;
pub mod github;
pub mod logger;
pub mod project;
pub mod scan;
pub mod settings;
pub mod violation;

// Re-export all commands
pub use analytics::get_scan_costs;
pub use audit::get_audit_events;
pub use fix::{apply_fix, generate_fix};
pub use github::{
    check_github_connection, check_repo_for_changes, disconnect_github, fetch_github_repos,
    get_github_repos, get_tracked_repos, poll_github_oauth, scan_github_repo, start_github_oauth,
    track_repo, untrack_repo,
};
pub use logger::log_frontend_message;
pub use project::{
    create_project, delete_all_projects, delete_project, get_projects, select_project_folder,
};
pub use scan::{
    detect_framework, get_scan_progress, get_scans, scan_project, stop_watching, watch_project,
};
pub use settings::{clear_database, export_data, get_settings, update_settings};
pub use violation::{dismiss_violation, get_violation, get_violations};
