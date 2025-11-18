/**
 * Direct Claude AI Agent for SOC 2 Fix Generation
 *
 * This module provides direct integration with Claude via langchain-rust,
 * eliminating the need for cross-language TypeScript bridge.
 */

pub mod agent_runner;

pub use agent_runner::{AgentRunner, AgentRunnerConfig, AgentResponse, AgentViolation, AgentFix};
pub use agent_runner::{violation_to_agent, agent_to_fix};
