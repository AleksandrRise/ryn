/**
 * LangGraph Agent Type Definitions
 *
 * Defines all TypeScript interfaces for the SOC 2 compliance agent state machine.
 * These types are used in both the TypeScript agent and Rust-TypeScript bridge.
 */

/**
 * Step identifier for agent state machine
 * Represents the current stage of processing
 */
export type AgentStep = 'parse' | 'analyzed' | 'fixes_generated' | 'validated'

/**
 * SOC 2 Control identifier
 */
export type ControlId = 'CC6.1' | 'CC6.7' | 'CC7.2' | 'A1.2'

/**
 * Application framework type
 */
export type Framework = 'django' | 'flask' | 'express' | 'nextjs' | 'react' | 'unknown'

/**
 * Violation detected by static analysis or LLM
 */
export interface Violation {
  id?: string
  controlId: ControlId
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  filePath: string
  lineNumber: number
  codeSnippet: string
  detectedAt?: string
}

/**
 * AI-generated fix for a violation
 */
export interface Fix {
  id?: string
  violationId?: string
  originalCode: string
  fixedCode: string
  explanation: string
  trustLevel: 'auto' | 'review' | 'manual'
  appliedAt?: string
  gitCommitSha?: string
}

/**
 * Agent state annotation
 * Represents the complete state of the agent processing pipeline
 */
export interface AgentState {
  filePath: string
  code: string
  framework: Framework
  violations: Violation[]
  fixes: Fix[]
  currentStep: AgentStep
  error?: string
  timestamp?: string
}

/**
 * Agent response returned from graph compilation
 */
export interface AgentResponse {
  state: AgentState
  success: boolean
  violations: Violation[]
  fixes: Fix[]
  error?: string
}

/**
 * Configuration for the agent
 */
export interface AgentConfig {
  maxTokens: number
  modelName: string
  temperature: number
}

/**
 * Node input/output interface
 */
export interface NodeInput extends AgentState {}
export interface NodeOutput extends Partial<AgentState> {}

/**
 * Prompt template context
 */
export interface PromptContext {
  code: string
  framework: Framework
  violations: Violation[]
  controlId: ControlId
}
