import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { WaterBackground } from "@/components/ui/water-background"
import { ConsoleLogger } from "@/components/console-logger"
import { Toaster } from "sonner"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { TopNav } from "@/components/layout/top-nav"
import { HalloweenThemeContextProvider } from "@/lib/context/HalloweenContext"
import { HalloweenThemeProvider } from "@/components/halloween/HalloweenThemeProvider"

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
        <HalloweenThemeContextProvider>
          <ErrorBoundary>
            <HalloweenThemeProvider>
              <ConsoleLogger />
              <WaterBackground />
              <div className="fixed inset-x-0 top-0 bottom-0 bg-black/78 backdrop-blur-[2px] z-[5]" />
              <div className="relative z-10">
                <TopNav />
                <div className="pt-16">{children}</div>
              </div>
              <Toaster theme="dark" richColors />
            </HalloweenThemeProvider>
          </ErrorBoundary>
        </HalloweenThemeContextProvider>
      </body>
    </html>
  )
}
