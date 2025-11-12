import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { WaterBackground } from "@/components/ui/water-background"
import { McpInit } from "@/components/mcp-init"

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
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="stylesheet" href="/css/line-awesome.min.css" />
      </head>
      <body className={inter.className}>
        <McpInit />
        <WaterBackground />
        <div className="fixed inset-0 bg-black/65 z-[5]" />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  )
}
