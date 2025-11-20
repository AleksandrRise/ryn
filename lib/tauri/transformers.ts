import type {
  AuditEvent as ApiAuditEvent,
  ScanCost as ApiScanCost,
  ScanResult as ApiScanResult,
  Violation as ApiViolation,
} from "@/lib/tauri/commands"
import type { AuditEvent } from "@/lib/types/audit"
import type { ScanCost, ScanMode, ScanSummary } from "@/lib/types/scan"
import type { Violation, ViolationStatus } from "@/lib/types/violation"

export function toScanSummary(scan: ApiScanResult): ScanSummary {
  return {
    id: scan.id,
    projectId: scan.project_id,
    status: scan.status,
    startedAt: scan.started_at,
    completedAt: scan.completed_at,
    createdAt: scan.created_at,
    filesScanned: scan.files_scanned ?? 0,
    totalFiles: scan.total_files ?? scan.files_scanned ?? 0,
    violationsFound: scan.violations_found ?? 0,
    scanMode: scan.scan_mode as ScanMode,
    criticalCount: scan.critical_count ?? 0,
    highCount: scan.high_count ?? 0,
    mediumCount: scan.medium_count ?? 0,
    lowCount: scan.low_count ?? 0,
  }
}

export function toViolation(violation: ApiViolation): Violation {
  const status = normalizeStatus(violation.status)

  return {
    id: violation.id,
    scanId: violation.scan_id,
    controlId: violation.control_id,
    severity: violation.severity,
    description: violation.description,
    filePath: violation.file_path,
    lineNumber: violation.line_number,
    codeSnippet: violation.code_snippet,
    status,
    detectedAt: violation.created_at ?? "",
    detectionMethod: violation.detection_method,
    confidenceScore: violation.confidence_score,
    llmReasoning: violation.llm_reasoning,
    regexReasoning: violation.regex_reasoning,
  }
}

function normalizeStatus(status: string | undefined): ViolationStatus {
  if (status === "open" || status === "fixed" || status === "dismissed") {
    return status
  }
  return "open"
}

export function toScanCost(cost: ApiScanCost | null): ScanCost | null {
  if (!cost) return null

  return {
    id: cost.id,
    scanId: cost.scan_id,
    filesAnalyzedWithLlm: cost.files_analyzed_with_llm,
    inputTokens: cost.input_tokens,
    outputTokens: cost.output_tokens,
    cacheReadTokens: cost.cache_read_tokens,
    cacheWriteTokens: cost.cache_write_tokens,
    totalCostUsd: cost.total_cost_usd,
    createdAt: cost.created_at,
  }
}

export function toAuditEvent(event: ApiAuditEvent): AuditEvent {
  return {
    id: event.id,
    eventType: event.event_type,
    projectId: event.project_id,
    violationId: event.violation_id,
    fixId: event.fix_id,
    description: event.description,
    metadata: event.metadata,
    createdAt: event.created_at,
  }
}
