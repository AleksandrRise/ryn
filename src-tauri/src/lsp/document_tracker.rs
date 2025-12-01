//! Document Tracker
//!
//! Tracks which files are currently open in the IDE.

use std::collections::HashMap;
use tower_lsp::lsp_types::Url;

/// Tracks open documents in the IDE
#[derive(Debug, Default)]
pub struct DocumentTracker {
    open_documents: HashMap<Url, String>,
}

impl DocumentTracker {
    pub fn new() -> Self {
        Self::default()
    }

    /// Mark a document as open with its content
    pub fn open(&mut self, uri: Url, text: String) {
        self.open_documents.insert(uri, text);
    }

    /// Mark a document as closed
    pub fn close(&mut self, uri: &Url) {
        self.open_documents.remove(uri);
    }

    /// Check if a document is open
    #[allow(dead_code)]
    pub fn is_open(&self, uri: &Url) -> bool {
        self.open_documents.contains_key(uri)
    }

    /// Get all currently open document URIs
    pub fn get_open_documents(&self) -> Vec<Url> {
        self.open_documents.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_and_close() {
        let mut tracker = DocumentTracker::new();
        let uri = Url::parse("file:///test.py").unwrap();

        assert!(!tracker.is_open(&uri));

        tracker.open(uri.clone(), "content".to_string());
        assert!(tracker.is_open(&uri));

        tracker.close(&uri);
        assert!(!tracker.is_open(&uri));
    }

    #[test]
    fn test_get_open_documents() {
        let mut tracker = DocumentTracker::new();
        let uri1 = Url::parse("file:///test1.py").unwrap();
        let uri2 = Url::parse("file:///test2.py").unwrap();

        tracker.open(uri1.clone(), "content1".to_string());
        tracker.open(uri2.clone(), "content2".to_string());

        let docs = tracker.get_open_documents();
        assert_eq!(docs.len(), 2);
        assert!(docs.contains(&uri1));
        assert!(docs.contains(&uri2));
    }
}
