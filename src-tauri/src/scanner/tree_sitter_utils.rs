//! Tree-Sitter AST parsing utilities
//!
//! Parses code into Abstract Syntax Trees (AST) for semantic analysis.
//! Supports Python, JavaScript, and TypeScript.

use anyhow::{Context, Result};
use std::str::Utf8Error;
use tree_sitter::{Language, Node, Parser};

/// AST node representation
#[derive(Debug, Clone)]
pub struct ASTNode {
    /// Node kind (e.g., "function_definition", "class_definition")
    pub kind: String,
    /// Byte offset start
    pub start_byte: usize,
    /// Byte offset end
    pub end_byte: usize,
    /// Starting row (0-indexed)
    pub start_row: usize,
    /// Ending row (0-indexed)
    pub end_row: usize,
    /// Text content of the node
    pub text: String,
}

/// Parse result containing extracted AST information
#[derive(Debug)]
pub struct ParseResult {
    /// Language that was parsed
    pub language: String,
    /// Root node of the AST
    pub root: ASTNode,
    /// Extracted function definitions
    pub functions: Vec<ASTNode>,
    /// Extracted class definitions
    pub classes: Vec<ASTNode>,
    /// Extracted import statements
    pub imports: Vec<ASTNode>,
}

/// Code parser for multiple languages
pub struct CodeParser {
    python_language: Language,
    javascript_language: Language,
    typescript_language: Language,
}

impl CodeParser {
    /// Create a new CodeParser
    ///
    /// # Returns
    /// * `Ok(CodeParser)` with languages initialized
    /// * `Err(...)` if language initialization fails
    pub fn new() -> Result<Self> {
        Ok(Self {
            python_language: tree_sitter_python::language(),
            javascript_language: tree_sitter_javascript::language(),
            typescript_language: tree_sitter_typescript::language_typescript(),
        })
    }

    /// Parse Python code
    ///
    /// # Arguments
    /// * `code` - Python source code to parse
    ///
    /// # Returns
    /// * `Ok(ParseResult)` containing AST information
    /// * `Err(...)` if parsing fails
    pub fn parse_python(&self, code: &str) -> Result<ParseResult> {
        self.parse_internal(code, "python", &self.python_language)
    }

    /// Parse JavaScript code
    ///
    /// # Arguments
    /// * `code` - JavaScript source code to parse
    ///
    /// # Returns
    /// * `Ok(ParseResult)` containing AST information
    /// * `Err(...)` if parsing fails
    pub fn parse_javascript(&self, code: &str) -> Result<ParseResult> {
        self.parse_internal(code, "javascript", &self.javascript_language)
    }

    /// Parse TypeScript code
    ///
    /// # Arguments
    /// * `code` - TypeScript source code to parse
    ///
    /// # Returns
    /// * `Ok(ParseResult)` containing AST information
    /// * `Err(...)` if parsing fails
    pub fn parse_typescript(&self, code: &str) -> Result<ParseResult> {
        self.parse_internal(code, "typescript", &self.typescript_language)
    }

    /// Parse code with specified language
    ///
    /// # Arguments
    /// * `code` - Source code to parse
    /// * `language_name` - Name of the language ("python", "javascript", "typescript")
    /// * `language` - Tree-sitter language object
    ///
    /// # Returns
    /// * `Ok(ParseResult)` containing AST information
    /// * `Err(...)` if parsing fails
    fn parse_internal(
        &self,
        code: &str,
        language_name: &str,
        language: &Language,
    ) -> Result<ParseResult> {
        let mut parser = Parser::new();
        parser
            .set_language(&language)
            .context(format!("Failed to set {} language", language_name))?;

        let tree = parser
            .parse(code, None)
            .context(format!("Failed to parse {} code", language_name))?;

        let root = tree.root_node();
        let mut functions = Vec::new();
        let mut classes = Vec::new();
        let mut imports = Vec::new();

        // Traverse AST recursively
        Self::traverse_node(root, code, &mut functions, &mut classes, &mut imports)?;

        Ok(ParseResult {
            language: language_name.to_string(),
            root: Self::node_to_ast(root, code)?,
            functions,
            classes,
            imports,
        })
    }

    /// Recursively traverse AST nodes
    fn traverse_node(
        node: Node,
        code: &str,
        functions: &mut Vec<ASTNode>,
        classes: &mut Vec<ASTNode>,
        imports: &mut Vec<ASTNode>,
    ) -> Result<()> {
        match node.kind() {
            "function_definition" | "function_declaration" => {
                functions.push(Self::node_to_ast(node, code)?);
            }
            "class_definition" | "class_declaration" => {
                classes.push(Self::node_to_ast(node, code)?);
            }
            "import_statement"
            | "from_import_statement"
            | "import_declaration"
            | "import_specifier" => {
                imports.push(Self::node_to_ast(node, code)?);
            }
            _ => {}
        }

        // Traverse children
        for i in 0..node.child_count() {
            if let Some(child) = node.child(i) {
                Self::traverse_node(child, code, functions, classes, imports)?;
            }
        }

        Ok(())
    }

    /// Convert a tree-sitter Node to ASTNode
    fn node_to_ast(node: Node, code: &str) -> Result<ASTNode> {
        let text = Self::get_node_text(node, code)?;

        Ok(ASTNode {
            kind: node.kind().to_string(),
            start_byte: node.start_byte(),
            end_byte: node.end_byte(),
            start_row: node.start_position().row,
            end_row: node.end_position().row,
            text,
        })
    }

    /// Extract text from a tree-sitter Node
    fn get_node_text(node: Node, code: &str) -> Result<String, Utf8Error> {
        Ok(node.utf8_text(code.as_bytes())?.to_string())
    }
}

impl Default for CodeParser {
    fn default() -> Self {
        Self::new().expect("Failed to initialize CodeParser")
    }
}

/// Find function and class context for a specific line number
///
/// # Arguments
/// * `parse_result` - The ParseResult from parsing the code
/// * `line_number` - The line number to find context for (1-indexed, as used in violations)
///
/// # Returns
/// * `(Option<String>, Option<String>)` - (function_name, class_name)
///
/// # Example
/// ```
/// let parser = CodeParser::new()?;
/// let result = parser.parse_python(code)?;
/// let (func_name, class_name) = find_context_at_line(&result, 10);
/// ```
pub fn find_context_at_line(
    parse_result: &ParseResult,
    line_number: i64,
) -> (Option<String>, Option<String>) {
    let target_row = (line_number - 1) as usize; // Convert to 0-indexed

    // Find containing function
    let function_name = parse_result.functions.iter()
        .find(|node| node.start_row <= target_row && target_row <= node.end_row)
        .and_then(|node| extract_name_from_definition(&node.text));

    // Find containing class
    let class_name = parse_result.classes.iter()
        .find(|node| node.start_row <= target_row && target_row <= node.end_row)
        .and_then(|node| extract_name_from_definition(&node.text));

    (function_name, class_name)
}

/// Extract name from function/class definition text
///
/// Examples:
/// - "def my_function():" -> Some("my_function")
/// - "class MyClass:" -> Some("MyClass")
/// - "function myFunc() {" -> Some("myFunc")
/// - "class MyClass {" -> Some("MyClass")
fn extract_name_from_definition(text: &str) -> Option<String> {
    let trimmed = text.trim();

    // Python function: "def func_name(...)"
    if trimmed.starts_with("def ") {
        return trimmed
            .strip_prefix("def ")?
            .split('(')
            .next()
            .map(|s| s.trim().to_string());
    }

    // Python class: "class ClassName(...)" or "class ClassName:"
    if trimmed.starts_with("class ") {
        return trimmed
            .strip_prefix("class ")?
            .split(|c: char| c == '(' || c == ':')
            .next()
            .map(|s| s.trim().to_string());
    }

    // JavaScript/TypeScript function: "function funcName(...)" or "async function funcName(...)"
    if trimmed.contains("function ") {
        let after_function = trimmed.split("function ").nth(1)?;
        return after_function
            .split('(')
            .next()
            .map(|s| s.trim().to_string());
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_python_function() {
        let parser = CodeParser::new().expect("Failed to create parser");
        let code = r#"
def hello_world():
    print("Hello, World!")
"#;

        let result = parser.parse_python(code).expect("Failed to parse");
        assert_eq!(result.language, "python");
        assert!(!result.functions.is_empty());
        assert!(result.functions[0].text.contains("def hello_world"));
    }

    #[test]
    fn test_parse_python_class() {
        let parser = CodeParser::new().expect("Failed to create parser");
        let code = r#"
class MyClass:
    def __init__(self):
        pass
"#;

        let result = parser.parse_python(code).expect("Failed to parse");
        assert_eq!(result.language, "python");
        assert!(!result.classes.is_empty());
        assert!(result.classes[0].text.contains("class MyClass"));
    }

    #[test]
    fn test_parse_python_imports() {
        let parser = CodeParser::new().expect("Failed to create parser");
        let code = r#"
import os
from pathlib import Path
import sys as system
"#;

        let result = parser.parse_python(code).expect("Failed to parse");
        assert_eq!(result.language, "python");
        assert!(!result.imports.is_empty());
    }

    #[test]
    fn test_parse_javascript_function() {
        let parser = CodeParser::new().expect("Failed to create parser");
        let code = r#"
function helloWorld() {
    console.log("Hello, World!");
}
"#;

        let result = parser.parse_javascript(code).expect("Failed to parse");
        assert_eq!(result.language, "javascript");
        assert!(!result.functions.is_empty());
    }

    #[test]
    fn test_parse_javascript_class() {
        let parser = CodeParser::new().expect("Failed to create parser");
        let code = r#"
class MyClass {
    constructor() {
        this.value = 0;
    }
}
"#;

        let result = parser.parse_javascript(code).expect("Failed to parse");
        assert_eq!(result.language, "javascript");
        assert!(!result.classes.is_empty());
    }

    #[test]
    fn test_parse_javascript_imports() {
        let parser = CodeParser::new().expect("Failed to create parser");
        let code = r#"
import React from 'react';
import { useState } from 'react';
const fs = require('fs');
"#;

        let result = parser.parse_javascript(code).expect("Failed to parse");
        assert_eq!(result.language, "javascript");
        assert!(!result.imports.is_empty());
    }

    #[test]
    fn test_parse_typescript_function() {
        let parser = CodeParser::new().expect("Failed to create parser");
        let code = r#"
function add(a: number, b: number): number {
    return a + b;
}
"#;

        let result = parser.parse_typescript(code).expect("Failed to parse");
        assert_eq!(result.language, "typescript");
        assert!(!result.functions.is_empty());
    }

    #[test]
    fn test_parse_typescript_types() {
        let parser = CodeParser::new().expect("Failed to create parser");
        let code = r#"
interface User {
    name: string;
    age: number;
}

type Status = 'active' | 'inactive';
"#;

        let result = parser.parse_typescript(code).expect("Failed to parse");
        assert_eq!(result.language, "typescript");
    }

    #[test]
    fn test_parse_invalid_syntax() {
        let parser = CodeParser::new().expect("Failed to create parser");
        let code = "this is not valid python or javascript @#$%";

        // Parser should handle invalid syntax gracefully
        // Tree-sitter is forgiving and will still produce a tree
        let result = parser.parse_python(code);
        assert!(result.is_ok()); // Should not error, tree-sitter is forgiving
    }

    #[test]
    fn test_ast_node_positions() {
        let parser = CodeParser::new().expect("Failed to create parser");
        let code = "def test():\n    pass\n";

        let result = parser.parse_python(code).expect("Failed to parse");
        assert!(!result.functions.is_empty());

        let func = &result.functions[0];
        assert!(func.start_byte < func.end_byte);
        assert!(func.start_row <= func.end_row);
    }

    #[test]
    fn test_parse_large_file() {
        let parser = CodeParser::new().expect("Failed to create parser");

        // Create a larger Python file with multiple functions
        let mut code = String::new();
        for i in 0..100 {
            code.push_str(&format!(
                r#"
def function_{}():
    x = {}
    return x
"#,
                i, i
            ));
        }

        let result = parser.parse_python(&code).expect("Failed to parse");
        assert_eq!(result.language, "python");
        assert!(result.functions.len() >= 100);
    }

    #[test]
    fn test_parser_reuse() {
        let parser = CodeParser::new().expect("Failed to create parser");

        // Parse multiple files with the same parser
        let py_code = "def foo(): pass";
        let js_code = "function bar() {}";
        let ts_code = "function baz(): void {}";

        let py_result = parser.parse_python(py_code).expect("Failed to parse Python");
        let js_result = parser.parse_javascript(js_code).expect("Failed to parse JavaScript");
        let ts_result = parser.parse_typescript(ts_code).expect("Failed to parse TypeScript");

        assert_eq!(py_result.language, "python");
        assert_eq!(js_result.language, "javascript");
        assert_eq!(ts_result.language, "typescript");
    }

    #[test]
    fn test_parser_default() {
        let parser = CodeParser::default();
        let code = "def test(): pass";
        let result = parser.parse_python(code);
        assert!(result.is_ok());
    }

    #[test]
    fn test_extract_multiple_functions() {
        let parser = CodeParser::new().expect("Failed to create parser");
        let code = r#"
def foo():
    pass

def bar():
    pass

def baz():
    pass
"#;

        let result = parser.parse_python(code).expect("Failed to parse");
        assert!(result.functions.len() >= 3);
    }
}
