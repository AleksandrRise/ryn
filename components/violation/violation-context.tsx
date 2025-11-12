"use client"

import { AlertTriangle, BookOpen } from "lucide-react"
import type { Violation } from "@/lib/types/violation"

interface ViolationContextProps {
  violation: Violation
}

export function ViolationContext({ violation }: ViolationContextProps) {
  // Generate context based on violation control ID and severity
  const getContextForControl = (controlId: string, severity: string) => {
    const contexts: Record<string, {whyItMatters: string, riskLevel: string, complianceRequirement: string}> = {
      "CC6.1": {
        whyItMatters: "User access controls are fundamental to SOC 2 CC6.1 compliance. Without proper authentication and authorization, unauthorized users can access sensitive data or perform privileged operations, leading to data breaches.",
        riskLevel: `${severity} - Unauthorized access risk`,
        complianceRequirement: "SOC 2 Type II requires that all user access be authenticated, authorized, and audited with proper role-based access controls.",
      },
      "CC6.7": {
        whyItMatters: "Hardcoded secrets in source code violate SOC 2 CC6.7 (Logical and Physical Access Controls). If your repository is compromised or accidentally exposed, attackers gain immediate access to your production systems.",
        riskLevel: `${severity} - Direct path to system compromise`,
        complianceRequirement: "SOC 2 Type II requires that all secrets and credentials be stored securely outside of source code, with proper access controls and rotation policies.",
      },
      "CC7.2": {
        whyItMatters: "System monitoring and logging are required by SOC 2 CC7.2 to detect security incidents. Without proper logging, you cannot investigate breaches or prove compliance to auditors.",
        riskLevel: `${severity} - Inability to detect or investigate incidents`,
        complianceRequirement: "SOC 2 Type II requires comprehensive logging of security-relevant events with tamper-proof storage and regular review.",
      },
      "A1.2": {
        whyItMatters: "Data availability and resilience are core to SOC 2 A1.2. Without proper error handling and resilience patterns, system failures can lead to data loss or extended outages.",
        riskLevel: `${severity} - Service availability risk`,
        complianceRequirement: "SOC 2 Type II requires that systems have proper error handling, redundancy, and recovery mechanisms to ensure continuous availability.",
      },
    }

    return contexts[controlId] || {
      whyItMatters: `This violation relates to control ${controlId}. ${violation.description}`,
      riskLevel: `${severity} - Compliance violation`,
      complianceRequirement: `SOC 2 Type II requires proper implementation of control ${controlId}.`,
    }
  }

  const context = getContextForControl(violation.control_id, violation.severity)

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
