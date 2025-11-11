export type Severity = "critical" | "high" | "medium" | "low"

export type ViolationStatus = "open" | "fixed" | "dismissed"

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
