'use client'

import { useState, useEffect } from 'react'
import { Dashboard } from "@/components/dashboard/dashboard"
import { ScanModeOnboarding } from "@/components/onboarding/scan-mode-onboarding"
import { get_settings, complete_onboarding } from "@/lib/tauri/commands"

export default function HomePage() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true)

  useEffect(() => {
    // Check if onboarding has been completed
    const checkOnboarding = async () => {
      try {
        const settings = await get_settings()
        const onboardingCompleted = settings.find(s => s.key === 'onboarding_completed')

        // Show onboarding if not completed
        if (!onboardingCompleted || onboardingCompleted.value !== 'true') {
          setShowOnboarding(true)
        }
      } catch (error) {
        console.error('[ryn] Failed to check onboarding status:', error)
        // Show onboarding on error to be safe
        setShowOnboarding(true)
      } finally {
        setIsCheckingOnboarding(false)
      }
    }

    checkOnboarding()
  }, [])

  const handleOnboardingComplete = async (
    scanMode: 'regex_only' | 'smart' | 'analyze_all',
    costLimit: number
  ) => {
    try {
      await complete_onboarding(scanMode, costLimit)
      setShowOnboarding(false)
    } catch (error) {
      console.error('[ryn] Failed to complete onboarding:', error)
      // TODO: Show error toast to user
    }
  }

  // Don't render anything until we've checked onboarding status
  if (isCheckingOnboarding) {
    return null
  }

  return (
    <>
      <main>
        <Dashboard />
      </main>

      {/* Onboarding dialog */}
      <ScanModeOnboarding
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
      />
    </>
  )
}
