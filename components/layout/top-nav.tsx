"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function TopNav() {
  const pathname = usePathname()

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/scan", label: "Scan Results" },
    { href: "/audit", label: "Audit Trail" },
    { href: "/settings", label: "Settings" },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-[#1a1a1a]">
      <div className="flex items-center h-12 px-8">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">
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
                  className={`text-[13px] ${
                    isActive ? "text-blue-400" : "text-[#e5e5e5] hover:text-white"
                  } transition-colors`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right side - project info */}
        <div className="ml-auto flex items-center gap-4 text-[12px] text-[#e5e5e5]">
          <span>~/my-project</span>
          <span className="text-[#b3b3b3]">•</span>
          <span>Django 4.2</span>
        </div>
      </div>
    </nav>
  )
}
