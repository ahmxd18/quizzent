import { LockKeyhole } from 'lucide-react'
import { Card } from '../../../components/ui/Card'
import { LoginForm } from './LoginForm'

export function LoginPanel() {
  return (
    <Card className="p-7 sm:p-10">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand"><LockKeyhole size={23} aria-hidden="true" /></span>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Welcome back.</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">Log in to your organiser space.</p>
      <LoginForm />
    </Card>
  )
}
