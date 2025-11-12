//! Fix generation module with Claude AI integration
//!
//! Provides production-ready Claude Haiku 4.5 client for generating SOC 2 compliance fixes.

pub mod claude_client;

pub use claude_client::{
    ClaudeClient, ClaudeRequest, ClaudeResponse, ContentBlock, Message, SystemBlock,
    CacheControl, UsageMetrics,
};
