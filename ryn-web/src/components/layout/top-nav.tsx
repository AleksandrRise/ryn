"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/scan", label: "Scan Results" },
    { href: "/dashboard/audit", label: "Audit Trail" },
    { href: "/dashboard/settings", label: "Settings" },
  ]

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth/signin")
  }

  // Don't show nav on auth pages
  if (pathname?.startsWith("/auth")) {
    return null
  }

  // Don't show nav while loading or if not authenticated
  if (loading) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-white/10">
        <div className="flex items-center h-10 px-6">
          <Link href="/" className="text-lg font-bold tracking-tight hover:text-white/80 transition-colors">
            ryn
          </Link>
        </div>
      </nav>
    )
  }

  if (!user) {
    return null
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-white/10">
      <div className="flex items-center h-10 px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight hover:text-white/80 transition-colors">
            ryn
          </Link>

          <div className="flex gap-4">
            {links.map((link) => {
              const normalizedPathname = pathname?.replace(/\/$/, "") || ""
              const normalizedHref = link.href.replace(/\/$/, "") || ""
              const isActive = normalizedPathname === normalizedHref ||
                (normalizedHref !== "/dashboard" && normalizedPathname.startsWith(normalizedHref))
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-xs font-medium ${
                    isActive ? "text-white" : "text-white/60 hover:text-white/90"
                  } transition-colors`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <i className="las la-user-circle text-base"></i>
            <span>{user.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-white/40 hover:text-white/80 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
