//! Code scanning engine for SOC 2 compliance
//!
//! Provides framework detection and AST parsing.

pub mod constants;
pub mod file_hasher;
pub mod framework_detector;
pub mod llm_file_selector;
pub mod tree_sitter_utils;

pub use constants::SKIP_DIRECTORIES;
pub use file_hasher::compute_hash;
pub use framework_detector::FrameworkDetector;
pub use tree_sitter_utils::{ASTNode, CodeParser, ParseResult};
