'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dashboard } from "@/components/dashboard/dashboard"
import { get_settings } from "@/lib/tauri/commands"

export default function HomePage() {
  const router = useRouter()
  const [checkedOnboarding, setCheckedOnboarding] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    let mounted = true
    const isTauri = typeof window !== "undefined" && Boolean((window as any).__TAURI__)

    const checkOnboarding = async () => {
      if (!isTauri) {
        setCheckedOnboarding(true)
        setNeedsOnboarding(false)
        return
      }

      try {
        const settings = await get_settings()
        const onboardingCompleted = settings.find((s) => s.key === "onboarding_completed")

        const shouldOnboard = !onboardingCompleted || onboardingCompleted.value !== "true"
        if (mounted) {
          setNeedsOnboarding(shouldOnboard)
          setCheckedOnboarding(true)
          if (shouldOnboard) {
            router.replace("/onboarding")
          }
        }
      } catch (error) {
        console.error("[ryn] Failed to check onboarding status:", error)
        if (mounted) {
          setNeedsOnboarding(true)
          setCheckedOnboarding(true)
          router.replace("/onboarding")
        }
      }
    }

    void checkOnboarding()
    return () => {
      mounted = false
    }
  }, [router])

  if (!checkedOnboarding || needsOnboarding) {
    return null
  }

  return (
    <main>
      <Dashboard />
    </main>
  )
}
