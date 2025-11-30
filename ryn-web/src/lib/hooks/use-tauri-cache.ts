import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Cache entry with timestamp for TTL tracking
 */
interface CacheEntry<T> {
  data: T
  timestamp: number
}

/**
 * Global cache store (shared across all hook instances)
 * Key format: `commandName:paramHash`
 */
const globalCache = new Map<string, CacheEntry<unknown>>()

/**
 * Simple hash function for parameters
 * @param params Object to hash
 * @returns Hash string
 */
function hashParams(params: unknown): string {
  try {
    return JSON.stringify(params)
  } catch {
    return String(params)
  }
}

/**
 * Hook for caching Tauri IPC command results
 * Prevents duplicate calls during the same render cycle and within TTL period
 *
 * @param commandName - Name of the Tauri command
 * @param params - Parameters passed to the command
 * @param fetchFn - Async function that fetches the data from Tauri
 * @param ttl - Time to live in milliseconds (default: 5000ms)
 * @returns Object with { data, loading, error, refetch, invalidate }
 */
export function useTauriCache<T>(
  commandName: string,
  params: Record<string, unknown> | undefined,
  fetchFn: () => Promise<T>,
  ttl: number = 5000
) {
  const cacheKey = `${commandName}:${hashParams(params)}`
  const cachedEntry = globalCache.get(cacheKey)
  // eslint-disable-next-line react-hooks/purity
  const cachedFresh = cachedEntry ? Date.now() - cachedEntry.timestamp < ttl : false

  const [data, setData] = useState<T | null>(() => (cachedFresh ? (cachedEntry?.data as T) : null))
  const [loading, setLoading] = useState(() => !cachedFresh)
  const [error, setError] = useState<Error | null>(null)
  const cacheKeyRef = useRef<string>("")
  const isMountedRef = useRef(true)

  useEffect(() => {
    cacheKeyRef.current = cacheKey
  }, [cacheKey])

  // Check cache on mount and when params change
  useEffect(() => {
    isMountedRef.current = true

    const cached = globalCache.get(cacheKey)
    const now = Date.now()

    // If cached data exists and hasn't expired, use it
    if (cached && now - cached.timestamp < ttl) {
      if (isMountedRef.current) {
        setData(cached.data as T)
        setLoading(false)
        setError(null)
      }
      return
    }

    // Otherwise, fetch fresh data
    let cancelled = false

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const result = await fetchFn()

        if (!cancelled && isMountedRef.current) {
          // Cache the result
          globalCache.set(cacheKey, {
            data: result,
            timestamp: Date.now(),
          })

          setData(result)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled && isMountedRef.current) {
          const error = err instanceof Error ? err : new Error(String(err))
          setError(error)
          setLoading(false)
        }
      }
    }

    void fetchData()

    return () => {
      cancelled = true
    }
  }, [cacheKey, fetchFn, ttl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const refetch = useCallback(async () => {
    if (!isMountedRef.current) return

    try {
      setLoading(true)
      setError(null)

      const result = await fetchFn()

      if (isMountedRef.current) {
        // Update cache with fresh data
        globalCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
        })

        setData(result)
        setLoading(false)
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        setLoading(false)
      }
    }
  }, [cacheKey, fetchFn])

  const invalidate = useCallback(() => {
    globalCache.delete(cacheKey)
  }, [cacheKey])

  return { data, loading, error, refetch, invalidate }
}

/**
 * Invalidate a specific cache entry
 * @param commandName - Name of the Tauri command
 * @param params - Parameters passed to the command
 */
export function invalidateTauriCache(commandName: string, params: any): void {
  const cacheKey = `${commandName}:${hashParams(params)}`
  globalCache.delete(cacheKey)
}

/**
 * Invalidate all cache entries for a specific command
 * @param commandName - Name of the Tauri command to invalidate
 */
export function invalidateTauriCacheByCommand(commandName: string): void {
  const keysToDelete: string[] = []

  for (const key of globalCache.keys()) {
    if (key.startsWith(`${commandName}:`)) {
      keysToDelete.push(key)
    }
  }

  keysToDelete.forEach(key => globalCache.delete(key))
}

/**
 * Clear all cache entries
 */
export function clearTauriCache(): void {
  globalCache.clear()
}

/**
 * Get cache statistics (useful for debugging)
 */
export function getTauriCacheStats(): {
  size: number
  entries: Array<{ key: string; age: number }>
} {
  const now = Date.now()
  const entries: Array<{ key: string; age: number }> = []

  for (const [key, value] of globalCache.entries()) {
    entries.push({
      key,
      age: now - value.timestamp,
    })
  }

  return {
    size: globalCache.size,
    entries: entries.sort((a, b) => b.age - a.age),
  }
}
