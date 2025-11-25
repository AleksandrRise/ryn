import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { WaterBackground } from "@/components/ui/water-background"
import { ConsoleLogger } from "@/components/console-logger"
import { McpInit } from "@/components/mcp-init"
import { Toaster } from "sonner"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { TopNav } from "@/components/layout/top-nav"

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Ryn - SOC 2 Compliance Tool",
  description: "AI-powered SOC 2 compliance scanning and remediation",
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="stylesheet" href="/css/line-awesome.min.css" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <McpInit />
          <ConsoleLogger />
          <WaterBackground />
          <div className="fixed inset-0 bg-black/78 backdrop-blur-[2px] z-[5]" />
          <div className="relative z-10">
            <TopNav />
            <div className="pt-10">{children}</div>
          </div>
          <Toaster theme="dark" richColors />
        </ErrorBoundary>
      </body>
    </html>
  )
}
