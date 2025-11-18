export type Severity = "critical" | "high" | "medium" | "low"

export type ViolationStatus = "open" | "fixed" | "dismissed"

export type DetectionMethod = "regex" | "llm" | "hybrid"

export interface Violation {
  id: number
  scanId: number
  controlId: string
  severity: Severity
  description: string
  filePath: string
  lineNumber: number
  codeSnippet: string
  status: ViolationStatus
  detectedAt: string
  detectionMethod: DetectionMethod
  confidenceScore?: number  // 0.0-1.0, only for LLM/hybrid
  llmReasoning?: string     // AI explanation of why this is a violation
  regexReasoning?: string   // Pattern match explanation
}

export interface ScanResult {
  id: number
  projectId: number
  startedAt: string
  completedAt: string
  filesScanned: number
  violationsFound: number
  status: "running" | "completed" | "failed"
}
