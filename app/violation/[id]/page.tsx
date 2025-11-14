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

export default function ViolationPage({ params }: { params: { id: string } }) {
  return (
    <>
      <TopNav />
      <main className="pt-12">
        <ViolationDetail violationId={Number.parseInt(params.id)} />
      </main>
    </>
  )
}
