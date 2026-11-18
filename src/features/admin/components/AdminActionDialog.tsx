import { useRef, useState } from 'react'
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
  const [password, setPassword] = useState('')
  const [restricted, setRestricted] = useState(action.kind === 'hosting' && action.restricted)
  const [limit, setLimit] = useState(action.kind === 'hosting' ? String(action.weeklyLimit ?? '') : '')
  const pendingPassword = useRef('')
  const mutation = useAdminAction(() => {
    const current = pendingPassword.current
    pendingPassword.current = ''
    return current
  })
  const cancelling = action.kind === 'cancelRoom'
  const weeklyLimit = limit === '' ? null : Number(limit)
  const invalidLimit = weeklyLimit !== null && (!/^\d+$/.test(limit) || !Number.isInteger(weeklyLimit) || weeklyLimit > 2147483647)
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
  } else if (action.kind === 'hosting') {
    verb = 'Save hosting policy'
    description = 'Hosting settings affect new rooms. The account can still sign in and view its history.'
  }

  return <ConfirmDialog open title={verb} description={description} confirmLabel={verb} cancelLabel="Go back"
    pending={mutation.isPending} confirmDisabled={(cancelling && !reason.trim()) || (action.kind === 'role' && !password) || invalidLimit} onCancel={dismiss}
    onConfirm={() => {
      pendingPassword.current = password
      mutation.mutate({ action, reason: reason.trim(), restricted, weeklyLimit }, { onSuccess: result => onSaved(result.message) })
      setPassword('')
    }}>
    <div className="mt-4 space-y-4">
      <p className="break-words text-sm font-semibold">{action.label}</p>
      <RequestError error={mutation.error} />
      {cancelling && <TextField label="Reason for cancelling" value={reason} disabled={mutation.isPending}
        maxLength={200} onChange={event => setReason(event.target.value)} />}
      {action.kind === 'role' && <TextField label="Your current password" type="password" autoComplete="current-password"
        value={password} maxLength={128} disabled={mutation.isPending} onChange={event => setPassword(event.target.value)} />}
      {action.kind === 'hosting' && <>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="accent-brand" checked={restricted} disabled={mutation.isPending}
            onChange={event => setRestricted(event.target.checked)} />
          Restrict new room hosting
        </label>
        <TextField label="Weekly hosting limit" type="number" min={0} max={2147483647} step={1} value={limit}
          disabled={mutation.isPending} onChange={event => setLimit(event.target.value)}
          hint="Leave blank for unlimited. The week resets Monday at 00:00 UTC."
          error={invalidLimit ? 'Enter a non-negative whole number within the supported range.' : undefined} />
      </>}
    </div>
  </ConfirmDialog>
}
