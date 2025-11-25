const COMMANDS: &[&str] = &["js_callback"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
