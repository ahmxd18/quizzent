import { useCallback, useRef } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router'

export function useUnsavedChanges(dirty: boolean) {
  const saved = useRef(false)
  const blocker = useBlocker(() => dirty && !saved.current)
  useBeforeUnload(useCallback(event => {
    if (!dirty || saved.current) return
    event.preventDefault()
    event.returnValue = ''
  }, [dirty]))
  // A completed save may navigate away without prompting about its old form state.
  return {
    blocked: blocker.state === 'blocked',
    keepEditing: () => { if (blocker.state === 'blocked') blocker.reset() },
    discardChanges: () => { if (blocker.state === 'blocked') blocker.proceed() },
    allowSavedNavigation: () => { saved.current = true },
  }
}
