// Tauri IPC Commands - Frontend to Backend Communication
// Real implementations using Tauri's invoke API

import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Project {
  id: number
  name: string
  path: string
  framework?: string
  created_at?: string
}

export interface ScanResult {
  id: number
  project_id: number
  status: string
  started_at: string
  completed_at?: string
  created_at?: string
  files_scanned: number
  total_files: number
  violations_found: number
  scan_mode: string
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
}

export interface Violation {
  id: number
  scan_id: number
  control_id: string
  severity: "critical" | "high" | "medium" | "low"
  description: string
  code_snippet: string
  line_number: number
  file_path: string
  status: string
  created_at: string
  detection_method: "regex" | "llm" | "hybrid"
  confidence_score?: number
  llm_reasoning?: string
  regex_reasoning?: string
}

export interface Fix {
  id: number
  violation_id: number
  original_code: string
  fixed_code: string
  explanation: string
  trust_level: "auto" | "manual" | "review"
  applied_at: string | null
  applied_by: string
  git_commit_sha: string | null
}

export interface Control {
  id: string
  name: string
  description: string
  requirement: string
  category: string
}

export interface ViolationDetail {
  violation: Violation
  control: Control | null
  fix: Fix | null
  scan: ScanResult | null
}

export interface AuditEvent {
  id: number
  event_type: string
  project_id?: number
  violation_id?: number
  fix_id?: number
  description: string
  metadata?: string
  created_at: string
}

export interface Settings {
  key: string
  value: string
  created_at: string
  updated_at: string
}

export interface ScanCost {
  id: number
  scan_id: number
  files_analyzed_with_llm: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  total_cost_usd: number
  created_at: string
}

// ============================================================================
// PROJECT COMMANDS
// ============================================================================

/**
 * Open a native file dialog to select a project folder
 * Uses frontend dialog plugin for Tauri 2.0 compatibility
 */
export async function select_project_folder(): Promise<string> {
  const result = await open({
    title: "Select Project Folder",
    directory: true,
    multiple: false,
    recursive: true,
  })

  if (!result || typeof result !== "string") {
    throw new Error("Folder selection cancelled")
  }

  return result
}

/**
 * Create a new project in the database
 */
export async function create_project(
  path: string,
  name?: string,
  framework?: string
): Promise<Project> {
  return await invoke<Project>("create_project", {
    path,
    name,
    framework,
  })
}

/**
 * Get all projects from the database
 */
export async function get_projects(): Promise<Project[]> {
  return await invoke<Project[]>("get_projects")
}

export async function delete_project(id: number): Promise<void> {
  await invoke<void>("delete_project", { projectId: id })
}

export async function delete_all_projects(): Promise<void> {
  await invoke<void>("delete_all_projects")
}

/**
 * Read file content from any path
 * This bypasses the fs plugin scope restrictions by reading via the Rust backend
 */
export async function read_file_content(filePath: string): Promise<string> {
  return await invoke<string>("read_file_content", { filePath })
}

// ============================================================================
// SCAN COMMANDS
// ============================================================================

/**
 * Detect the framework of a project
 */
export async function detect_framework(path: string): Promise<string> {
  return await invoke<string>("detect_framework", { path })
}

/**
 * Start scanning a project for violations
 */
export async function scan_project(
  projectId: number
): Promise<ScanResult> {
  return await invoke<ScanResult>("scan_project", { projectId })
}

/**
 * Get the current progress of a scan
 */
export async function get_scan_progress(
  scanId: number
): Promise<ScanResult> {
  return await invoke<ScanResult>("get_scan_progress", { scanId })
}

/**
 * Get all scans for a project
 */
export async function get_scans(
  projectId: number
): Promise<ScanResult[]> {
  return await invoke<ScanResult[]>("get_scans", { projectId })
}

/**
 * Start watching a project for real-time file changes
 * Emits "file-changed" events whenever files are modified, created, or deleted
 */
export async function watch_project(projectId: number): Promise<string> {
  return await invoke<string>("watch_project", { projectId })
}

/**
 * Stop watching a project for file changes
 */
export async function stop_watching(projectId: number): Promise<string> {
  return await invoke<string>("stop_watching", { projectId })
}

// ============================================================================
// VIOLATION COMMANDS
// ============================================================================

export interface ViolationFilters {
  severity?: string[]
  control?: string[]
  status?: string[]
}

/**
 * Get violations for a scan with optional filters
 */
export async function get_violations(
  scanId: number,
  filters?: ViolationFilters
): Promise<Violation[]> {
  return await invoke<Violation[]>("get_violations", {
    scanId,
    filters,
  })
}

/**
 * Get a single violation with full details
 */
export async function get_violation(
  violationId: number
): Promise<ViolationDetail> {
  return await invoke<ViolationDetail>("get_violation", {
    violationId,
  })
}

/**
 * Dismiss a violation (mark as ignored)
 */
export async function dismiss_violation(
  violationId: number
): Promise<void> {
  await invoke<void>("dismiss_violation", { violationId })
}

// ============================================================================
// FIX COMMANDS
// ============================================================================

/**
 * Generate a fix for a violation using Grok API
 */
export async function generate_fix(
  violationId: number
): Promise<Fix> {
  return await invoke<Fix>("generate_fix", { violationId })
}

/**
 * Apply a fix to the actual file and create a git commit
 */
export async function apply_fix(fixId: number): Promise<void> {
  await invoke<void>("apply_fix", { fixId })
}

// ============================================================================
// AUDIT COMMANDS
// ============================================================================

export interface AuditFilters {
  event_type?: string[]
  project_id?: number
  start_date?: string
  end_date?: string
  limit?: number
}

/**
 * Get audit events with optional filters
 */
export async function get_audit_events(
  filters?: AuditFilters
): Promise<AuditEvent[]> {
  return await invoke<AuditEvent[]>("get_audit_events", { filters })
}

// ============================================================================
// SETTINGS COMMANDS
// ============================================================================

/**
 * Get all settings
 */
export async function get_settings(): Promise<Settings[]> {
  return await invoke<Settings[]>("get_settings")
}

/**
 * Update or create a setting
 */
export async function update_settings(
  key: string,
  value: string
): Promise<Settings> {
  return await invoke<Settings>("update_settings", { key, value })
}

/**
 * Clear all database data (scan history, violations, fixes, audit events)
 * WARNING: This is destructive and cannot be undone
 */
export async function clear_database(): Promise<void> {
  await invoke<void>("clear_database")
}

/**
 * Export all database data to JSON format
 * Returns a JSON string containing all projects, scans, violations, fixes, and settings
 */
export async function export_data(): Promise<string> {
  return await invoke<string>("export_data")
}

/**
 * Complete onboarding by saving user's scanning preferences
 * @param scanMode - Scanning mode: "regex_only", "smart", or "analyze_all"
 * @param costLimit - Cost limit per scan in dollars (e.g., 5.00)
 */
export async function complete_onboarding(
  scanMode: "regex_only" | "smart" | "analyze_all",
  costLimit: number
): Promise<void> {
  await invoke<void>("complete_onboarding", {
    scanMode: scanMode,
    costLimit: costLimit,
  })
}

/**
 * Check if XAI_API_KEY environment variable is available
 * Used to determine if AI scan modes should be enabled
 * @returns true if API key is configured, false otherwise
 */
export async function check_api_key_available(): Promise<boolean> {
  return await invoke<boolean>("check_api_key_available")
}

// ============================================================================
// ANALYTICS COMMANDS
// ============================================================================

export type TimeRange = "24h" | "7d" | "30d" | "all"

/**
 * Get scan costs for a given time range
 * @param timeRange - Time period: "24h", "7d", "30d", or "all"
 */
export async function get_scan_costs(timeRange: TimeRange): Promise<ScanCost[]> {
  return await invoke<ScanCost[]>("get_scan_costs", { timeRange })
}

/**
 * Get cost details for a specific scan
 * @param scanId - ID of the scan to fetch cost for
 */
export async function get_scan_cost(scanId: number): Promise<ScanCost | null> {
  return await invoke<ScanCost | null>("get_scan_cost", { scanId })
}

/**
 * Respond to cost limit prompt during scanning
 * @param scanId - The ID of the scan
 * @param shouldContinue - True to continue scanning, false to stop
 */
export async function respond_to_cost_limit(
  scanId: number,
  shouldContinue: boolean
): Promise<void> {
  await invoke<void>("respond_to_cost_limit", {
    scanId,
    shouldContinue,
  })
}

/**
 * Cancel a running scan
 * @param scanId - The ID of the scan to cancel
 */
export async function cancel_scan(scanId: number): Promise<void> {
  await invoke<void>("cancel_scan", { scanId })
}

// ============================================================================
// GITHUB COMMANDS
// ============================================================================

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface GitHubConnectionStatus {
  connected: boolean
  username?: string
  avatar_url?: string
  repo_count: number
  tracked_count: number
}

export interface GitHubRepo {
  id: number
  github_id: number
  name: string
  full_name: string
  owner: string
  html_url: string
  clone_url: string
  description?: string
  private: boolean
  language?: string
  stargazers_count: number
  default_branch: string
  fetched_at: string
}

export interface RepoCheckResult {
  repo_id: number
  has_changes: boolean
}

export interface TrackedRepoWithDetails {
  id: number
  github_repo: GitHubRepo
  local_path?: string
  last_scanned_at?: string
  last_checked_at?: string
   last_commit_sha?: string
  is_active: boolean
  added_at: string
  total_violations?: number
  critical_violations?: number
  last_scan_status?: string
  last_scan_mode?: string
}

/**
 * Start GitHub OAuth Device Flow
 * Returns device code info for user to authorize in browser
 */
export async function start_github_oauth(): Promise<DeviceCodeResponse> {
  return await invoke<DeviceCodeResponse>("start_github_oauth")
}

/**
 * Poll for GitHub OAuth completion
 * Returns true when authorization is complete, false if still waiting
 */
export async function poll_github_oauth(): Promise<boolean> {
  return await invoke<boolean>("poll_github_oauth")
}

/**
 * Check GitHub connection status
 */
export async function check_github_connection(): Promise<GitHubConnectionStatus> {
  return await invoke<GitHubConnectionStatus>("check_github_connection")
}

/**
 * Disconnect GitHub account
 */
export async function disconnect_github(): Promise<void> {
  await invoke<void>("disconnect_github")
}

/**
 * Fetch repositories from GitHub API and cache them
 */
export async function fetch_github_repos(): Promise<GitHubRepo[]> {
  return await invoke<GitHubRepo[]>("fetch_github_repos")
}

/**
 * Get cached GitHub repositories
 */
export async function get_github_repos(): Promise<GitHubRepo[]> {
  return await invoke<GitHubRepo[]>("get_github_repos")
}

/**
 * Track a repository for compliance monitoring
 * @param github_repo_id - The internal database ID of the GitHub repo
 */
export async function track_repo(github_repo_id: number): Promise<number> {
  return await invoke<number>("track_repo", { githubRepoId: github_repo_id })
}

/**
 * Untrack a repository
 * @param tracked_repo_id - The ID of the tracked repo entry
 */
export async function untrack_repo(tracked_repo_id: number): Promise<void> {
  await invoke<void>("untrack_repo", { trackedRepoId: tracked_repo_id })
}

/**
 * Get tracked repositories with details
 */
export async function get_tracked_repos(): Promise<TrackedRepoWithDetails[]> {
  return await invoke<TrackedRepoWithDetails[]>("get_tracked_repos")
}

/**
 * Check if a tracked repo has new commits
 * @param tracked_repo_id - The ID of the tracked repo to check
 * @returns True if there are new changes
 */
export async function check_repo_for_changes(tracked_repo_id: number): Promise<boolean> {
  return await invoke<boolean>("check_repo_for_changes", {
    trackedRepoId: tracked_repo_id,
  })
}

/**
 * Check multiple tracked repos for changes in a single batch call
 * This is more efficient than checking repos one by one
 * @param tracked_repo_ids - Array of tracked repo IDs to check
 * @returns Array of results with repo_id and has_changes for each repo
 */
export async function check_repos_for_changes_batch(
  tracked_repo_ids: number[]
): Promise<RepoCheckResult[]> {
  return await invoke<RepoCheckResult[]>("check_repos_for_changes_batch", {
    trackedRepoIds: tracked_repo_ids,
  })
}

/**
 * Scan a GitHub repository remotely without cloning
 * @param tracked_repo_id - The ID of the tracked repo to scan
 * @param scan_mode - Scan mode: "regex_only", "smart", or "analyze_all"
 * @returns The scan ID
 */
export async function scan_github_repo(
  tracked_repo_id: number,
  scan_mode: string
): Promise<number> {
  return await invoke<number>("scan_github_repo", {
    trackedRepoId: tracked_repo_id,
    scanMode: scan_mode,
  })
}
