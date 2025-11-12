/**
 * LangGraph Agent Orchestration Bridge
 *
 * This module provides the Rust-side implementation of the LangGraph agent system.
 * It communicates with the TypeScript LangGraph state machine running in Tauri.
 */

pub mod agent_runner;

pub use agent_runner::{AgentRunner, AgentRunnerConfig, AgentRequest, AgentResponse, AgentViolation, AgentFix};
pub use agent_runner::{violation_to_agent, agent_to_violation, agent_to_fix};
