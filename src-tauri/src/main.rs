//! Ryn Tauri 2.0 Backend - Production Implementation
//!
//! This is the main entry point for the Ryn desktop application.
//! It registers all 15 Tauri IPC commands for frontend-backend communication.
//!
//! Phase 8: Complete Tauri Commands Implementation
//! - All commands integrated with database, scanning, rules, and Grok API
//! - 280+ production tests across all command modules
//! - Real integration with all previous phases

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Import command modules
use ryn::commands::{analytics, audit, fix, github, logger, project, scan, settings, violation};

fn main() {
    // Load environment variables from .env file
    // This allows API keys and config to be read from .env during development
    if let Err(e) = ryn::utils::env::load_env() {
        eprintln!("[ryn] WARNING: Failed to load .env file: {}", e);
        eprintln!("[ryn] API keys must be set in system environment");
    }

    // Initialize database - REQUIRED for app to function properly
    // If database initialization fails, the app cannot operate correctly
    if let Err(e) = ryn::db::init_db() {
        println!("[ryn] FATAL ERROR: Failed to initialize database");
        println!("[ryn] Error details: {}", e);
        println!("[ryn] The application cannot run without a working database.");
        println!("[ryn] Please check:");
        println!("[ryn]   - File system permissions in the data directory");
        println!("[ryn]   - Available disk space");
        println!("[ryn]   - SQLite installation");
        std::process::exit(1);
    }

    // Build the Tauri application
    // Start with base configuration
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(scan::ScanResponseChannels::default());

    // Run the Tauri application
    // If this fails, log detailed error and exit gracefully
    if let Err(e) = builder
        .invoke_handler(tauri::generate_handler![
            // Project Commands (10)
            project::select_project_folder,
            project::create_project,
            project::get_projects,
            // Scan Commands (6)
            scan::detect_framework,
            scan::scan_project,
            scan::get_scan_progress,
            scan::get_scans,
            scan::respond_to_cost_limit,
            scan::cancel_scan,
            // Violation Commands (3)
            violation::get_violations,
            violation::get_violation,
            violation::dismiss_violation,
            // Fix Commands (2)
            fix::generate_fix,
            fix::apply_fix,
            // Audit Commands (1)
            audit::get_audit_events,
            // Settings Commands (6)
            settings::get_settings,
            settings::update_settings,
            settings::clear_database,
            settings::export_data,
            settings::complete_onboarding,
            settings::check_api_key_available,
            // Analytics Commands (2)
            analytics::get_scan_costs,
            analytics::get_scan_cost,
            // Logger Commands (1)
            logger::log_frontend_message,
            // GitHub Commands (10)
            github::start_github_oauth,
            github::poll_github_oauth,
            github::check_github_connection,
            github::disconnect_github,
            github::fetch_github_repos,
            github::get_github_repos,
            github::track_repo,
            github::untrack_repo,
            github::get_tracked_repos,
            github::check_repo_for_changes,
            github::scan_github_repo,
            // Project Delete Commands
            project::delete_project,
            project::delete_all_projects,
            // File Reading Command
            project::read_file_content,
            // Project Tracking Commands (4)
            project::enable_project_tracking,
            project::disable_project_tracking,
            project::get_project_tracking_status,
            project::update_last_file_change,
        ])
        .run(tauri::generate_context!())
    {
        println!("[ryn] FATAL ERROR: Application failed to start");
        println!("[ryn] Error details: {}", e);
        println!("[ryn] This may be due to:");
        println!("[ryn]   - Port conflicts (if another instance is running)");
        println!("[ryn]   - Missing system dependencies");
        println!("[ryn]   - Incompatible OS version");
        std::process::exit(1);
    }
}
