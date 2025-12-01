//! LSP Server Implementation
//!
//! Implements the Language Server Protocol for Ryn violations.

use std::sync::Arc;
use tokio::sync::Mutex;
use tower_lsp::jsonrpc::Result;
use tower_lsp::lsp_types::*;
use tower_lsp::{Client, LanguageServer};

use super::database::ViolationDatabase;
use super::diagnostics::violation_to_diagnostic;
use super::document_tracker::DocumentTracker;

/// The Ryn LSP server
pub struct RynLanguageServer {
    /// LSP client for sending notifications back to the IDE
    client: Client,
    /// Read-only database connection for fetching violations
    db: Arc<ViolationDatabase>,
    /// Tracks which documents are currently open
    documents: Arc<Mutex<DocumentTracker>>,
    /// The workspace root path (used to convert absolute URIs to relative paths)
    workspace_root: Arc<Mutex<Option<String>>>,
}

impl RynLanguageServer {
    pub fn new(client: Client, db: ViolationDatabase) -> Self {
        Self {
            client,
            db: Arc::new(db),
            documents: Arc::new(Mutex::new(DocumentTracker::new())),
            workspace_root: Arc::new(Mutex::new(None)),
        }
    }

    /// Convert an absolute file URI to a relative path for database queries
    fn uri_to_relative_path(&self, uri: &Url, workspace_root: &str) -> Option<String> {
        let file_path = uri.to_file_path().ok()?;
        let file_str = file_path.to_str()?;

        // Strip the workspace root prefix to get relative path
        if file_str.starts_with(workspace_root) {
            let relative = file_str
                .strip_prefix(workspace_root)?
                .trim_start_matches('/');
            Some(relative.to_string())
        } else {
            // File is outside workspace, use full path
            Some(file_str.to_string())
        }
    }

    /// Publish diagnostics for a single file
    async fn publish_diagnostics_for_file(&self, uri: Url) {
        let workspace_root = self.workspace_root.lock().await;
        let Some(root) = workspace_root.as_ref() else {
            return;
        };

        let Some(relative_path) = self.uri_to_relative_path(&uri, root) else {
            return;
        };

        // Fetch violations from database
        let violations = match self.db.get_violations_for_file(&relative_path) {
            Ok(v) => v,
            Err(e) => {
                self.client
                    .log_message(MessageType::ERROR, format!("Database error: {}", e))
                    .await;
                return;
            }
        };

        // Convert to LSP diagnostics
        let mut diagnostics = Vec::new();
        for violation in &violations {
            match violation_to_diagnostic(violation, &uri) {
                Ok(diag) => diagnostics.push(diag),
                Err(e) => {
                    self.client
                        .log_message(
                            MessageType::WARNING,
                            format!("Failed to convert violation: {}", e),
                        )
                        .await;
                }
            }
        }

        // Send diagnostics to the IDE
        self.client
            .publish_diagnostics(uri, diagnostics, None)
            .await;
    }

    /// Refresh diagnostics for all currently open documents
    #[allow(dead_code)]
    async fn refresh_all_diagnostics(&self) {
        let documents = self.documents.lock().await;
        let open_docs = documents.get_open_documents();
        drop(documents); // Release lock before async operations

        for uri in open_docs {
            self.publish_diagnostics_for_file(uri).await;
        }
    }
}

#[tower_lsp::async_trait]
impl LanguageServer for RynLanguageServer {
    async fn initialize(&self, params: InitializeParams) -> Result<InitializeResult> {
        // Store the workspace root for path conversion
        if let Some(root_uri) = params.root_uri {
            if let Ok(path) = root_uri.to_file_path() {
                if let Some(path_str) = path.to_str() {
                    let mut workspace_root = self.workspace_root.lock().await;
                    *workspace_root = Some(path_str.to_string());
                }
            }
        }

        Ok(InitializeResult {
            capabilities: ServerCapabilities {
                // We want to know when files are opened, closed, and saved
                text_document_sync: Some(TextDocumentSyncCapability::Options(
                    TextDocumentSyncOptions {
                        open_close: Some(true),
                        change: Some(TextDocumentSyncKind::NONE), // We don't need live changes
                        save: Some(TextDocumentSyncSaveOptions::SaveOptions(SaveOptions {
                            include_text: Some(false),
                        })),
                        ..Default::default()
                    },
                )),
                // Enable hover to show violation details
                hover_provider: Some(HoverProviderCapability::Simple(true)),
                ..Default::default()
            },
            server_info: Some(ServerInfo {
                name: "ryn-lsp".to_string(),
                version: Some(env!("CARGO_PKG_VERSION").to_string()),
            }),
        })
    }

    async fn initialized(&self, _: InitializedParams) {
        self.client
            .log_message(MessageType::INFO, "Ryn LSP server initialized")
            .await;
    }

    async fn shutdown(&self) -> Result<()> {
        Ok(())
    }

    async fn did_open(&self, params: DidOpenTextDocumentParams) {
        let uri = params.text_document.uri;
        let text = params.text_document.text;

        // Track the document
        {
            let mut documents = self.documents.lock().await;
            documents.open(uri.clone(), text);
        }

        // Publish diagnostics for this file
        self.publish_diagnostics_for_file(uri).await;
    }

    async fn did_close(&self, params: DidCloseTextDocumentParams) {
        let uri = params.text_document.uri;

        // Stop tracking the document
        {
            let mut documents = self.documents.lock().await;
            documents.close(&uri);
        }

        // Clear diagnostics for closed file
        self.client.publish_diagnostics(uri, vec![], None).await;
    }

    async fn did_change(&self, _params: DidChangeTextDocumentParams) {
        // We don't need to handle changes since we re-scan on save
        // and violations come from the database, not live analysis
    }

    async fn did_save(&self, params: DidSaveTextDocumentParams) {
        // Re-publish diagnostics after save (in case violations changed)
        self.publish_diagnostics_for_file(params.text_document.uri).await;
    }

    async fn hover(&self, params: HoverParams) -> Result<Option<Hover>> {
        let uri = params.text_document_position_params.text_document.uri;
        let position = params.text_document_position_params.position;

        let workspace_root = self.workspace_root.lock().await;
        let Some(root) = workspace_root.as_ref() else {
            return Ok(None);
        };

        let Some(relative_path) = self.uri_to_relative_path(&uri, root) else {
            return Ok(None);
        };

        // Get violations for this file
        let violations = match self.db.get_violations_for_file(&relative_path) {
            Ok(v) => v,
            Err(_) => return Ok(None),
        };

        // Find a violation on the hovered line (LSP is 0-indexed, violations are 1-indexed)
        let hover_line = (position.line + 1) as i64;
        let violation = violations.iter().find(|v| v.line_number == hover_line);

        let Some(violation) = violation else {
            return Ok(None);
        };

        // Build hover content
        let mut content = format!(
            "**{}** ({})\n\n{}\n",
            violation.control_id, violation.severity, violation.description
        );

        // Add reasoning if available
        if let Some(reasoning) = &violation.llm_reasoning {
            content.push_str(&format!("\n---\n\n*{}*", reasoning));
        } else if let Some(reasoning) = &violation.regex_reasoning {
            content.push_str(&format!("\n---\n\n*{}*", reasoning));
        }

        Ok(Some(Hover {
            contents: HoverContents::Markup(MarkupContent {
                kind: MarkupKind::Markdown,
                value: content,
            }),
            range: None,
        }))
    }
}
