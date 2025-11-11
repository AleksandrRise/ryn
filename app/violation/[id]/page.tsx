import { TopNav } from "@/components/layout/top-nav"
import { ViolationDetail } from "@/components/violation/violation-detail"

export function generateStaticParams() {
  return [{ id: '1' }]
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
