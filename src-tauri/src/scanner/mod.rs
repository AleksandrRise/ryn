//! Code scanning engine for SOC 2 compliance
//!
//! Provides framework detection, file watching, and AST parsing.

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
