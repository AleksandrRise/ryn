# Tauri Documentation

**Source:** Context7 - /websites/rs-tauri
**Retrieved:** 2025-11-11
**Topics:** Configuration, setup, window management, building desktop apps

---

## Overview

Tauri is a framework for building tiny, blazing fast desktop applications using Rust for the backend and any web frontend (HTML, JS, CSS). It allows developers to create cross-platform binaries with a Rust-sourced API.

---

## Application Setup

### Setup Hook Configuration

The `setup` function initializes the Tauri application and runs once when the app starts. Use this for initial configuration like setting window titles or managing windows.

```rust
use tauri::Manager;

tauri::Builder::default()
  .setup(|app| {
    let main_window = app.get_webview_window("main").unwrap();
    main_window.set_title("Tauri!")?;
    Ok(())
  });
```

### App Initialization Process

The setup function:
1. Marks the app as having run setup
2. Creates initial windows based on configuration
3. Sets up asset handling
4. Executes user-defined setup logic

```rust
fn setup<R: Runtime>(app: &mut App<R>) -> crate::Result<()> {
  app.ran_setup = true;

  for window_config in app.config().app.windows.iter().filter(|w| w.create) {
    WebviewWindowBuilder::from_config(app.handle(), window_config)?.build()?;
  }

  app.manager.assets.setup(app);

  if let Some(setup) = app.setup.take() {
    (setup)(app).map_err(|e| crate::Error::Setup(e.into()))?;
  }

  Ok(())
}
```

---

## Window Management

### WindowBuilder Configuration

Create and configure windows with various options:

```rust
WindowBuilder::new()
  .title("My App")
  .inner_size(800.0, 600.0)
  .focused(true)
  .resizable(true)
  .decorations(true)
  .visible_on_all_workspaces(true)
```

### Window Configuration from Config File

Build a window from configuration:

```rust
WebviewWindowBuilder::from_config(manager, config)?
```

### Window Creation from Configuration

The `create_window` function handles:
- Builder configurations
- Platform-specific adjustments (macOS tabbing, Windows shadows)
- Positioning/sizing based on monitor information
- Window centering and overflow prevention

```rust
fn create_window<T: UserEvent, F: Fn(RawWindow) + Send + 'static>(
  window_id: WindowId,
  webview_id: u32,
  event_loop: &EventLoopWindowTarget<Message<T>>,
  context: &Context<T>,
  pending: PendingWindow<T, Wry<T>>,
  after_window_creation: Option<F>,
) -> Result<WindowWrapper>
```

### Window Visibility on All Workspaces

Control whether the window is visible across all virtual desktops:

```rust
// In WindowBuilder
pub fn visible_on_all_workspaces(self, visible_on_all_workspaces: bool) -> Self

// Platform-specific notes:
// - Windows / iOS / Android: Unsupported
```

### Window Manager Methods

```rust
impl<R: Runtime> WindowManager<R> {
  // Get locked handle to windows
  pub(crate) fn windows_lock(&self) -> MutexGuard<'_, HashMap<String, Window<R>>>

  // Prepare window for creation (checks for label conflicts, applies default icons)
  pub fn prepare_window(
    &self,
    mut pending: PendingWindow<EventLoopMessage, R>,
  ) -> crate::Result<PendingWindow<EventLoopMessage, R>>

  // Attach detached window to manager
  pub(crate) fn attach_window(
    &self,
    app_handle: AppHandle<R>,
    window: DetachedWindow<EventLoopMessage, R>,
    menu: Option<crate::window::WindowMenu<R>>,
  ) -> Window<R>

  // Get all window labels
  pub fn labels(&self) -> HashSet<String>
}
```

---

## Webview Management

### Building a Webview on Desktop

```rust
pub(crate) fn build(
  self,
  window: Window<R>,
  position: Position,
  size: Size,
) -> crate::Result<Webview<R>> {
  let app_manager = window.manager();
  let mut pending = self.into_pending_webview(&window, window.label())?;

  pending.webview_attributes.bounds = Some(tauri_runtime::dpi::Rect {
    size,
    position
  });

  let use_https_scheme = pending.webview_attributes.use_https_scheme;

  let webview = match &mut window.runtime() {
    RuntimeOrDispatch::Dispatch(dispatcher) => dispatcher.create_webview(pending),
    _ => unimplemented!(),
  }
  .map(|webview| {
    app_manager
      .webview
      .attach_webview(window.clone(), webview, use_https_scheme)
  })?;

  Ok(webview)
}
```

### Adding Child Webviews

```rust
// Add a new webview as a child of a window
// Requires feature flags: "desktop" and "unstable"
window.add_child(webview_builder, position, size)?;
```

---

## AppManager Constructor

The `with_handlers` function constructs and initializes an `AppManager` instance with:
- Context and plugin stores
- Invoke handler
- Event listeners
- Configuration parameters for window and webview management
- Conditional setup for tray and menu on desktop

```rust
impl<R: Runtime> AppManager<R> {
  pub(crate) fn with_handlers(
    context: Context<R>,
    plugins: PluginStore<R>,
    invoke_handler: Box<InvokeHandler<R>>,
    on_page_load: Option<Arc<OnPageLoad<R>>>,
    uri_scheme_protocols: HashMap<String, Arc<webview::UriSchemeProtocol<R>>>,
    state: StateManager,
    menu_event_listener: Vec<crate::app::GlobalMenuEventListener<AppHandle<R>>>,
    tray_icon_event_listeners: Vec<crate::app::GlobalTrayIconEventListener<AppHandle<R>>>,
    window_event_listeners: Vec<GlobalWindowEventListener<R>>,
    webview_event_listeners: Vec<GlobalWebviewEventListener<R>>,
    window_menu_event_listeners: HashMap<String, crate::app::GlobalMenuEventListener<Window<R>>>,
    invoke_initialization_script: String,
    channel_interceptor: Option<ChannelInterceptor<R>>,
    invoke_key: String,
  ) -> Self
}
```

---

## Building the Application

### Main Build Process

```rust
pub fn build(mut self, context: Context<R>) -> crate::Result<App<R>> {
  // Set up macOS default menu if needed
  #[cfg(target_os = "macos")]
  if self.menu.is_none() && self.enable_macos_default_menu {
    self.menu = Some(Box::new(|app_handle| {
      crate::menu::Menu::default(app_handle)
    }));
  }

  // Create app manager with handlers
  let manager = Arc::new(AppManager::with_handlers(
    context,
    self.plugins,
    self.invoke_handler,
    self.on_page_load,
    self.uri_scheme_protocols,
    self.state,
    self.menu_event_listeners,
    self.tray_icon_event_listeners,
    self.window_event_listeners,
    self.webview_event_listeners,
    HashMap::new(),
    self.invoke_initialization_script,
    self.channel_interceptor,
    self.invoke_key,
  ));

  // Platform-specific configurations
  // Windows: Fixed runtime for webview
  // Linux: GTK app ID configuration

  // Initialize runtime and setup event handlers
  let runtime = R::new(runtime_args)?;

  // Setup menu and tray event handlers (desktop)
  #[cfg(desktop)]
  {
    let proxy = runtime.create_proxy();
    muda::MenuEvent::set_event_handler(Some(move |e: muda::MenuEvent| {
      let _ = proxy.send_event(EventLoopMessage::MenuEvent(e.into()));
    }));

    #[cfg(feature = "tray-icon")]
    {
      let proxy = runtime.create_proxy();
      tray_icon::TrayIconEvent::set_event_handler(Some(move |e: tray_icon::TrayIconEvent| {
        let _ = proxy.send_event(EventLoopMessage::TrayIconEvent(e.into()));
      }));
    }
  }

  // Register core plugins and initialize services
  app.register_core_plugins()?;
  app.manage(Env::default());

  Ok(app)
}
```

---

## Menu Management

### Configure Window Menu (Desktop)

```rust
pub fn menu(mut self, menu: Menu<R>) -> Self {
  self.menu.replace(menu);
  self
}
```

### Show App-Wide Menu

```rust
pub fn show_menu(&self) -> crate::Result<()> {
  #[cfg(not(target_os = "macos"))]
  {
    let is_app_menu_set = self.manager.menu.menu_lock().is_some();
    if is_app_menu_set {
      for window in self.manager.windows().values() {
        if window.has_app_wide_menu() {
          window.show_menu()?;
        }
      }
    }
  }
  Ok(())
}
```

---

## Runtime Management

### PendingWindow API

Represents a window that has not yet been built:

```rust
pub struct PendingWindow<T, R: Runtime> {
  pub label: String,
  pub window_builder: WindowBuilder,
  pub webview: Option<PendingWebview<T, R>>,
}

impl PendingWindow {
  // Create new pending window with label validation
  pub fn new(
    window_builder: ...,
    label: impl Into<String>
  ) -> crate::Result<Self>

  // Set or replace the webview
  pub fn set_webview(
    &mut self,
    webview: PendingWebview<T, R>
  ) -> &mut Self
}
```

### Runtime Window/Webview Creation

```rust
// Create a new window
fn create_window<F: Fn(RawWindow) + Send + 'static>(
  &self,
  pending: PendingWindow<T, Self>,
  after_window_creation: Option<F>,
) -> Result<DetachedWindow<T, Self::Runtime>>;

// Create a new webview
fn create_webview(
  &self,
  window_id: WindowId,
  pending: PendingWebview<T, Self::Runtime>,
) -> Result<DetachedWebview<T, Self::Runtime>>;
```

---

## Configuration

### tauri.conf.json Structure

```json
{
  "$schema": "https://tauri.app/schemas/tauri.conf.json",
  "productName": "my-app",
  "version": "0.1.0",
  "identifier": "com.myapp.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:3000",
    "frontendDist": "../out"
  },
  "app": {
    "windows": [
      {
        "title": "My App",
        "width": 1400,
        "height": 900,
        "minWidth": 1200,
        "minHeight": 700,
        "resizable": true,
        "fullscreen": false,
        "decorations": true
      }
    ],
    "security": {
      "csp": null
    }
  }
}
```

### Window Configuration Options

```rust
// Desktop-specific configuration
window = window
  .title(config.title.to_string())
  .inner_size(config.width, config.height)
  .focused(config.focus)
  .focusable(config.focusable)
  .visible(config.visible)
  .resizable(config.resizable)
  .fullscreen(config.fullscreen)
  .decorations(config.decorations)
  .maximized(config.maximized)
  .always_on_bottom(config.always_on_bottom)
  .always_on_top(config.always_on_top)
  .visible_on_all_workspaces(config.visible_on_all_workspaces)
  .content_protected(config.content_protected)
  .skip_taskbar(config.skip_taskbar)
  .theme(config.theme)
  .closable(config.closable)
  .maximizable(config.maximizable)
  .minimizable(config.minimizable)
  .shadow(config.shadow);
```

---

## Platform-Specific Features

### macOS

- Default menu setup
- Title bar style configuration
- Hidden title option
- Tabbing identifier
- Traffic light position

```rust
#[cfg(target_os = "macos")]
{
  window = window
    .hidden_title(config.hidden_title)
    .title_bar_style(config.title_bar_style);

  if let Some(identifier) = &config.tabbing_identifier {
    window = window.tabbing_identifier(identifier);
  }

  if let Some(position) = &config.traffic_light_position {
    window = window.traffic_light_position(
      tauri_runtime::dpi::LogicalPosition::new(position.x, position.y)
    );
  }
}
```

### Windows

- Window classname configuration
- Shadow width calculations
- Background color support
- Transparent window support

```rust
#[cfg(windows)]
{
  builder = builder.window_classname("Tauri Window");
}
```

### Linux

- Mouse event configuration
- GTK app ID support

```rust
#[cfg(target_os = "linux")]
{
  // Mouse event is disabled on Linux since sudden event bursts could block event loop
  window.inner = window.inner.with_cursor_moved_event(false);
}
```

---

## Monitor & Display Management

```rust
// Get available monitors
fn available_monitors() -> Vec<MonitorHandleWrapper>

// Get cursor position
fn cursor_position() -> Result<PhysicalPosition<f64>>

// Set window theme
fn set_theme(theme: Option<Theme>)
```

---

## Build Configuration

### Embed Custom App Manifest for Windows

```rust
let mut windows_attrs = tauri_build::WindowsAttributes::new();
windows_attrs = windows_attrs.app_manifest(r#"
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
</assembly>
"#);

let attrs = tauri_build::Attributes::new().windows_attributes(windows_attrs);
tauri_build::try_build(attrs).expect("failed to run build script");
```

---

## Common Patterns

### Basic Application Setup

```rust
fn main() {
  tauri::Builder::default()
    .setup(|app| {
      // Your setup code here
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

### Creating Windows Programmatically

```rust
use tauri::Manager;

app.get_webview_window("main")
  .unwrap()
  .set_title("New Title")?;
```

### Managing Window State

```rust
// Prepare window before creation
let pending = manager.prepare_window(pending)?;

// Attach window after creation
let window = manager.attach_window(app_handle, detached_window, menu);
```

---

## Error Handling

Common error types:
- `Error::WindowLabelAlreadyExists` - Duplicate window labels
- `Error::CreateWindow` - Window creation failed
- `Error::Setup` - Setup hook returned error

---

## Best Practices

1. **Window Labels**: Ensure unique labels for all windows
2. **Setup Hook**: Use for one-time initialization only
3. **Icon Configuration**: Set default window icon in app manager
4. **Event Listeners**: Register before window creation
5. **Platform Detection**: Use conditional compilation for platform-specific code
6. **Resource Management**: Clean up resources in window event handlers

---

## Related Documentation

- Official Tauri Docs: https://tauri.app
- Tauri API Reference: https://docs.rs/tauri
- GitHub Repository: https://github.com/tauri-apps/tauri
