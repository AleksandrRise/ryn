//! Code scanning engine for SOC 2 compliance
//!
//! Provides framework detection, file watching, and AST parsing.

pub mod constants;
pub mod framework_detector;
pub mod file_watcher;
pub mod tree_sitter_utils;
pub mod llm_file_selector;

pub use constants::SKIP_DIRECTORIES;
pub use framework_detector::FrameworkDetector;
pub use file_watcher::{FileWatcher, FileEvent, WatcherHandle};
pub use tree_sitter_utils::{CodeParser, ParseResult, ASTNode};
