import { TopNav } from "@/components/layout/top-nav"
import { ViolationDetail } from "@/components/violation/violation-detail"

// No generateStaticParams needed - Tauri apps don't use static export
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
