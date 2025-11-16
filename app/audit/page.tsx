import { TopNav } from "@/components/layout/top-nav"
import { AuditTrail } from "@/components/audit/audit-trail"

export default function AuditPage() {
  return (
    <>
      <TopNav />
      <main className="pt-10">
        <AuditTrail />
      </main>
    </>
  )
}
