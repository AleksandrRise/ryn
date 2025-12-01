//! LSP Backend
//!
//! Entry point for the LSP server. Handles stdin/stdout communication.

use std::path::PathBuf;
use tokio::io::{stdin, stdout, BufReader};
use tower_lsp::{LspService, Server};

use super::database::ViolationDatabase;
use super::server::RynLanguageServer;

/// Start the LSP server using stdin/stdout for communication
///
/// This function blocks until the LSP client disconnects.
///
/// # Arguments
/// * `db_path` - Path to the Ryn SQLite database
///
/// # Example
/// ```ignore
/// start_lsp_server(PathBuf::from("~/.local/share/ryn/ryn.db")).await?;
/// ```
pub async fn start_lsp_server(db_path: PathBuf) -> anyhow::Result<()> {
    // Create the database connection
    let db = ViolationDatabase::new(db_path);

    // Create the LSP service
    let (service, socket) = LspService::new(|client| RynLanguageServer::new(client, db));

    // Run the server with stdin/stdout
    let stdin = BufReader::new(stdin());
    let stdout = stdout();

    Server::new(stdin, stdout, socket).serve(service).await;

    Ok(())
}
