export type AuditEventType =
  | "scan_completed"
  | "fix_applied"
  | "violation_detected"
  | "violation_dismissed"
  | "project_selected"
  | string

export interface AuditEvent {
  id: number
  eventType: AuditEventType
  projectId?: number
  violationId?: number
  fixId?: number
  description: string
  metadata?: string | Record<string, any>
  createdAt: string
}
