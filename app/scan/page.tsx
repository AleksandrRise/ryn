import { TopNav } from "@/components/layout/top-nav"
import { ScanResults } from "@/components/scan/scan-results"

export default function ScanPage() {
  return (
    <>
      <TopNav />
      <main className="pt-12">
        <ScanResults />
      </main>
    </>
  )
}
