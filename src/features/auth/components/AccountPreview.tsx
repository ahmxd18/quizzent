import { ArrowUpRight, LockKeyhole, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { TextField } from '../../../components/ui/TextField'

type AccountPreviewProps = { mode: 'login' | 'signup' }

export function AccountPreview({ mode }: AccountPreviewProps) {
  const isSignup = mode === 'signup'
  const Icon = isSignup ? Plus : LockKeyhole

  return (
    <Card className="p-7 sm:p-10">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon size={23} aria-hidden="true" /></span>
        <Badge>Coming soon</Badge>
      </div>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{isSignup ? 'Set the challenge.' : 'Welcome back.'}</h1>
      <p id="account-availability" className="mt-3 text-sm leading-relaxed text-muted">{isSignup ? 'Bring your questions and your people. Organiser accounts are coming next.' : 'Your next competition starts here. Organiser sign-in will be available soon.'}</p>
      <fieldset disabled aria-describedby="account-availability" className="mt-7 space-y-5">
        {isSignup && <TextField label="Your name" name="displayName" autoComplete="name" placeholder="What should we call you?" />}
        <TextField label="Email address" name="email" type="email" autoComplete="email" placeholder="you@example.com" />
        <TextField label="Password" name="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder={isSignup ? 'Choose a strong password' : 'Your password'} />
        <Button disabled className="w-full">{isSignup ? 'Create organiser account' : 'Log in'} <ArrowUpRight size={17} aria-hidden="true" /></Button>
      </fieldset>
      <p className="mt-7 text-center text-sm text-muted">
        {isSignup ? 'Already have an account? ' : 'New to organising? '}
        <Link to={isSignup ? '/login' : '/signup'} className="rounded-sm font-semibold text-brand underline underline-offset-4">{isSignup ? 'Log in' : 'Create an account'}</Link>
      </p>
    </Card>
  )
}
