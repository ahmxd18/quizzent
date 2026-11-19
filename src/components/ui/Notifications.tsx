import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Check, CircleAlert, Info, X } from 'lucide-react'
import { notificationStore, type Notification } from '../../lib/notifications'

const tones = {
  success: { icon: Check, style: 'border-success text-success', duration: 4500 },
  error: { icon: CircleAlert, style: 'border-danger text-danger', duration: 8000 },
  info: { icon: Info, style: 'border-brand text-brand', duration: 5500 },
}

function Toast({ item }: { item: Notification }) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const { icon: Icon, style, duration } = tones[item.tone]
  useEffect(() => {
    if (hovered || focused) return
    const timer = window.setTimeout(() => notificationStore.dismiss(item.id), duration)
    return () => window.clearTimeout(timer)
  }, [duration, hovered, focused, item.id])
  return <div className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface p-4 shadow-card ${style}`}
    onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <Icon aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
    <p role={item.tone === 'error' ? 'alert' : 'status'} className="min-w-0 flex-1 break-words text-sm">{item.message}</p>
    <button type="button" className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-surface-strong"
      aria-label="Dismiss notification" onClick={() => notificationStore.dismiss(item.id)}><X size={16} /></button>
  </div>
}

export function Notifications() {
  const items = useSyncExternalStore(notificationStore.subscribe, notificationStore.snapshot)
  const [host, setHost] = useState<Element>(document.body)
  useEffect(() => {
    const observer = new MutationObserver(() => setHost(document.querySelector('dialog[open]') ?? document.body))
    observer.observe(document.body, { attributes: true, attributeFilter: ['open'], childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  if (!items.length) return null
  // Native dialogs make the rest of the page inert. Place feedback within the active dialog.
  return createPortal(
    <div aria-label="Notifications" className="pointer-events-none fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md flex-col gap-3">
      {items.map(item => <Toast key={item.id} item={item} />)}
    </div>, host,
  )
}
