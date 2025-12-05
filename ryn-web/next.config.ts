import { PHASE_PRODUCTION_BUILD } from "next/constants.js"
import type { NextConfig } from "next"

const createConfig = (phase: string): NextConfig => {
  const baseConfig: NextConfig = {
    images: {
      unoptimized: true,
    },
    turbopack: {
      root: process.cwd(),
    },
    reactStrictMode: true,
    compress: true,
    poweredByHeader: false,
    generateEtags: true,
    pageExtensions: ["ts", "tsx", "js", "jsx"],
  }

  if (phase === PHASE_PRODUCTION_BUILD) {
    return {
      ...baseConfig,
      output: "export",
    }
  }

  return baseConfig
}

const nextConfig: NextConfig | ((phase: string) => NextConfig) = createConfig

export default nextConfig
