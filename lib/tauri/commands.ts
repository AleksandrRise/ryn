// Tauri IPC Commands - Frontend to Backend Communication
// Real implementations using Tauri's invoke API

import { invoke } from "@tauri-apps/api/core"

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
  framework?: string
  status: string
  total_violations: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  started_at: string
  completed_at?: string
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
}

export interface Fix {
  id: number
  violation_id: number
  original_code: string
  fixed_code: string
  applied: boolean
  created_at: string
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

// ============================================================================
// PROJECT COMMANDS
// ============================================================================

/**
 * Open a native file dialog to select a project folder
 */
export async function select_project_folder(): Promise<string> {
  return await invoke<string>("select_project_folder")
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
 * Returns the scan_id directly (number) - scanning happens in background
 */
export async function scan_project(
  projectId: number,
  enabledControls: string[]
): Promise<number> {
  return await invoke<number>("scan_project", { projectId, enabledControls })
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
): Promise<Violation> {
  return await invoke<Violation>("get_violation", {
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
 * Generate a fix for a violation using Claude API
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
  eventType?: string[]
  projectId?: number
  startDate?: string
  endDate?: string
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
