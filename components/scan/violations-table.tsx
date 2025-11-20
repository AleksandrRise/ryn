"use client"

import Link from "next/link"
import { DetectionBadge } from "@/components/scan/detection-badge"
import { SeverityBadge } from "@/components/scan/severity-badge"
import type { Violation } from "@/lib/types/violation"

interface ViolationsTableProps {
  violations: Violation[]
}

export function ViolationsTable({ violations }: ViolationsTableProps) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden animate-fade-in-up delay-500">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Severity</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Detection</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Control</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Description</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Location</th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {violations.map((violation) => (
              <tr key={violation.id} className="group border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">
                  <SeverityBadge severity={violation.severity} />
                </td>
                <td className="px-6 py-4">
                  <DetectionBadge method={violation.detectionMethod} />
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/5 text-xs font-mono font-medium">
                    {violation.controlId}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-white/90">{violation.description}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-xs text-white/60 font-mono">
                    {violation.filePath}
                    <span className="text-white/40">:{violation.lineNumber}</span>
                  </p>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/violation?id=${violation.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-white transition-colors"
                  >
                    View details
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </td>
              </tr>
            ))}
            {violations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-white/50">
                  No violations found. Run a scan to populate results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
