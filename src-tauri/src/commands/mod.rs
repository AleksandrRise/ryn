//! Tauri IPC Commands - Frontend to Backend Communication
//!
//! This module contains all 14 Tauri commands for frontend-backend communication:
//!
//! Project Commands (3):
//! - select_project_folder: Open file dialog to select project directory
//! - create_project: Create a new project in the database
//! - get_projects: Retrieve all projects
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
//! - generate_fix: Call Claude API to generate a fix
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

pub mod project;
pub mod scan;
pub mod violation;
pub mod fix;
pub mod audit;
pub mod settings;
pub mod analytics;

// Re-export all commands
pub use project::{select_project_folder, create_project, get_projects};
pub use scan::{detect_framework, scan_project, get_scan_progress, get_scans};
pub use violation::{get_violations, get_violation, dismiss_violation};
pub use fix::{generate_fix, apply_fix};
pub use audit::get_audit_events;
pub use settings::{get_settings, update_settings, clear_database, export_data};
pub use analytics::get_scan_costs;
