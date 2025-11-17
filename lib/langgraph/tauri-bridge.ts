/**
 * Tauri Bridge for LangGraph Agent
 *
 * This module establishes the communication bridge between the Rust backend and TypeScript LangGraph agent.
 * It listens for run-agent-request events from Rust, processes them through the agent, and sends
 * results back via the run_agent_response command.
 *
 * Flow:
 * 1. Rust emits "run-agent-request" event with request_id and agent request payload
 * 2. This bridge receives the event and calls the TypeScript agent
 * 3. Agent processes the request and returns AgentResponse
 * 4. Bridge invokes run_agent_response command with the response and request_id
 * 5. Rust receives the response via the oneshot channel
 */

'use client'

import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { runAgent } from './agent'
import type { AgentResponse } from './types'

/**
 * Event payload received from Rust when the agent is requested
 */
interface RunAgentRequestEvent {
  request_id: string
  request: {
    file_path: string
    code: string
    framework: string
    violations: Array<{
      control_id: string
      severity: string
      description: string
      file_path: string
      line_number: number
      code_snippet: string
    }>
  }
}

/**
 * Initialize the Tauri bridge listener
 *
 * This function sets up the event listener for run-agent-request events.
 * It should be called once during app initialization (typically in app/layout.tsx).
 *
 * @returns Function to stop listening (for cleanup)
 */
export async function initializeLangGraphBridge(): Promise<UnlistenFn> {
  console.log('[LangGraph Bridge] Initializing...')

  const unlistener = await listen<RunAgentRequestEvent>(
    'run-agent-request',
    async (event) => {
      await handleAgentRequest(event.payload)
    }
  )

  console.log('[LangGraph Bridge] Initialized and listening for events')
  return unlistener
}

/**
 * Handle incoming agent request from Rust
 *
 * This function:
 * 1. Extracts the request payload
 * 2. Converts Rust violation format to agent violation format
 * 3. Calls the TypeScript agent
 * 4. Sends the response back to Rust via run_agent_response command
 *
 * @param payload Event payload containing request_id and request data
 */
async function handleAgentRequest(payload: RunAgentRequestEvent): Promise<void> {
  const { request_id, request } = payload

  console.log(`[LangGraph Bridge] Received agent request: ${request_id}`)
  console.log(`[LangGraph Bridge] File: ${request.file_path}, Framework: ${request.framework}`)

  try {
    // Call the TypeScript agent with the request data
    const response: AgentResponse = await runAgent({
      filePath: request.file_path,
      code: request.code,
      framework: request.framework as any,
      violations: request.violations as any, // Convert Rust format to agent format
      fixes: [],
      currentStep: 'parse',
      error: undefined,
      timestamp: new Date().toISOString(),
    })

    console.log(
      `[LangGraph Bridge] Agent completed for request ${request_id}: ` +
        `violations=${response.violations.length}, fixes=${response.fixes.length}`
    )

    // Send the response back to Rust
    await sendAgentResponse(request_id, response)
  } catch (error) {
    console.error(`[LangGraph Bridge] Error processing request ${request_id}:`, error)

    // Send error response back to Rust
    const errorResponse: AgentResponse = {
      state: {
        filePath: request.file_path,
        code: request.code,
        framework: request.framework as any,
        violations: [],
        fixes: [],
        currentStep: 'parse',
        error: error instanceof Error ? error.message : 'Unknown error occurred in agent',
        timestamp: new Date().toISOString(),
      },
      success: false,
      violations: [],
      fixes: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred in agent',
    }

    await sendAgentResponse(request_id, errorResponse)
  }
}

/**
 * Send agent response back to Rust via Tauri command
 *
 * This invokes the run_agent_response command in the Rust backend,
 * which will dispatch the response to the waiting oneshot receiver.
 *
 * @param request_id ID of the request to respond to
 * @param response Agent response to send
 */
async function sendAgentResponse(request_id: string, response: AgentResponse): Promise<void> {
  try {
    console.log(`[LangGraph Bridge] Sending response for request ${request_id}`)

    // Convert agent response format to Rust-compatible format (snake_case for Rust)
    const rustResponse = {
      success: response.success ?? (response.error ? false : true),
      violations: response.violations || [],
      fixes: response.fixes || [],
      current_step: response.state?.currentStep || 'complete',
      error: response.error || undefined,
    }

    // Invoke the Rust command
    await invoke('run_agent_response', {
      request_id,
      response: rustResponse,
    })

    console.log(`[LangGraph Bridge] Response sent successfully for request ${request_id}`)
  } catch (error) {
    console.error(
      `[LangGraph Bridge] Failed to send response for request ${request_id}:`,
      error
    )
    throw error
  }
}
