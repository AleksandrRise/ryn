import { PHASE_PRODUCTION_BUILD } from 'next/constants.js'

/** @type {import('next').NextConfig | ((phase: string) => import('next').NextConfig)} */
const nextConfig = (phase) => {
  const baseConfig = {
    images: {
      unoptimized: true,
    },
  }

  // Use static export only for production builds.
  // In dev, fall back to the default output so Next.js
  // can run the normal dev server without relying on
  // .next/dev manifests.
  if (phase === PHASE_PRODUCTION_BUILD) {
    return {
      ...baseConfig,
      output: 'export',
    }
  }

  return baseConfig
}

export default nextConfig
