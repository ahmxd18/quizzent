import { useEffect, useRef, type FormEvent } from 'react'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '../../../components/ui/Button'
import { TextField } from '../../../components/ui/TextField'
import { ApiError } from '../../../lib/http'
import { useSignup } from '../hooks/useSignup'

export function SignupForm({ onCreated }: { onCreated: (displayName: string) => void }) {
  const mutation = useSignup()
  const errorRef = useRef<HTMLDivElement>(null)
  const errors = mutation.error instanceof ApiError ? mutation.error.fieldErrors : {}

  useEffect(() => {
    if (mutation.error) errorRef.current?.focus()
  }, [mutation.error])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const values = new FormData(event.currentTarget)
    mutation.mutate({
      displayName: String(values.get('displayName') ?? ''),
      email: String(values.get('email') ?? ''),
      password: String(values.get('password') ?? ''),
    }, { onSuccess: ({ user }) => onCreated(user.displayName) })
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-5" aria-busy={mutation.isPending}>
      {mutation.error && (
        <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-xl border border-danger p-4 text-sm leading-relaxed text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : 'Could not reach the server. Check your connection and try again.'}
        </div>
      )}
      <fieldset disabled={mutation.isPending} className="space-y-5">
        <TextField label="Your name" name="displayName" required maxLength={80} autoComplete="name" placeholder="What should we call you?" error={errors.displayName} />
        <TextField label="Email address" name="email" type="email" required maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" error={errors.email} />
        <TextField label="Password" name="password" type="password" required minLength={15} maxLength={128} autoComplete="new-password" placeholder="Choose a long passphrase" hint="15–128 characters. Spaces are welcome." error={errors.password} />
        <Button type="submit" disabled={mutation.isPending} className="w-full">
          {mutation.isPending ? <><LoaderCircle className="animate-spin motion-reduce:animate-none" size={17} aria-hidden="true" />Creating your account…</> : <>Create organiser account <ArrowUpRight size={17} aria-hidden="true" /></>}
        </Button>
      </fieldset>
      <p className="text-center text-sm text-muted">Already have an account? <Link to="/login" className="rounded-sm font-semibold text-brand underline underline-offset-4">Log in</Link></p>
      <p className="text-center text-xs leading-relaxed text-muted">Account creation is available now. Organiser sign-in is coming next.</p>
    </form>
  )
}
