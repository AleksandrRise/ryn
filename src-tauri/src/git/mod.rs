//! Git operations for fix application and version control
//!
//! Provides functionality for:
//! - Committing fixes to git repositories
//! - Checking repository status
//! - Managing branches and commits
//! - Tracking file changes

pub mod operations;

pub use operations::{GitOperations, CommitInfo};
