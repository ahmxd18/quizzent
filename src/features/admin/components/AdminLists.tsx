import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import type { Account, ActiveRoom, AdminAction, AuditEntry } from '../api/admin'

type SelectAction = (action: AdminAction) => void

export function AdminAccounts({ accounts, viewerId, select }: { accounts: Account[]; viewerId: string; select: SelectAction }) {
  return <section aria-labelledby="admin-accounts" className="space-y-3">
    <h2 id="admin-accounts" className="font-display text-2xl">Accounts</h2>
    <Card className="overflow-hidden">
      {!accounts.length && <p className="p-5 text-sm text-muted">No matching accounts.</p>}
      <ul className="divide-y divide-outline">
        {accounts.map(account => {
          const own = account.id === viewerId
          const suspend = account.status === 'active'
          const promote = account.role === 'organiser'
          const target = { id: account.id, label: account.email }
          return <li key={account.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0 space-y-2">
              <p className="break-words font-semibold">{account.displayName}{own ? ' (you)' : ''}</p>
              <p className="break-words text-sm text-muted">{account.email}</p>
              <div className="flex flex-wrap gap-2">
                <Badge tone={promote ? 'neutral' : 'accent'}>{promote ? 'Organiser' : 'Superadmin'}</Badge>
                <Badge tone={suspend ? 'brand' : 'neutral'}>{suspend ? 'Active' : 'Suspended'}</Badge>
                {account.hostingRestricted && <Badge>Hosting restricted</Badge>}
                {account.weeklyHostingLimit !== null && <Badge>{account.weeklyHostingLimit} rooms/week</Badge>}
              </div>
            </div>
            {!own && <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={account.role === 'superadmin'} onClick={() => select({ ...target, kind: 'status', value: suspend ? 'suspended' : 'active' })}>
                {suspend ? 'Suspend' : 'Reactivate'}
              </Button>
              <Button variant="ghost" size="sm" disabled={promote && account.status === 'suspended'} onClick={() => select({ ...target, kind: 'role', value: promote ? 'superadmin' : 'organiser' })}>
                {promote ? 'Make superadmin' : 'Make organiser'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => select({ ...target, kind: 'hosting', restricted: account.hostingRestricted, weeklyLimit: account.weeklyHostingLimit })}>
                Hosting policy
              </Button>
            </div>}
          </li>
        })}
      </ul>
    </Card>
  </section>
}

export function AdminRooms({ rooms, select }: { rooms: ActiveRoom[]; select: SelectAction }) {
  return <section aria-labelledby="admin-rooms" className="space-y-3">
    <h2 id="admin-rooms" className="font-display text-2xl">Open rooms</h2>
    <Card className="overflow-hidden">
      {!rooms.length && <p className="p-5 text-sm text-muted">No matching open rooms.</p>}
      <ul className="divide-y divide-outline">
        {rooms.map(room => <li key={room.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="min-w-0 space-y-2">
            <p className="break-words font-semibold">{room.title}</p>
            <p className="break-words text-sm text-muted">{room.code} · {room.organiserEmail}</p>
            <Badge tone={room.startedAt ? 'accent' : 'neutral'}>{room.startedAt ? 'In progress' : 'Waiting lobby'}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => select({ kind: 'cancelRoom', id: room.id, label: `${room.title} (${room.code})` })}>
            Cancel competition
          </Button>
        </li>)}
      </ul>
    </Card>
  </section>
}

const auditTitles = { bootstrap: 'First superadmin added', role_changed: 'Role changed', status_changed: 'Status changed', room_cancelled: 'Competition cancelled', hosting_changed: 'Hosting policy changed' }

export function AdminAudit({ actions }: { actions: AuditEntry[] }) {
  return <section aria-labelledby="admin-audit" className="space-y-3">
    <h2 id="admin-audit" className="font-display text-2xl">Recent admin activity</h2>
    <Card className="overflow-hidden">
      {!actions.length && <p className="p-5 text-sm text-muted">No admin changes yet.</p>}
      <ul className="divide-y divide-outline">
        {actions.map(entry => <li key={entry.id} className="space-y-1 p-5 text-sm">
          <p className="break-words font-semibold">{auditTitles[entry.action]} · {entry.targetLabel}</p>
          <p className="break-words text-muted">{entry.detail}</p>
          <p className="break-words text-xs text-muted">{entry.actorLabel} · <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time></p>
        </li>)}
      </ul>
    </Card>
  </section>
}
