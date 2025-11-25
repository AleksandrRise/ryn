//! GitHub Integration Module
//!
//! This module provides GitHub OAuth authentication and API client functionality
//! for the Ryn SOC 2 compliance tool.
//!
//! ## Features
//! - GitHub App Device Flow authentication
//! - Repository listing and caching
//! - Repository tracking for compliance monitoring

pub mod client;

pub use client::GitHubClient;
