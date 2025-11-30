export async function open(url: string): Promise<void> {
  if (typeof window === "undefined") return
  window.open(url, "_blank", "noopener,noreferrer")
}
