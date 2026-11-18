import { useState } from 'react'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { RequestError } from '../../../components/ui/RequestError'
import { TextField } from '../../../components/ui/TextField'
import type { AdminAction } from '../api/admin'
import { useAdminAction } from '../hooks/useAdmin'

export function AdminActionDialog({ action, dismiss, onSaved }: {
  action: AdminAction
  dismiss: () => void
  onSaved: (message: string) => void
}) {
  const [reason, setReason] = useState('')
  const mutation = useAdminAction()
  const cancelling = action.kind === 'cancelRoom'
  let verb = 'Cancel competition'
  let description = 'Guests will see your reason, and play will stop immediately.'
  if (action.kind === 'status') {
    verb = action.value === 'suspended' ? 'Suspend account' : 'Reactivate account'
    description = action.value === 'suspended' ? 'This account will be signed out and blocked from signing in.' : 'This account will be able to sign in again.'
  } else if (action.kind === 'role') {
    verb = action.value === 'superadmin' ? 'Grant superadmin access' : 'Return to organiser'
    description = action.value === 'superadmin'
      ? 'This account will be able to manage other accounts and cancel any room. They must sign in again.'
      : 'This account will lose access to admin tools and must sign in again.'
  }

  return <ConfirmDialog open title={verb} description={description} confirmLabel={verb} cancelLabel="Go back"
    pending={mutation.isPending} confirmDisabled={cancelling && !reason.trim()} onCancel={dismiss}
    onConfirm={() => mutation.mutate({ action, reason: reason.trim() }, { onSuccess: result => onSaved(result.message) })}>
    <div className="mt-4 space-y-4">
      <p className="break-words text-sm font-semibold">{action.label}</p>
      <RequestError error={mutation.error} />
      {cancelling && <TextField label="Reason for cancelling" value={reason} disabled={mutation.isPending}
        maxLength={200} onChange={event => setReason(event.target.value)} />}
    </div>
  </ConfirmDialog>
}
