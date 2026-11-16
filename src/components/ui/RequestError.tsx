import { useEffect, useRef } from 'react'
import { ApiError } from '../../lib/http'

export function RequestError({ error, fallback = 'Could not reach the server. Please try again.' }: { error: Error | null; fallback?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (error) ref.current?.focus() }, [error])
  if (!error) return null
  return <div ref={ref} role="alert" tabIndex={-1} className="rounded-xl border border-danger p-4 text-sm leading-relaxed text-danger">{error instanceof ApiError ? error.message : fallback}</div>
}
