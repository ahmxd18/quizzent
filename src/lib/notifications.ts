type Tone = 'success' | 'error' | 'info'
export type Notification = { id: number; message: string; tone: Tone }
let items: Notification[] = []
let nextId = 0
const listeners = new Set<() => void>()

function emit() { for (const listener of listeners) listener() }
function show(tone: Tone, message: string) {
  const existing = items.find(item => item.tone === tone && item.message === message)
  if (existing) return existing.id
  const id = ++nextId
  items = [...items.slice(-3), { id, tone, message }]
  emit()
  return id
}

export const notify = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message),
  info: (message: string) => show('info', message),
}
export const notificationStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  snapshot: () => items,
  dismiss(id: number) { items = items.filter(item => item.id !== id); emit() },
}
