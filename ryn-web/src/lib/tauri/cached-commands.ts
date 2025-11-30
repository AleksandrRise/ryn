/**
 * Cached Tauri Command Wrappers
 *
 * This module provides cached versions of frequently-called Tauri commands.
 * Results are cached for 5 seconds to prevent duplicate IPC calls during
 * the same interaction or render cycle.
 *
 * Commands that modify state (create, update, delete) automatically
 * invalidate related caches to ensure consistency.
 */

import {
  check_github_connection,
  get_projects,
  get_tracked_repos,
  get_scans,
  get_violations,
  get_violation,
  get_audit_events,
  get_settings,
  get_github_repos,
  get_scan_costs,
  get_scan_cost,
} from "./commands"
import { invalidateTauriCache, invalidateTauriCacheByCommand } from "@/lib/hooks/use-tauri-cache"
import type { GitHubConnectionStatus, Project, TrackedRepoWithDetails, ScanResult, Violation } from "./commands"

/**
 * Cached query: Check GitHub connection
 * Uses cache to prevent excessive connection status checks
 */
export async function cached_check_github_connection(): Promise<GitHubConnectionStatus> {
  return check_github_connection()
}

/**
 * Cached query: Get projects
 * Gets invalidated when projects are created/deleted
 */
export async function cached_get_projects(): Promise<Project[]> {
  return get_projects()
}

/**
 * Invalidate projects cache (call after create/delete project)
 */
export function invalidate_projects_cache(): void {
  invalidateTauriCacheByCommand("get_projects")
}

/**
 * Cached query: Get tracked repos
 * Gets invalidated when repos are tracked/untracked
 */
export async function cached_get_tracked_repos(): Promise<TrackedRepoWithDetails[]> {
  return get_tracked_repos()
}

/**
 * Invalidate tracked repos cache (call after track/untrack repo)
 */
export function invalidate_tracked_repos_cache(): void {
  invalidateTauriCacheByCommand("get_tracked_repos")
}

/**
 * Cached query: Get scans for a project
 * Gets invalidated when a new scan completes
 */
export async function cached_get_scans(projectId: number): Promise<ScanResult[]> {
  return get_scans(projectId)
}

/**
 * Invalidate scans cache for a project (call after scan completes)
 */
export function invalidate_scans_cache(projectId: number): void {
  invalidateTauriCache("get_scans", { projectId })
}

/**
 * Cached query: Get violations for a scan
 */
export async function cached_get_violations(scanId: number, filters?: any): Promise<Violation[]> {
  return get_violations(scanId, filters)
}

/**
 * Invalidate violations cache (call after dismissing/fixing violations)
 */
export function invalidate_violations_cache(scanId: number): void {
  invalidateTauriCache("get_violations", { scanId })
}

/**
 * Cached query: Get specific violation detail
 */
export async function cached_get_violation(violationId: number) {
  return get_violation(violationId)
}

/**
 * Invalidate violation cache (call after dismissing/fixing)
 */
export function invalidate_violation_cache(violationId: number): void {
  invalidateTauriCache("get_violation", { violationId })
}

/**
 * Cached query: Get audit events
 */
export async function cached_get_audit_events(filters?: any) {
  return get_audit_events(filters)
}

/**
 * Invalidate audit events cache
 */
export function invalidate_audit_events_cache(): void {
  invalidateTauriCacheByCommand("get_audit_events")
}

/**
 * Cached query: Get all settings
 */
export async function cached_get_settings() {
  return get_settings()
}

/**
 * Invalidate settings cache (call after updating settings)
 */
export function invalidate_settings_cache(): void {
  invalidateTauriCacheByCommand("get_settings")
}

/**
 * Cached query: Get GitHub repos
 */
export async function cached_get_github_repos() {
  return get_github_repos()
}

/**
 * Invalidate GitHub repos cache (call after fetching new repos)
 */
export function invalidate_github_repos_cache(): void {
  invalidateTauriCacheByCommand("get_github_repos")
}

/**
 * Cached query: Get scan costs for a time range
 */
export async function cached_get_scan_costs(timeRange: string) {
  return get_scan_costs(timeRange as any)
}

/**
 * Invalidate scan costs cache (call after new scan)
 */
export function invalidate_scan_costs_cache(): void {
  invalidateTauriCacheByCommand("get_scan_costs")
}

/**
 * Cached query: Get cost for a specific scan
 */
export async function cached_get_scan_cost(scanId: number) {
  return get_scan_cost(scanId)
}

/**
 * Invalidate scan cost cache
 */
export function invalidate_scan_cost_cache(scanId: number): void {
  invalidateTauriCache("get_scan_cost", { scanId })
}
