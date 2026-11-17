import { useEffect, useState } from 'react'

export function useQuestionCountdown(time: { deadlineAt: string; serverNow: string; receivedAt: number }) {
  const expires = time.receivedAt + Date.parse(time.deadlineAt) - Date.parse(time.serverNow)
  const [now, setNow] = useState(() => performance.now())
  const seconds = Math.max(0, Math.ceil((expires - Math.max(now, time.receivedAt)) / 1000))
  const running = seconds > 0

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(timer)
  }, [running])

  return seconds
}
