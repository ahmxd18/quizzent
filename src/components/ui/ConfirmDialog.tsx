import { useEffect, useId, useRef } from 'react'
import { Button } from './Button'

type ConfirmDialogProps = {
  open: boolean; title: string; description: string
  onConfirm: () => void; onCancel: () => void
  confirmLabel?: string; cancelLabel?: string; pending?: boolean
}

export function ConfirmDialog({ open, title, description, onConfirm, onCancel, confirmLabel = 'Discard changes', cancelLabel = 'Keep editing', pending = false }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal()
    else if (!open && ref.current?.open) ref.current.close()
  }, [open])
  return (
    <dialog ref={ref} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={event => { event.preventDefault(); if (!pending) onCancel() }}
      className="m-auto w-full max-w-md rounded-card border border-outline bg-surface p-7 text-foreground shadow-card backdrop:bg-foreground/35">
      <h2 id={`${id}-title`} className="text-xl font-semibold">{title}</h2>
      <p id={`${id}-description`} className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Button onClick={onCancel} autoFocus disabled={pending}>{cancelLabel}</Button>
        <Button variant="secondary" onClick={onConfirm} disabled={pending}>{pending ? 'Working…' : confirmLabel}</Button>
      </div>
    </dialog>
  )
}
