import { useEffect, useId, useRef, type ReactNode } from 'react'

type ModalProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  dismissible?: boolean
  children: ReactNode
}

export function Modal({ isOpen, onClose, title, description, dismissible = true, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  const pointerStartedOutside = useRef(false)
  useEffect(() => {
    const dialog = ref.current
    if (!isOpen || !dialog) return
    const previousFocus = document.activeElement as HTMLElement | null
    dialog.showModal()
    return () => {
      dialog.close()
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [isOpen])

  function outside(x: number, y: number) {
    const bounds = ref.current?.getBoundingClientRect()
    return !!bounds && (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom)
  }

  return (
    <dialog ref={ref} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined}
      onCancel={event => { event.preventDefault(); if (dismissible) onClose() }}
      onPointerDown={event => { pointerStartedOutside.current = event.target === event.currentTarget && outside(event.clientX, event.clientY) }}
      onClick={event => {
        if (dismissible && pointerStartedOutside.current && outside(event.clientX, event.clientY)) onClose()
        pointerStartedOutside.current = false
      }}
      className="m-auto max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-card border border-outline bg-surface p-6 text-foreground shadow-card backdrop:bg-foreground/35 sm:p-7">
      <h2 id={`${id}-title`} className="text-xl font-semibold">{title}</h2>
      {description && <p id={`${id}-description`} className="mt-3 text-sm leading-relaxed text-muted">{description}</p>}
      {children}
    </dialog>
  )
}
