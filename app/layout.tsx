import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { WaterBackground } from "@/components/ui/water-background"

const inter = Inter({ subsets: ["latin"] })

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
      <body className={inter.className}>
        <WaterBackground />
        <div className="fixed inset-0 bg-black/40 z-[5]" />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  )
}
