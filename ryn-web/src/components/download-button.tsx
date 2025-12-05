'use client'

import { useEffect, useState } from 'react'
import { useLatestRelease } from '@/hooks/useLatestRelease'
import { Download } from 'lucide-react'

interface DownloadButtonProps {
  className?: string
  children?: React.ReactNode
}

type Platform = 'macos-intel' | 'macos-arm' | 'windows' | 'linux' | 'unknown'

export function DownloadButton({
  className = '',
  children,
}: DownloadButtonProps) {
  const { assets, loading } = useLatestRelease()
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>('unknown')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Detect OS
    const ua = navigator.userAgent
    if (ua.includes('Mac')) {
      // Detect ARM (Apple Silicon) vs Intel
      const isARM = /\b(arm|aarch)\b/i.test(ua) || (window as any).navigator.maxTouchPoints > 0
      setDetectedPlatform(isARM ? 'macos-arm' : 'macos-intel')
    } else if (ua.includes('Windows')) {
      setDetectedPlatform('windows')
    } else if (ua.includes('Linux')) {
      setDetectedPlatform('linux')
    }
  }, [])

  const fallbackUrl = 'https://github.com/AleksandrRise/ryn/releases/tag/release-alpha'

  if (!mounted) {
    return (
      <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className={className}>
        <button className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-gray-100 transition-colors">
          <Download size={18} />
          <span>Download</span>
        </button>
      </a>
    )
  }

  let downloadUrl = fallbackUrl
  let isDirectDownload = false

  if (!loading && assets.length > 0) {
    const asset = assets.find((a) => a.platform === detectedPlatform)
    if (asset?.downloadUrl) {
      downloadUrl = asset.downloadUrl
      isDirectDownload = true
    }
  }

  const getPlatformLabel = (platform: Platform) => {
    switch (platform) {
      case 'macos-intel':
      case 'macos-arm':
        return 'macOS'
      case 'windows':
        return 'Windows'
      case 'linux':
        return 'Linux'
      default:
        return 'Download'
    }
  }

  return (
    <a
      href={downloadUrl}
      {...(isDirectDownload && { download: true })}
      {...(!isDirectDownload && { target: '_blank', rel: 'noopener noreferrer' })}
      className={className}
    >
      <button className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-gray-100 transition-colors w-full">
        <Download size={18} />
        <span>{children || `Download for ${getPlatformLabel(detectedPlatform)}`}</span>
      </button>
    </a>
  )
}
