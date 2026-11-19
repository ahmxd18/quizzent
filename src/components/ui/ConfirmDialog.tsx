import type { ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

type ConfirmDialogProps = {
  open: boolean; title: string; description: string
  onConfirm: () => void; onCancel: () => void
  confirmLabel?: string; cancelLabel?: string; pending?: boolean
  confirmDisabled?: boolean; children?: ReactNode
}

export function ConfirmDialog({ open, title, description, onConfirm, onCancel, confirmLabel = 'Discard changes', cancelLabel = 'Keep editing', pending = false, confirmDisabled = false, children }: ConfirmDialogProps) {
  return (
    <Modal isOpen={open} title={title} description={description} onClose={onCancel} dismissible={!pending}>
      {children}
      <div className="mt-7 flex flex-wrap gap-3">
        <Button onClick={onCancel} autoFocus disabled={pending}>{cancelLabel}</Button>
        <Button variant="secondary" onClick={onConfirm} disabled={pending || confirmDisabled}>{pending ? 'Working…' : confirmLabel}</Button>
      </div>
    </Modal>
  )
}
