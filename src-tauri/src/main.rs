// Tauri 2.0 backend entry point
// Placeholder commands - will be implemented in separate backend work

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Import modules from lib.rs
use ryn::{commands, models, db, scanner, langgraph, rules, fix_generator, git, utils};

// Placeholder command structures
#[derive(serde::Serialize)]
struct ScanResult {
    scan_id: i64,
    files_scanned: i32,
    violations_found: i32,
    completed_at: String,
}

#[tauri::command]
fn scan_project(path: String) -> Result<ScanResult, String> {
    // TODO: Implement actual scanning logic
    println!("[ryn] scan_project called with path: {}", path);
    
    Ok(ScanResult {
        scan_id: 1,
        files_scanned: 147,
        violations_found: 18,
        completed_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
fn detect_framework(path: String) -> Result<String, String> {
    // TODO: Implement framework detection
    println!("[ryn] detect_framework called with path: {}", path);
    Ok("Django".to_string())
}

#[tauri::command]
fn select_project_folder() -> Result<String, String> {
    // TODO: Implement folder picker using tauri-plugin-dialog
    println!("[ryn] select_project_folder called");
    Ok("/Users/dev/projects/my-startup-app".to_string())
}

fn main() {
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
            scan_project,
            detect_framework,
            select_project_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
