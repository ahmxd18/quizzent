import { useEffect, useRef, type FormEvent } from 'react'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../../../components/ui/Button'
import { TextField } from '../../../components/ui/TextField'
import { ApiError } from '../../../lib/http'
import { useLogin } from '../hooks/useLogin'

export function LoginForm() {
  const mutation = useLogin()
  const navigate = useNavigate()
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (mutation.error) errorRef.current?.focus() }, [mutation.error])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const values = new FormData(event.currentTarget)
    mutation.mutate({ email: String(values.get('email') ?? ''), password: String(values.get('password') ?? '') },
      { onSuccess: () => navigate('/organiser', { replace: true }) })
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-5" aria-busy={mutation.isPending}>
      {mutation.error && <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-xl border border-danger p-4 text-sm text-danger">
        {mutation.error instanceof ApiError ? mutation.error.message : 'Could not reach the server. Check your connection and try again.'}
      </div>}
      <fieldset disabled={mutation.isPending} className="space-y-5">
        <TextField label="Email address" name="email" type="email" required maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" />
        <TextField label="Password" name="password" type="password" required maxLength={128} autoComplete="current-password" placeholder="Your password" />
        <Button type="submit" disabled={mutation.isPending} className="w-full">
          {mutation.isPending ? <><LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Logging in…</> : <>Log in <ArrowUpRight size={17} aria-hidden="true" /></>}
        </Button>
      </fieldset>
      <p className="text-center text-sm text-muted">New to organising? <Link to="/signup" className="rounded-sm font-semibold text-brand underline underline-offset-4">Create an account</Link></p>
    </form>
  )
}
