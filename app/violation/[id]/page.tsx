import { TopNav } from "@/components/layout/top-nav"
import { ViolationDetail } from "@/components/violation/violation-detail"
import { use } from "react"

// No generateStaticParams needed - Tauri apps don't use static export
export default function ViolationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <>
      <TopNav />
      <main className="pt-12">
        <ViolationDetail violationId={Number.parseInt(id)} />
      </main>
    </>
  )
}
