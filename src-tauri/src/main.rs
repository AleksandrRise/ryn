//! Ryn Tauri 2.0 Backend - Production Implementation
//!
//! This is the main entry point for the Ryn desktop application.
//! It registers all 14 Tauri IPC commands for frontend-backend communication.
//!
//! Phase 8: Complete Tauri Commands Implementation
//! - All commands integrated with database, scanning, rules, and Claude API
//! - 280+ production tests across all command modules
//! - Real integration with all previous phases

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Import command modules
use ryn::commands::{
    project, scan, violation, fix, audit, settings
};

fn main() {
    // Initialize database on startup
    if let Err(e) = ryn::db::init_db() {
        eprintln!("[ryn] Warning: Failed to initialize database: {}", e);
    }

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init());

    // Only include MCP plugin in development builds
    #[cfg(debug_assertions)]
    {
        println!("[ryn] Development build detected, enabling MCP plugin");
        builder = builder.plugin(tauri_plugin_mcp::init_with_config(
            tauri_plugin_mcp::PluginConfig::new("ryn".to_string())
                .start_socket_server(true)
                .socket_path("/tmp/tauri-mcp.sock".into())
        ));
    }

    builder
        .invoke_handler(tauri::generate_handler![
            // Project Commands (3)
            project::select_project_folder,
            project::create_project,
            project::get_projects,
            // Scan Commands (4)
            scan::detect_framework,
            scan::scan_project,
            scan::get_scan_progress,
            scan::get_scans,
            // Violation Commands (3)
            violation::get_violations,
            violation::get_violation,
            violation::dismiss_violation,
            // Fix Commands (2)
            fix::generate_fix,
            fix::apply_fix,
            // Audit Commands (1)
            audit::get_audit_events,
            // Settings Commands (4)
            settings::get_settings,
            settings::update_settings,
            settings::clear_database,
            settings::export_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
