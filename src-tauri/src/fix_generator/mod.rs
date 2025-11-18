//! Fix generation module with AI integration
//!
//! Provides production-ready Grok Code Fast 1 client for generating SOC 2 compliance fixes
//! and applying them to files on disk.

pub mod grok_client;
pub mod fix_applicator;

pub use grok_client::{
    GrokClient, GrokRequest, GrokResponse, Message, UsageMetrics, AnalysisResult,
};
pub use fix_applicator::FixApplicator;
