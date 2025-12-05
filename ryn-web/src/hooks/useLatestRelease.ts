'use client'

import { useEffect, useState } from 'react'

export interface ReleaseAsset {
  name: string
  downloadUrl: string
  platform: 'macos-intel' | 'macos-arm' | 'windows' | 'linux'
  size: number
}

export interface LatestRelease {
  version: string
  assets: ReleaseAsset[]
  loading: boolean
  error: string | null
}

const GITHUB_REPO = 'AleksandrRise/ryn'
const RELEASE_TAG = 'release-alpha'

export function useLatestRelease(): LatestRelease {
  const [version, setVersion] = useState('')
  const [assets, setAssets] = useState<ReleaseAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRelease = async () => {
      try {
        setLoading(true)
        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${RELEASE_TAG}`
        )

        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.statusText}`)
        }

        const data = await response.json()
        setVersion(data.tag_name || data.name)

        // Map GitHub assets to our platform categories
        const platformAssets: ReleaseAsset[] = data.assets
          .filter((asset: any) => {
            const name = asset.name.toLowerCase()
            return (
              name.includes('.dmg') ||
              name.includes('.msi') ||
              name.includes('.appimage') ||
              name.includes('.exe')
            )
          })
          .map((asset: any) => {
            const name = asset.name.toLowerCase()
            let platform: ReleaseAsset['platform']

            if (name.includes('aarch64') && name.includes('.dmg')) {
              platform = 'macos-arm'
            } else if (name.includes('x86_64') && name.includes('.dmg')) {
              platform = 'macos-intel'
            } else if (name.includes('.msi') || name.includes('.exe')) {
              platform = 'windows'
            } else if (name.includes('.appimage')) {
              platform = 'linux'
            } else {
              return null
            }

            return {
              name: asset.name,
              downloadUrl: asset.browser_download_url,
              platform,
              size: asset.size,
            }
          })
          .filter(Boolean)

        setAssets(platformAssets)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch release')
        setAssets([])
      } finally {
        setLoading(false)
      }
    }

    fetchRelease()
  }, [])

  return { version, assets, loading, error }
}
