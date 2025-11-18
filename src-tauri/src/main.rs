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
    project, scan, violation, fix, audit, settings, analytics, logger
};

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
        .manage(scan::ScanResponseChannels::default())
        .manage(scan::FileWatcherState::default());

    // MCP plugin disabled - not linked in Cargo.toml
    // Uncomment and add dependency if needed for development
    // #[cfg(debug_assertions)]
    // {
    //     println!("[ryn] Development build detected, enabling MCP plugin");
    //     let socket_path = std::path::Path::new("/tmp/tauri-mcp.sock");
    //     if socket_path.exists() {
    //         println!("[ryn] Removing stale MCP socket file");
    //         if let Err(e) = std::fs::remove_file(socket_path) {
    //             eprintln!("[ryn] WARNING: Failed to remove stale socket: {}", e);
    //         }
    //     }
    //     builder = builder.plugin(tauri_plugin_mcp::init_with_config(
    //         tauri_plugin_mcp::PluginConfig::new("ryn".to_string())
    //             .start_socket_server(true)
    //             .socket_path("/tmp/tauri-mcp.sock".into())
    //     ));
    // }

    // Run the Tauri application
    // If this fails, log detailed error and exit gracefully
    if let Err(e) = builder
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
            // Logger Commands (1)
            logger::log_frontend_message,
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
