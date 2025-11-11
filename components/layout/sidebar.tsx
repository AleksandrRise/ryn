"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ScanSearch, FileText, Settings } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Scan Results", href: "/scan", icon: ScanSearch },
  { name: "Audit Trail", href: "/audit", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 border-r border-border bg-surface flex flex-col">
      {/* Logo */}
      <div className="h-16 border-b border-border flex items-center px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/ryn-logo.svg" alt="Ryn" width={36} height={36} className="h-9 w-auto" priority />
          <span className="font-semibold text-foreground text-lg">ryn</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <div className="text-xs text-muted-foreground">v0.1.0-alpha</div>
      </div>
    </aside>
  )
}
