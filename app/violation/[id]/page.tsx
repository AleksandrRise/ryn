import { TopNav } from "@/components/layout/top-nav"
import { ViolationDetail } from "@/components/violation/violation-detail"

// Required for Next.js static export with dynamic routes
// Allows pages to be generated on-demand at runtime in Tauri
export const dynamicParams = true

export function generateStaticParams() {
  // Return empty array - violation pages are generated on-demand
  // This prevents the build error with output: 'export'
  return []
}

// Next.js 15+ requires params to be awaited
export default async function ViolationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <>
      <TopNav />
      <main className="pt-12">
        <ViolationDetail violationId={Number.parseInt(id)} />
      </main>
    </>
  )
}
