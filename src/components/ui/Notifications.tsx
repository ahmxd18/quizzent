import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Check, CircleAlert, Info } from 'lucide-react'
import { notificationStore, type Notification } from '../../lib/notifications'

const tones = {
  success: { icon: Check, iconStyle: 'bg-success/10 text-success', line: 'bg-success', label: 'Success', duration: 4500 },
  error: { icon: CircleAlert, iconStyle: 'bg-danger/10 text-danger', line: 'bg-danger', label: 'Error', duration: 8000 },
  info: { icon: Info, iconStyle: 'bg-brand-soft text-brand', line: 'bg-brand', label: 'Information', duration: 5500 },
}

function Toast({ item }: { item: Notification }) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const lineRef = useRef<HTMLSpanElement>(null)
  const countdown = useRef<Animation | null>(null)
  const { icon: Icon, iconStyle, line, label, duration } = tones[item.tone]
  useEffect(() => {
    const animation = lineRef.current?.animate(
      [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
      { duration, easing: 'linear', fill: 'forwards' },
    )
    if (!animation) return
    countdown.current = animation
    animation.onfinish = () => notificationStore.dismiss(item.id)
    return () => { animation.cancel(); countdown.current = null }
  }, [duration, item.id])
  useEffect(() => {
    if (hovered || focused) countdown.current?.pause()
    else countdown.current?.play()
  }, [hovered, focused])
  return <div className="toast-enter pointer-events-auto relative overflow-hidden rounded-2xl border border-outline bg-surface shadow-card"
    onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <span role={item.tone === 'error' ? 'alert' : 'status'} className="sr-only">{item.message}</span>
    <button type="button" className="flex w-full items-start gap-3 px-4 pb-5 pt-4 text-left transition-colors hover:bg-canvas focus-visible:outline-offset-[-4px]"
      aria-label={`Dismiss notification: ${item.message}`} onClick={() => notificationStore.dismiss(item.id)}>
      <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${iconStyle}`}><Icon aria-hidden="true" size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold tracking-wide text-muted">{label}</span>
        <span className="mt-1 block break-words text-sm leading-relaxed text-foreground">{item.message}</span>
      </span>
    </button>
    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-surface-strong">
      <span ref={lineRef} className={`block h-full w-full origin-left ${line}`} />
    </span>
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
    <div aria-label="Notifications" className="pointer-events-none fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3">
      {items.map(item => <Toast key={item.id} item={item} />)}
    </div>, host,
  )
}
