/// Frontend console logging command
///
/// Forwards console messages from the frontend to the backend terminal
/// so they can be seen in the dev server output

#[tauri::command]
pub fn log_frontend_message(level: String, message: String) -> Result<(), String> {
    match level.as_str() {
        "error" => println!("[TAURI CONSOLE ERROR] {}", message),
        "warn" => println!("[TAURI CONSOLE WARN] {}", message),
        "log" => println!("[TAURI CONSOLE LOG] {}", message),
        _ => println!("[TAURI CONSOLE] {}", message),
    }
    Ok(())
}
