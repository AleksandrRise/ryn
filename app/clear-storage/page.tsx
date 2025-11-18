"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useProjectStore } from '@/lib/stores/project-store'

export default function ClearStorage() {
  const router = useRouter()
  const { clearProject } = useProjectStore()

  useEffect(() => {
    // Clear all localStorage
    localStorage.clear()

    // Clear Zustand store
    clearProject()

    // Redirect to home
    setTimeout(() => {
      router.push('/')
    }, 1000)
  }, [clearProject, router])

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Clearing storage...</h1>
      <p>You will be redirected to the home page.</p>
    </div>
  )
}
