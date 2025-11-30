"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ViolationDetail } from "@/components/violation/violation-detail"

function ViolationPageInner() {
  const searchParams = useSearchParams()
  const idParam = searchParams.get("id") ?? undefined
  const violationId = idParam ? Number.parseInt(idParam, 10) : NaN

  if (!idParam || Number.isNaN(violationId) || violationId <= 0) {
    return (
      <>
        <main>
          <div className="px-8 py-12 flex items-center justify-center">
            <p className="text-sm text-red-400">
              Invalid or missing violation id. Please open this page from the Scan Results view.
            </p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <main>
        <ViolationDetail violationId={violationId} />
      </main>
    </>
  )
}

export default function ViolationPage() {
  return (
    <Suspense
      fallback={
        <>
          <main>
            <div className="px-8 py-12 flex items-center justify-center">
              <p className="text-sm text-gray-400">Loading violation details...</p>
            </div>
          </main>
        </>
      }
    >
      <ViolationPageInner />
    </Suspense>
  )
}
