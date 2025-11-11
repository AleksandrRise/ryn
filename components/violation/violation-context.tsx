"use client"

import { AlertTriangle, BookOpen } from "lucide-react"
import type { Violation } from "@/lib/types/violation"

interface ViolationContextProps {
  violation: Violation
}

export function ViolationContext({ violation }: ViolationContextProps) {
  // Mock compliance context data
  const context = {
    whyItMatters:
      "Hardcoded secrets in source code violate SOC 2 CC6.7 (Logical and Physical Access Controls). If your repository is compromised or accidentally exposed, attackers gain immediate access to your production systems. This is a critical security vulnerability that auditors will flag immediately.",
    riskLevel: "Critical - Direct path to system compromise",
    complianceRequirement:
      "SOC 2 Type II requires that all secrets and credentials be stored securely outside of source code, with proper access controls and rotation policies.",
  }

  return (
    <div className="space-y-4">
      <div className="bg-danger-bg border border-danger/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-danger mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Why This Matters</h3>
            <p className="text-sm text-foreground/90 leading-relaxed">{context.whyItMatters}</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Compliance Context</h3>
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Risk Assessment</p>
            <p className="text-sm text-foreground">{context.riskLevel}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Requirement</p>
            <p className="text-sm text-foreground leading-relaxed">{context.complianceRequirement}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
