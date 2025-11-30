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

function parseToLocalDate(value?: string | Date | null): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  // If the string already has a timezone (Z or +/-hh:mm), parse as-is.
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value)

  // SQLite defaults like "2025-02-01 10:00:00" are UTC without a TZ marker.
  // Normalize to ISO and append Z so it converts to the user's local time.
  if (!hasTz) {
    const isoish = value.includes("T") ? value : value.replace(" ", "T")
    return new Date(`${isoish}Z`)
  }

  return new Date(value)
}

export function formatDateTime(value?: string | Date | null): string {
  const timestamp = parseToLocalDate(value)
  if (!timestamp || Number.isNaN(timestamp.getTime())) return "Unknown"
  return `${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}`
}
