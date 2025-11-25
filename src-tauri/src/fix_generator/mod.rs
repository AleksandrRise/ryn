//! Fix generation module with AI integration
//!
//! Provides production-ready Grok Code Fast 1 client for generating SOC 2 compliance fixes
//! and applying them to files on disk.

pub mod fix_applicator;
pub mod grok_client;

pub use fix_applicator::FixApplicator;
pub use grok_client::{
    AnalysisResult, GrokClient, GrokRequest, GrokResponse, Message, UsageMetrics,
};
