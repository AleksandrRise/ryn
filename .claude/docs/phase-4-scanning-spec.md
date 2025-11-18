# Phase 4: Scanning Engine - DETAILED SPECIFICATION

**Status**: NOT STARTED (Ready for implementation)
**Type**: Rust backend
**Estimated Lines of Code**: 1,500-2,000
**Estimated Tests**: 30+
**Branch**: `aleksandr/phase-4-scanning` (or equivalent)

## Overview

Phase 4 implements the real-time code scanning engine that:
1. **Detects frameworks** in projects (Django, Flask, Express, Next.js, React)
2. **Watches files** for changes in real-time
3. **Parses code** into AST using tree-sitter
4. **Provides input** to the fix generation system

## Detailed Specifications

### 1. Framework Detection Module
**File**: `src-tauri/src/scanner/framework_detector.rs`

#### Purpose
Identify the framework of a project by analyzing:
- File names and patterns
- Package manager files (package.json, requirements.txt)
- Source code imports/patterns

#### Function Signature
```rust
pub struct FrameworkDetector;

impl FrameworkDetector {
    /// Detect framework from project directory
    pub fn detect_framework(project_path: &Path) -> Result<Option<String>>

    /// Detect language from file extension
    pub fn detect_language(file_path: &Path) -> Option<String>
}
```

#### Detection Logic

**Django Detection** (Priority order):
```
1. File patterns:
   - manage.py exists
   - settings.py exists
   - models.py exists in app directories

2. package.json analysis:
   - "django" in dependencies
   - "Django" in install_requires

3. requirements.txt patterns:
   - "Django" or "django" in requirements

Result: framework = "django"
```

**Flask Detection**:
```
1. File patterns:
   - app.py exists
   - routes.py exists
   - templates/ directory exists

2. requirements.txt patterns:
   - "Flask" in requirements
   - "flask" in Pipfile

Result: framework = "flask"
```

**Express Detection**:
```
1. package.json analysis:
   - "express" in dependencies
   - "package.json" exists (Node.js indicator)

2. File patterns:
   - server.js or app.js exists
   - routes/ directory exists

Result: framework = "express"
```

**Next.js Detection**:
```
1. package.json analysis:
   - "next" in dependencies
   - "react" in dependencies

2. File patterns:
   - pages/ directory exists
   - app/ directory exists (Next.js 13+)

Result: framework = "nextjs"
```

**React Detection** (No Express/Next.js):
```
1. package.json analysis:
   - "react" in dependencies
   - "react-dom" in dependencies
   - No "next" (to exclude Next.js)

2. File patterns:
   - .jsx or .tsx files exist

Result: framework = "react"
```

#### Test Cases (10+)
```rust
#[test]
fn test_detect_django_with_manage_py() { }

#[test]
fn test_detect_django_from_requirements_txt() { }

#[test]
fn test_detect_flask_from_requirements() { }

#[test]
fn test_detect_express_from_package_json() { }

#[test]
fn test_detect_nextjs_from_package_json() { }

#[test]
fn test_detect_react_without_next() { }

#[test]
fn test_no_framework_detected() { }

#[test]
fn test_detect_language_from_extension() { }

#[test]
fn test_framework_detection_priority() { }

#[test]
fn test_error_on_missing_project() { }
```

---

### 2. File Watcher Module
**File**: `src-tauri/src/scanner/file_watcher.rs`

#### Purpose
Monitor project files for changes and emit events in real-time.

#### Dependencies
- `notify` crate (already in Cargo.toml)
- `async-channel` (already in Cargo.toml)
- `tokio` (already in Cargo.toml)

#### Struct Definition
```rust
pub struct FileWatcher {
    ignore_patterns: Vec<String>,
    extensions: Vec<String>,
}

pub enum FileEvent {
    FileModified { path: PathBuf },
    FileCreated { path: PathBuf },
    FileDeleted { path: PathBuf },
}

pub struct WatcherHandle {
    rx: async_channel::Receiver<FileEvent>,
    watcher_handle: JoinHandle<()>,
}
```

#### Function Signatures
```rust
impl FileWatcher {
    pub fn new() -> Self

    /// Ignore patterns like .git, __pycache__, node_modules
    pub fn with_ignore(mut self, patterns: Vec<String>) -> Self

    /// File extensions to watch: .py, .js, .ts, etc.
    pub fn with_extensions(mut self, extensions: Vec<String>) -> Self

    /// Start watching a directory
    pub async fn watch_directory(self, path: &Path) -> Result<WatcherHandle>
}

impl Default for FileWatcher {
    fn default() -> Self {
        Self {
            ignore_patterns: vec![
                ".git".to_string(),
                "__pycache__".to_string(),
                "node_modules".to_string(),
                ".pytest_cache".to_string(),
                ".venv".to_string(),
                "target".to_string(),
            ],
            extensions: vec![
                "py".to_string(),
                "js".to_string(),
                "jsx".to_string(),
                "ts".to_string(),
                "tsx".to_string(),
            ],
        }
    }
}
```

#### Implementation Details
```rust
pub async fn watch_directory(self, path: &Path) -> Result<WatcherHandle> {
    let (tx, rx) = async_channel::unbounded::<FileEvent>();

    let mut watcher = notify::recommended_watcher(move |res| {
        match res {
            Ok(notify::Event { kind, paths, .. }) => {
                match kind {
                    notify::EventKind::Modify(_) => {
                        for path in paths {
                            // Check if file should be watched
                            if self.should_watch(&path) {
                                let _ = tx.send_blocking(FileEvent::FileModified { path });
                            }
                        }
                    }
                    notify::EventKind::Create(_) => {
                        for path in paths {
                            if self.should_watch(&path) {
                                let _ = tx.send_blocking(FileEvent::FileCreated { path });
                            }
                        }
                    }
                    notify::EventKind::Remove(_) => {
                        for path in paths {
                            if self.should_watch(&path) {
                                let _ = tx.send_blocking(FileEvent::FileDeleted { path });
                            }
                        }
                    }
                    _ => {}
                }
            }
            Err(e) => eprintln!("Watch error: {}", e),
        }
    })?;

    watcher.watch(path, notify::RecursiveMode::Recursive)?;

    // Keep watcher alive in background
    let watcher_handle = tokio::spawn(async move {
        let _ = watcher; // Keep in scope
        std::future::pending().await
    });

    Ok(WatcherHandle { rx, watcher_handle })
}

fn should_watch(&self, path: &Path) -> bool {
    // Check if in ignore list
    for pattern in &self.ignore_patterns {
        if path.to_string_lossy().contains(pattern) {
            return false;
        }
    }

    // Check extension
    if let Some(ext) = path.extension() {
        if let Some(ext_str) = ext.to_str() {
            return self.extensions.contains(&ext_str.to_string());
        }
    }

    false
}
```

#### Test Cases (10+)
```rust
#[tokio::test]
async fn test_watch_file_creation() { }

#[tokio::test]
async fn test_watch_file_modification() { }

#[tokio::test]
async fn test_watch_file_deletion() { }

#[tokio::test]
async fn test_ignore_node_modules() { }

#[tokio::test]
async fn test_ignore_git_directory() { }

#[tokio::test]
async fn test_watch_python_files_only() { }

#[tokio::test]
async fn test_watch_javascript_files_only() { }

#[tokio::test]
async fn test_multiple_events() { }

#[tokio::test]
async fn test_watcher_cleanup() { }

#[tokio::test]
async fn test_file_watcher_default() { }
```

---

### 3. Tree-Sitter Utils Module
**File**: `src-tauri/src/scanner/tree_sitter_utils.rs`

#### Purpose
Parse code into Abstract Syntax Trees (AST) for semantic analysis.

#### Dependencies
- `tree-sitter` (already in Cargo.toml)
- `tree-sitter-python` (already in Cargo.toml)
- `tree-sitter-javascript` (already in Cargo.toml)
- `tree-sitter-typescript` (already in Cargo.toml)

#### Struct Definition
```rust
pub struct CodeParser {
    python_language: Language,
    javascript_language: Language,
    typescript_language: Language,
}

#[derive(Debug, Clone)]
pub struct ASTNode {
    pub kind: String,
    pub start_byte: usize,
    pub end_byte: usize,
    pub start_row: usize,
    pub end_row: usize,
    pub text: String,
}

#[derive(Debug)]
pub struct ParseResult {
    pub language: String,
    pub root: ASTNode,
    pub functions: Vec<ASTNode>,
    pub classes: Vec<ASTNode>,
    pub imports: Vec<ASTNode>,
}
```

#### Function Signatures
```rust
impl CodeParser {
    pub fn new() -> Result<Self>

    pub fn parse_python(&self, code: &str) -> Result<ParseResult>

    pub fn parse_javascript(&self, code: &str) -> Result<ParseResult>

    pub fn parse_typescript(&self, code: &str) -> Result<ParseResult>

    pub fn parse(&self, code: &str, language: &str) -> Result<ParseResult>
}
```

#### Implementation Example (Python)
```rust
pub fn parse_python(&self, code: &str) -> Result<ParseResult> {
    let mut parser = tree_sitter::Parser::new();
    parser.set_language(&self.python_language)
        .context("Failed to set Python language")?;

    let tree = parser.parse(code, None)
        .context("Failed to parse Python code")?;

    let root = tree.root_node();
    let mut functions = Vec::new();
    let mut classes = Vec::new();
    let mut imports = Vec::new();

    // Traverse AST
    let mut cursor = root.walk();

    loop {
        let node = cursor.node();

        match node.kind() {
            "function_definition" => {
                functions.push(self.node_to_ast(node, code)?);
            }
            "class_definition" => {
                classes.push(self.node_to_ast(node, code)?);
            }
            "import_statement" | "from_import_statement" => {
                imports.push(self.node_to_ast(node, code)?);
            }
            _ => {}
        }

        if !cursor.goto_first_child() {
            while !cursor.goto_next_sibling() {
                if !cursor.goto_parent() {
                    break;
                }
            }
        }
    }

    Ok(ParseResult {
        language: "python".to_string(),
        root: self.node_to_ast(root, code)?,
        functions,
        classes,
        imports,
    })
}

fn node_to_ast(&self, node: Node, code: &str) -> Result<ASTNode> {
    let text = node.utf8_text(code.as_bytes())?;

    Ok(ASTNode {
        kind: node.kind().to_string(),
        start_byte: node.start_byte(),
        end_byte: node.end_byte(),
        start_row: node.start_position().row,
        end_row: node.end_position().row,
        text: text.to_string(),
    })
}
```

#### Test Cases (10+)
```rust
#[test]
fn test_parse_python_function() { }

#[test]
fn test_parse_python_class() { }

#[test]
fn test_parse_python_imports() { }

#[test]
fn test_parse_javascript_function() { }

#[test]
fn test_parse_javascript_class() { }

#[test]
fn test_parse_typescript_types() { }

#[test]
fn test_parse_invalid_syntax() { }

#[test]
fn test_ast_node_positions() { }

#[test]
fn test_parse_large_file() { }

#[test]
fn test_parser_reuse() { }
```

---

### 4. Python Scanner Stub
**File**: `src-tauri/src/scanner/python_scanner.rs`

#### Purpose
Rule application for Python-specific checks (implemented in Phase 5).

#### Struct (Phase 4)
```rust
pub struct PythonScanner;

impl PythonScanner {
    pub fn scan(_code: &str) -> Result<Vec<Violation>> {
        // TODO: Phase 5 implementation
        Ok(Vec::new())
    }
}
```

---

### 5. JavaScript Scanner Stub
**File**: `src-tauri/src/scanner/javascript_scanner.rs`

#### Purpose
Rule application for JavaScript/TypeScript checks (implemented in Phase 5).

#### Struct (Phase 4)
```rust
pub struct JavaScriptScanner;

impl JavaScriptScanner {
    pub fn scan(_code: &str) -> Result<Vec<Violation>> {
        // TODO: Phase 5 implementation
        Ok(Vec::new())
    }
}
```

---

### 6. Scanner Module Organization
**File**: `src-tauri/src/scanner/mod.rs`

```rust
pub mod framework_detector;
pub mod file_watcher;
pub mod tree_sitter_utils;
pub mod python_scanner;
pub mod javascript_scanner;

pub use framework_detector::FrameworkDetector;
pub use file_watcher::{FileWatcher, FileEvent, WatcherHandle};
pub use tree_sitter_utils::{CodeParser, ParseResult, ASTNode};
pub use python_scanner::PythonScanner;
pub use javascript_scanner::JavaScriptScanner;
```

---

## Integration with Phase 3

### Input Data Flow
```
Project Directory
    ↓
FrameworkDetector::detect_framework()
    ↓ Returns: framework = "django" | "flask" | "express" | "nextjs"
    ↓
FileWatcher::watch_directory()
    ↓ Emits: FileEvent { FileModified, FileCreated, FileDeleted }
    ↓
CodeParser::parse()
    ↓ Returns: ParseResult with AST nodes
    ↓
Read file content → extract violations (Phase 5)
    ↓
Pass to Phase 3 Agent:
  runAgent({
    filePath,
    code,
    framework,      ← from FrameworkDetector
    violations: [], ← from Phase 5 rules
    fixes: [],
    currentStep: 'parse'
  })
    ↓
AgentResponse with generated fixes
```

---

## Build & Test Strategy

### Compilation
```bash
cd src-tauri
cargo check              # Verify compilation
cargo build              # Full build
```

### Testing
```bash
cargo test --lib scanner           # Run all scanner tests
cargo test --lib scanner -- --nocapture  # With output
```

### Expected Outcomes
- ✅ Framework detection for 5 frameworks (Django, Flask, Express, Next.js, React)
- ✅ File watching with ignore patterns
- ✅ AST parsing for Python, JavaScript, TypeScript
- ✅ 30+ tests, all passing
- ✅ Zero compilation warnings

---

## File Checklist

### Create These Files
- [ ] `src-tauri/src/scanner/framework_detector.rs` (~250 lines, 10+ tests)
- [ ] `src-tauri/src/scanner/file_watcher.rs` (~300 lines, 10+ tests)
- [ ] `src-tauri/src/scanner/tree_sitter_utils.rs` (~350 lines, 10+ tests)
- [ ] `src-tauri/src/scanner/python_scanner.rs` (~30 lines, stub)
- [ ] `src-tauri/src/scanner/javascript_scanner.rs` (~30 lines, stub)

### Update Files
- [ ] `src-tauri/src/scanner/mod.rs` (module exports)

### Verify
- [ ] `cargo build` succeeds
- [ ] `cargo test --lib scanner` passes 30+ tests
- [ ] No compilation warnings
- [ ] All files documented with comments

---

## Error Handling

All functions should return `Result<T>` with proper error context:

```rust
use anyhow::{Result, Context};

pub fn detect_framework(path: &Path) -> Result<Option<String>> {
    // ...
    .context("Failed to read package.json")?
}
```

---

## Documentation Requirements

- [ ] Module-level doc comments for each file
- [ ] Function-level JSDoc/doc comments
- [ ] Test descriptions explaining what's tested
- [ ] Error context messages

---

## Next Steps After Phase 4

Phase 5 will:
1. Use `FrameworkDetector` output to select rule engines
2. Use `CodeParser` AST to enhance violation detection
3. Implement `PythonScanner::scan()` and `JavaScriptScanner::scan()`
4. Integrate with Phase 3 agent for fix generation

Phase 8 will:
1. Create Tauri commands using `FileWatcher`
2. Real-time file monitoring
3. Auto-scanning on file changes

---

**Ready to implement. No dependencies on other phases. Can work in parallel with Phase 3 and Phase 5.**
