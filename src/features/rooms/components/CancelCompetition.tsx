import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { RequestError } from '../../../components/ui/RequestError'
import { TextField } from '../../../components/ui/TextField'
import { useRoomActions } from '../hooks/useRooms'

export function CancelCompetition({ roomId, disconnected }: { roomId: string; disconnected: boolean }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const { cancel } = useRoomActions(roomId)
  const note = reason.trim()

  function confirm() {
    if (cancel.isPending || disconnected || !note) return
    cancel.mutate(note, { onSuccess: () => setOpen(false) })
  }

  return (
    <>
      <Button variant="ghost" size="sm" disabled={disconnected} onClick={() => setOpen(true)}>Cancel competition</Button>
      <ConfirmDialog
        open={open}
        title="Cancel this competition?"
        description="This ends the quiz for everyone. Guests will see your reason."
        confirmLabel="Cancel competition"
        cancelLabel="Keep playing"
        pending={cancel.isPending}
        confirmDisabled={disconnected || !note}
        onCancel={() => { cancel.reset(); setOpen(false) }}
        onConfirm={confirm}
      >
        <div className="mt-4 space-y-3">
          <RequestError error={cancel.error} />
          <TextField label="Reason for cancelling" value={reason} maxLength={200} disabled={cancel.isPending}
            onChange={event => setReason(event.target.value)} />
        </div>
      </ConfirmDialog>
    </>
  )
}
