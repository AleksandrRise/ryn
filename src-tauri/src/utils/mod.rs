//! Utility functions for the Ryn backend
//!
//! Provides environment variable handling, validation, and other common utilities.

pub mod audit;
pub mod code_context;
pub mod env;

pub use audit::create_audit_event;
pub use code_context::{
    extract_code_block_plain, extract_code_block_with_context, extract_context_from_string,
};
pub use env::{get_and_validate_api_key, get_xai_key, load_env, validate_api_key};
