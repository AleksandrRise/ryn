export type TrustLevel = "auto" | "review" | "manual"

export interface Fix {
  id: number
  violationId: number
  originalCode: string
  fixedCode: string
  explanation: string
  trustLevel: TrustLevel
  appliedAt?: string
  appliedBy: string
}
