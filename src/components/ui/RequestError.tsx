import { useEffect } from 'react'
import { ApiError } from '../../lib/http'
import { notificationStore, notify } from '../../lib/notifications'

export function RequestError({ error, fallback = 'Could not reach the server. Please try again.' }: { error: Error | null; fallback?: string }) {
  useEffect(() => {
    if (!error) return
    const id = notify.error(error instanceof ApiError ? error.message : fallback)
    return () => notificationStore.dismiss(id)
  }, [error, fallback])
  return null
}
