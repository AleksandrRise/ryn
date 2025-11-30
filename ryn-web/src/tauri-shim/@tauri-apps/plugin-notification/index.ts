export async function isPermissionGranted(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false
  return Notification.permission === "granted"
}

type NotificationPermissionValue = "default" | "denied" | "granted"

export async function requestPermission(): Promise<NotificationPermissionValue> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied"
  return Notification.requestPermission()
}

interface NotificationOptions {
  title: string
  body?: string
}

export async function sendNotification(opts: NotificationOptions): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return
  const granted = await isPermissionGranted()
  if (!granted) return
  new Notification(opts.title, { body: opts.body })
}
