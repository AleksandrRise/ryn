//! LSP Server Module
//!
//! Provides an embedded Language Server Protocol (LSP) server that exposes
//! Ryn's SOC 2 violations as IDE diagnostics. Run with `ryn --lsp`.

mod backend;
mod database;
mod diagnostics;
mod document_tracker;
mod server;

pub use backend::start_lsp_server;
