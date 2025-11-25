# Tauri Plugin MCP Bridge

A Tauri 2.0 plugin that enables Model Context Protocol (MCP) integration for desktop application automation. Allows AI assistants like Claude to inspect and interact with your Tauri app.

## Features

- ✅ Window management (list, info, show/hide, move, resize)
- ✅ Browser control (navigate, state, execute JS, tabs)
- ✅ DevTools integration (macOS only)
- ✅ DOM interactions (click, type, wait, snapshot)
- ✅ Event subscription
- ✅ Performance metrics
- ✅ Test recording/replay
- 🚧 Screenshot capture (requires tauri-plugin-screenshots)

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
tauri-plugin-mcp-bridge = { path = "../path/to/tauri-plugin-mcp-bridge" }
```

Or via git:

```toml
[dependencies]
tauri-plugin-mcp-bridge = { git = "https://github.com/yourusername/tauri-mcp-bridge" }
```

## Usage

### Basic Setup

Initialize the plugin in your Tauri app:

```rust
// src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_mcp_bridge::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

That's it! The plugin will:
1. Create a Unix socket at `~/.tauri/mcp.sock` (debug builds only)
2. Start a JSON-RPC 2.0 server
3. Handle incoming MCP commands
4. Execute Tauri API calls

### With DevTools Feature

To enable DevTools in production builds:

```toml
[dependencies]
tauri-plugin-mcp-bridge = { path = "../path/to/tauri-plugin-mcp-bridge", features = ["devtools"] }
```

## Architecture

The plugin implements a JSON-RPC 2.0 server that listens on a Unix socket:

```
MCP Server (TypeScript)
  ↓ Unix socket (~/.tauri/mcp.sock)
Plugin (JSON-RPC server)
  ↓ Routes to command handlers
Command Handlers (Rust modules)
  ↓ Execute Tauri APIs
Your Tauri App
```

### Components

#### 1. Socket Server (`src/server.rs`)

- Creates Unix socket at `~/.tauri/mcp.sock`
- Accepts incoming connections
- Parses JSON-RPC 2.0 requests
- Routes to command handlers
- Returns JSON-RPC 2.0 responses

#### 2. State Management (`src/state.rs`)

Global plugin state:

```rust
pub struct MCPState {
    pub event_subscriptions: Arc<Mutex<HashMap<String, EventId>>>,
    pub js_callbacks: Arc<Mutex<HashMap<String, CallbackSender>>>,
    pub recordings: Arc<Mutex<HashMap<String, Vec<TestAction>>>>,
}
```

#### 3. Command Handlers (`src/commands/`)

Modular command handlers:

- `window.rs` - Window management (6 commands)
- `webview.rs` - Browser control (4 commands)
- `devtools.rs` - DevTools (2 commands, macOS only)
- `script.rs` - JS interactions with callback pattern (4 commands)
- `events.rs` - Event subscription (3 commands)
- `performance.rs` - Performance metrics (1 command)
- `testing.rs` - Test recording/replay (2 commands)
- `screenshot.rs` - Screenshot capture (1 command, stub)

### JavaScript Callback Pattern

Since Tauri's `eval()` doesn't return values, the plugin uses a callback pattern:

```rust
// 1. Generate callback ID
let callback_id = uuid::Uuid::new_v4().to_string();

// 2. Create oneshot channel
let (tx, rx) = oneshot::channel();

// 3. Store in state
app.state::<MCPState>()
    .js_callbacks
    .lock()
    .unwrap()
    .insert(callback_id.clone(), tx);

// 4. Inject JS that invokes callback
let js = format!(r#"
    window.__TAURI__.invoke('js_callback', {{
        id: '{}',
        data: {{ result: 'value' }}
    }});
"#, callback_id);

window.eval(&js)?;

// 5. Await result with timeout
tokio::time::timeout(Duration::from_secs(30), rx).await??
```

## API Reference

### Window Management

All window commands accept a `label` parameter. If not provided, the first window is used.

#### `window_list`

Returns array of window labels.

#### `window_info`

Parameters:
- `label` (string): Window label

Returns window position, size, and state flags.

#### `window_show` / `window_hide`

Parameters:
- `label` (string): Window label

#### `window_move`

Parameters:
- `label` (string): Window label
- `x` (number): X coordinate
- `y` (number): Y coordinate

#### `window_resize`

Parameters:
- `label` (string): Window label
- `width` (number): Width in pixels
- `height` (number): Height in pixels

### Browser Control

#### `browser_navigate`

Parameters:
- `url` (string): URL to navigate to
- `label` (string, optional): Window label

#### `browser_state`

Parameters:
- `label` (string, optional): Window label

Returns current URL and window state.

#### `browser_execute`

Parameters:
- `code` (string): JavaScript code
- `label` (string, optional): Window label

Fire-and-forget JavaScript execution.

#### `browser_tabs`

Parameters:
- `action` (string): "list", "create", "close", "switch"
- `label` (string, optional): Window label
- `index` (number, optional): Window index
- `url` (string, optional): URL for new window

### Interactions

#### `browser_click`

Parameters:
- `element` (string): CSS selector
- `button` (string, optional): Mouse button
- `modifiers` (array, optional): Keyboard modifiers
- `label` (string, optional): Window label

#### `browser_type`

Parameters:
- `text` (string): Text to type
- `clear` (boolean, optional): Clear before typing
- `submit` (boolean, optional): Submit form
- `label` (string, optional): Window label

#### `browser_wait`

Parameters:
- `condition` (string): "selector", "url", "title"
- `value` (string): Value to wait for
- `timeout` (number, optional): Timeout in ms
- `label` (string, optional): Window label

#### `browser_snapshot`

Parameters:
- `includeText` (boolean, optional): Include text
- `maxDepth` (number, optional): Max depth
- `label` (string, optional): Window label

Returns DOM HTML snapshot.

### DevTools (macOS only)

Requires macOS 10.15+ and either debug build or `devtools` feature.

#### `devtools_open` / `devtools_close`

Parameters:
- `label` (string, optional): Window label

### Events

#### `events_subscribe`

Parameters:
- `types` (array): Event type strings

Stores EventId in state for later unsubscription.

#### `events_unsubscribe`

Parameters:
- `types` (array): Event type strings

#### `events_list`

Returns list of all available Tauri event types.

### Performance

#### `performance_metrics`

Parameters:
- `label` (string, optional): Window label

Returns Performance API data via JavaScript callback.

### Testing

#### `test_record` / `test_replay`

Not yet implemented - returns stub responses.

### Screenshots

#### `browser_screenshot`

Parameters:
- `label` (string, optional): Window label
- `fullPage` (boolean, optional): Full page
- `format` (string, optional): Image format

Requires `tauri-plugin-screenshots` to be installed.

## Development

### Building

```bash
cargo build
```

### Running Tests

```bash
cargo test
```

### Testing with a Tauri App

1. Add plugin to your Tauri app
2. Run the app: `npm exec tauri dev`
3. Check socket exists: `ls -la ~/.tauri/mcp.sock`
4. Test with MCP server: `node ../tauri-mcp-server/test-connection.js`

## Platform Support

- ✅ macOS 10.15+
- ✅ Linux (Ubuntu 20.04+, Fedora 36+)
- 🚧 Windows (planned)

### Platform-Specific Features

#### macOS
- Full DevTools support
- All features available

#### Linux
- DevTools not available
- All other features work

#### Windows
- Not yet tested/supported
- Contributions welcome

## Configuration

### Debug vs Release

The plugin behavior differs between debug and release builds:

**Debug builds:**
- Socket server always starts
- Socket at `~/.tauri/mcp.sock`
- All commands available

**Release builds:**
- Socket server disabled by default
- Enable with `TAURI_MCP_ENABLE=1` environment variable
- Or use plugin configuration (future feature)

### Features

```toml
[features]
default = []
devtools = []  # Enable DevTools in release builds
```

## Security Considerations

⚠️ **Important Security Notes:**

1. **Debug builds only by default** - The socket server only runs in debug builds to prevent unauthorized access in production.

2. **Local socket only** - Uses Unix domain socket, not network socket, limiting access to local machine.

3. **No authentication** - Currently no authentication mechanism. Anyone with socket access can control the app.

4. **Production use** - If enabling in production, implement additional security:
   - Authentication tokens
   - Permission system
   - Command allowlist
   - Audit logging

## Troubleshooting

### Socket not created

- Check you're running a debug build
- Verify `~/.tauri` directory exists and is writable
- Check app logs for errors

### Commands not working

- Ensure window labels are correct
- Check JavaScript errors in DevTools
- Verify Tauri version compatibility (2.0+)

### Borrowing errors during compilation

Common pattern - always store `app.webview_windows()` before calling `.get()`:

```rust
// ❌ Wrong - temporary value
let window = app.webview_windows().get(label)?;

// ✅ Correct - stored first
let windows = app.webview_windows();
let window = windows.get(label)?;
```

## Contributing

Contributions welcome! Areas needing work:

- [ ] Windows platform support
- [ ] Authentication/authorization
- [ ] Screenshot plugin integration
- [ ] Test recording implementation
- [ ] Event notification forwarding
- [ ] Performance optimizations
- [ ] More comprehensive tests

## License

MIT OR Apache-2.0

## Credits

Built with:
- [Tauri](https://tauri.app/) - v2.0
- [tokio](https://tokio.rs/) - Async runtime
- [serde](https://serde.rs/) - Serialization
- [uuid](https://github.com/uuid-rs/uuid) - UUID generation
