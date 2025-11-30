export type ScanMode = "regex_only" | "smart" | "analyze_all"

export interface ScanSummary {
  id: number
  projectId: number
  status: string
  startedAt: string
  completedAt?: string
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

// ============================================================================
// AI TRANSPARENCY TYPES (for real-time inference visibility)
// ============================================================================

/** Why a file was selected for AI analysis */
export type SelectionReason = "auth" | "db" | "api" | "secrets" | "file_io" | "network" | "all"

/** Status of an individual file being analyzed by AI */
export type AiFileStatus = "analyzing" | "complete" | "error"

/** Track an individual file being analyzed by AI */
export interface AiFileStream {
  /** Path to the file being analyzed */
  filePath: string
  /** Current status of this file's analysis */
  status: AiFileStatus
  /** AI's streaming text output (accumulated) */
  streamingText: string
  /** Why this file was selected for AI analysis */
  selectionReason: SelectionReason
  /** Number of violations found so far */
  violationsFound: number
  /** When analysis started (for timing display) */
  startedAt: number
}

/** Overall AI analysis state (tracks multiple parallel files) */
export interface AiActivity {
  /** Current phase of AI analysis */
  phase: "idle" | "analyzing" | "complete"
  /** Current batch number (1-indexed) */
  currentBatch: number
  /** Total number of batches */
  totalBatches: number
  /** Files analyzed so far */
  filesAnalyzed: number
  /** Total files to be analyzed by AI */
  totalLlmFiles: number
  /** Active file streams (keyed by filePath) */
  activeStreams: Map<string, AiFileStream>
}

// Tauri event payloads (matching Rust structs)

/** Emitted when AI analysis starts on a file */
export interface AiFileStartedEvent {
  scanId: number
  filePath: string
  fileIndex: number
  totalLlmFiles: number
  selectionReason: SelectionReason
}

/** Emitted for each chunk of AI reasoning text */
export interface AiReasoningChunkEvent {
  scanId: number
  filePath: string
  chunk: string
  accumulated: string
}

/** Emitted when AI analysis completes for a file */
export interface AiFileCompletedEvent {
  scanId: number
  filePath: string
  violationsFound: number
  confidenceScores: number[]
  summary: string
}

/** Emitted when AI analysis begins for a batch */
export interface AiBatchStartedEvent {
  scanId: number
  batchNumber: number
  totalBatches: number
  filesInBatch: string[]
}
