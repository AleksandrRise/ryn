export type AuditEventType = "scan" | "violation" | "fix" | "project_selected"

export interface AuditEvent {
  id: number
  eventType: AuditEventType
  projectId?: number
  violationId?: number
  fixId?: number
  description: string
  metadata: Record<string, any>
  createdAt: string
}
