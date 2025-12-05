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
    typescript: {
      ignoreBuildErrors: true,
    },
    reactStrictMode: true,
    compress: true,
    poweredByHeader: false,
    generateEtags: true,
    pageExtensions: ["ts", "tsx", "js", "jsx"],
  }

  return baseConfig
}

const nextConfig: NextConfig | ((phase: string) => NextConfig) = createConfig

export default nextConfig
