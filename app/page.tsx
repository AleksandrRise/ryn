import { TopNav } from "@/components/layout/top-nav"
import { Dashboard } from "@/components/dashboard/dashboard"

export default function HomePage() {
  return (
    <>
      <TopNav />
      <main className="pt-12">
        <Dashboard />
      </main>
    </>
  )
}
