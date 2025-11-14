/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use static export for production builds (Tauri bundling)
  // During development, use standard Next.js server mode to support dynamic routes
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
