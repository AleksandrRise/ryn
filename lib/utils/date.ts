export function formatRelativeTime(timestamp?: string | number | Date | null): string {
  if (!timestamp) return "unknown"

  const now = new Date()
  const target = typeof timestamp === "string" || typeof timestamp === "number"
    ? new Date(timestamp)
    : timestamp

  const diffMs = now.getTime() - target.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "Unknown"
  const timestamp = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(timestamp.getTime())) return "Unknown"
  return `${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}`
}
