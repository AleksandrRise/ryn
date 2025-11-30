export type UnlistenFn = () => void
type EventListenerFn = (event: Event) => void

const bus = typeof window !== "undefined" ? new EventTarget() : null

export async function listen<T>(
  event: string,
  handler: (event: { event: string; id: number; payload: T }) => void
): Promise<UnlistenFn> {
  if (!bus) return () => {}
  const wrapped: EventListenerFn = (e) => {
    const detail = (e as CustomEvent<T>).detail
    handler({ event, id: Date.now(), payload: detail })
  }
  bus.addEventListener(event, wrapped)
  return () => bus.removeEventListener(event, wrapped)
}

export async function emit<T>(event: string, payload?: T): Promise<void> {
  if (!bus) return
  bus.dispatchEvent(new CustomEvent(event, { detail: payload }))
}
