"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useProjectStore } from "@/lib/stores/project-store"

export function TopNav() {
  const pathname = usePathname()
  const { selectedProject } = useProjectStore()

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/scan", label: "Scan Results" },
    { href: "/audit", label: "Audit Trail" },
    { href: "/settings", label: "Settings" },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-white/10">
      <div className="flex items-center h-12 px-8">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold tracking-tight hover:text-white/80 transition-colors">
            ryn
          </Link>

          {/* Navigation links */}
          <div className="flex gap-6">
            {links.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium ${
                    isActive ? "text-white" : "text-white/60 hover:text-white/90"
                  } transition-colors`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right side - project info */}
        <div className="ml-auto flex items-center gap-4 text-xs font-medium text-white/40">
          {selectedProject ? (
            <>
              <span>{selectedProject.name}</span>
              <span>•</span>
              <span>{selectedProject.framework || "Unknown framework"}</span>
            </>
          ) : (
            <span>No project selected</span>
          )}
        </div>
      </div>
    </nav>
  )
}
