"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { SeverityBadge } from "../scan/severity-badge"
import type { Violation } from "@/lib/types/violation"

interface ViolationHeaderProps {
  violation: Violation
}

export function ViolationHeader({ violation }: ViolationHeaderProps) {
  return (
    <div className="space-y-4">
      <Link
        href="/scan"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Scan Results
      </Link>

      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <SeverityBadge severity={violation.severity} />
            <span className="text-sm font-mono text-muted-foreground">{violation.controlId}</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">{violation.description}</h1>
        </div>
      </div>
    </div>
  )
}
