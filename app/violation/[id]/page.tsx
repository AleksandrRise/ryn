import { TopNav } from "@/components/layout/top-nav"
import { ViolationDetail } from "@/components/violation/violation-detail"

// No generateStaticParams needed - Tauri apps don't use static export
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
