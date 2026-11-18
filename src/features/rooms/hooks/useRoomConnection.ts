import { useSyncExternalStore } from 'react'
import { onlineManager } from '@tanstack/react-query'
import { ApiError } from '../../../lib/http'

export const roomPollMs = 4000

const subscribe = (onChange: () => void) => onlineManager.subscribe(onChange)
const isOnline = () => onlineManager.isOnline()

export function roomRequestFailed(error: Error | null) {
  return error !== null && (!(error instanceof ApiError) || error.status >= 500)
}

export function useRoomConnectionIssue(error: Error | null, paused: boolean) {
  const online = useSyncExternalStore(subscribe, isOnline)
  return !online || paused || roomRequestFailed(error)
}
