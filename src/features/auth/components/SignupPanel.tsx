import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { SignupForm } from './SignupForm'
import { SignupSuccess } from './SignupSuccess'

export function SignupPanel() {
  const [createdName, setCreatedName] = useState<string | null>(null)

  // Unmount the form on success so its password field and mutation can be released.
  if (createdName !== null) return <SignupSuccess displayName={createdName} />

  return (
    <Card className="p-7 sm:p-10">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand"><Plus size={23} aria-hidden="true" /></span>
        <Badge tone="brand">For organisers</Badge>
      </div>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Set the challenge.</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">Bring your questions and your people. Create your organiser account to get started.</p>
      <SignupForm onCreated={setCreatedName} />
    </Card>
  )
}
