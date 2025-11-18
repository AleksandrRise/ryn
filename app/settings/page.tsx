import { TopNav } from "@/components/layout/top-nav"
import { Settings } from "@/components/settings/settings"

export default function SettingsPage() {
  return (
    <>
      <TopNav />
      <main className="pt-10">
        <Settings />
      </main>
    </>
  )
}
