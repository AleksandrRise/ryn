import type { Severity } from "@/lib/types/violation"

export type ScanMode = "regex_only" | "smart" | "analyze_all"

export interface ScanSummary {
  id: number
  projectId: number
  status: string
  startedAt: string
  completedAt?: string
  createdAt?: string
  filesScanned: number
  totalFiles: number
  violationsFound: number
  scanMode: ScanMode
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
}

export interface ScanCost {
  id: number
  scanId: number
  filesAnalyzedWithLlm: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalCostUsd: number
  createdAt: string
}

export interface ScanProgress {
  percentage: number
  currentFile: string
  filesScanned: number
  totalFiles: number
}

export type SeverityCounts = Record<Severity, number>
