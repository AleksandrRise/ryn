"use client"

import Link from "next/link"
import { SeverityBadge } from "./severity-badge"
import { DetectionBadge } from "./detection-badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Sparkles } from "lucide-react"
import type { Violation } from "@/lib/types/violation"

interface ViolationTableProps {
  violations: Violation[]
}

export function ViolationTable({ violations }: ViolationTableProps) {
  if (violations.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <p className="text-muted-foreground">No violations found matching your filters</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                Severity
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                Control
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                Detection
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                Description
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                Location
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                Status
              </th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {violations.map((violation) => (
              <tr key={violation.id} className="hover:bg-accent/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <SeverityBadge severity={violation.severity} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-mono text-foreground">{violation.controlId}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <DetectionBadge method={violation.detectionMethod} />
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-foreground max-w-md">{violation.description}</p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-mono text-foreground">{violation.filePath}</span>
                    <span className="text-xs text-muted-foreground">Line {violation.lineNumber}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning-bg text-warning text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                    Fix Available
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/violation/${violation.id}`}>
                      <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                        <ExternalLink className="w-3.5 h-3.5" />
                        View
                      </Button>
                    </Link>
                    <Button size="sm" className="gap-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      Quick Fix
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="border-t border-border px-6 py-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {violations.length} of {violations.length} violations
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
