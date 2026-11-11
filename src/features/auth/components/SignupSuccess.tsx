import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { ButtonLink } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'

export function SignupSuccess({ displayName }: { displayName: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [])

  return (
    <Card className="p-7 sm:p-10">
      <Badge tone="accent"><Check size={15} aria-hidden="true" />Account created</Badge>
      <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-3xl font-semibold tracking-tight focus-visible:outline-none">You’re an organiser.</h1>
      <p className="mt-4 break-words text-sm leading-relaxed text-muted">Your account is ready, {displayName}. Log in to open your organiser space.</p>
      <ButtonLink to="/login" className="mt-7">Continue to login</ButtonLink>
    </Card>
  )
}
