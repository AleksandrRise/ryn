/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed 'output: export' - not needed for Tauri apps
  // Tauri serves the Next.js app locally, no static export required
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
