//! LSP Server Module
//!
//! Provides an embedded Language Server Protocol (LSP) server that exposes
//! Ryn's SOC 2 violations as IDE diagnostics.
//!
//! ## Modes
//! - **stdio mode**: `ryn --lsp` (IDE spawns process, communicates via stdin/stdout)
//! - **TCP mode**: `ryn --lsp --tcp --port 9257` (GUI spawns process, IDEs connect via TCP)

mod backend;
mod database;
mod diagnostics;
mod document_tracker;
mod server;

pub use backend::{start_lsp_server, start_lsp_server_tcp};
