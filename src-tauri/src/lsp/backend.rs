//! LSP Backend
//!
//! Entry point for the LSP server. Handles stdin/stdout or TCP communication.

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

/// Start the LSP server using TCP for communication
///
/// This allows the GUI to spawn the LSP and have IDEs connect via TCP.
/// The server listens on the specified port and accepts a single connection.
///
/// # Arguments
/// * `db_path` - Path to the Ryn SQLite database
/// * `port` - TCP port to listen on (e.g., 9257)
///
/// # Example
/// ```ignore
/// start_lsp_server_tcp(PathBuf::from("~/.local/share/ryn/ryn.db"), 9257).await?;
/// ```
pub async fn start_lsp_server_tcp(db_path: PathBuf, port: u16) -> anyhow::Result<()> {
    use tokio::net::TcpListener;

    // Create the database connection
    let db = ViolationDatabase::new(db_path);

    // Bind to the TCP port
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port)).await?;
    eprintln!("[ryn-lsp] Listening on 127.0.0.1:{}", port);

    // Accept a single connection (LSP is 1:1 with client)
    let (stream, addr) = listener.accept().await?;
    eprintln!("[ryn-lsp] Client connected from {}", addr);

    // Split the TCP stream into read and write halves
    let (read, write) = tokio::io::split(stream);
    let read = tokio::io::BufReader::new(read);

    // Create the LSP service
    let (service, socket) = LspService::new(|client| RynLanguageServer::new(client, db));

    // Run the server
    Server::new(read, write, socket).serve(service).await;

    Ok(())
}
