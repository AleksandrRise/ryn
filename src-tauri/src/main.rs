//! Ryn Tauri 2.0 Backend - Production Implementation
//!
//! This is the main entry point for the Ryn desktop application.
//! It registers all 15 Tauri IPC commands for frontend-backend communication.
//!
//! Phase 8: Complete Tauri Commands Implementation
//! - All commands integrated with database, scanning, rules, and Claude API
//! - 280+ production tests across all command modules
//! - Real integration with all previous phases

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Import command modules
use ryn::commands::{
    project, scan, violation, fix, audit, settings, analytics, langgraph
};

fn main() {
    // Initialize database - REQUIRED for app to function properly
    // If database initialization fails, the app cannot operate correctly
    if let Err(e) = ryn::db::init_db() {
        eprintln!("[ryn] FATAL ERROR: Failed to initialize database");
        eprintln!("[ryn] Error details: {}", e);
        eprintln!("[ryn] The application cannot run without a working database.");
        eprintln!("[ryn] Please check:");
        eprintln!("[ryn]   - File system permissions in the data directory");
        eprintln!("[ryn]   - Available disk space");
        eprintln!("[ryn]   - SQLite installation");
        std::process::exit(1);
    }

    // Build the Tauri application
    // If this fails, log detailed error and exit gracefully
    if let Err(e) = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(scan::ScanResponseChannels::default())
        .manage(scan::FileWatcherState::default())
        .invoke_handler(tauri::generate_handler![
            // Project Commands (3)
            project::select_project_folder,
            project::create_project,
            project::get_projects,
            // Scan Commands (7) - added watch_project and stop_watching
            scan::detect_framework,
            scan::scan_project,
            scan::watch_project,
            scan::stop_watching,
            scan::get_scan_progress,
            scan::get_scans,
            scan::respond_to_cost_limit,
            // Violation Commands (3)
            violation::get_violations,
            violation::get_violation,
            violation::dismiss_violation,
            // Fix Commands (2)
            fix::generate_fix,
            fix::apply_fix,
            // Audit Commands (1)
            audit::get_audit_events,
            // Settings Commands (5)
            settings::get_settings,
            settings::update_settings,
            settings::clear_database,
            settings::export_data,
            settings::complete_onboarding,
            // Analytics Commands (1)
            analytics::get_scan_costs,
            // LangGraph Commands (1)
            langgraph::run_agent_response,
        ])
        .run(tauri::generate_context!())
    {
        eprintln!("[ryn] FATAL ERROR: Application failed to start");
        eprintln!("[ryn] Error details: {}", e);
        eprintln!("[ryn] This may be due to:");
        eprintln!("[ryn]   - Port conflicts (if another instance is running)");
        eprintln!("[ryn]   - Missing system dependencies");
        eprintln!("[ryn]   - Incompatible OS version");
        std::process::exit(1);
    }
}
