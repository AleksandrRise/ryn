const API_BASE =
  process.env.NEXT_PUBLIC_RYN_API_URL || "http://127.0.0.1:4317"

export async function invoke<T>(
  command: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}/api/tauri`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command, args }),
  })

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`)
  }

  const json = (await res.json()) as { ok: boolean; result?: T; error?: string }
  if (!json.ok) {
    throw new Error(json.error || "Unknown backend error")
  }
  return json.result as T
}
