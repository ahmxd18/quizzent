import { useEffect, useRef, useState } from 'react'
import { Check, LockKeyhole } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { ApiError } from '../../../lib/http'
import type { Competition } from '../api/competitions'
import { usePublishCompetition } from '../hooks/usePublishCompetition'

export function PublishCompetitionPanel({ competition, count, disabled }: { competition: Competition; count: number; disabled: boolean }) {
  const [confirming, setConfirming] = useState(false)
  const mutation = usePublishCompetition(competition.id)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const published = competition.status === 'published'
  useEffect(() => { if (mutation.error) errorRef.current?.focus() }, [mutation.error])
  useEffect(() => { if (published && mutation.isSuccess) headingRef.current?.focus() }, [published, mutation.isSuccess])
  return <>
    <Card className={`p-6 sm:p-8 ${published ? 'border-success' : ''}`}>
      <div className="flex items-center gap-3 text-brand">{published ? <Check size={22} aria-hidden="true" /> : <LockKeyhole size={22} aria-hidden="true" />}<h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold">{published ? 'Published and ready for your next step.' : 'Ready to publish?'}</h2></div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{published ? 'Your questions, answers, and timing settings are locked. This competition remains in your organiser workspace; opening a live room comes next.' : 'Review every question and correct answer first. Publishing locks the competition details, question content, and time limit.'}</p>
      {mutation.error && <p ref={errorRef} tabIndex={-1} role="alert" className="mt-4 text-sm text-danger">{mutation.error instanceof ApiError ? mutation.error.message : 'Could not confirm publication. Check your connection, refresh to check its status, and try again if needed.'}</p>}
      {!published && <div className="mt-5 flex flex-wrap items-center gap-4"><Button disabled={disabled || count === 0 || mutation.isPending} onClick={() => setConfirming(true)}>Publish competition</Button><span className="text-xs text-muted">{disabled ? 'Finish editing and save your questions first.' : count === 0 ? 'Save at least one question to publish.' : `${count} saved ${count === 1 ? 'question' : 'questions'} · No room opens yet`}</span></div>}
    </Card>
    <ConfirmDialog open={confirming} title="Publish and lock this competition?" description="You won’t be able to edit its details, questions, correct answers, or timing after publishing. This does not open a live room." confirmLabel="Publish and lock" cancelLabel="Keep reviewing" pending={mutation.isPending} onCancel={() => setConfirming(false)} onConfirm={() => { if (!mutation.isPending) mutation.mutate(undefined, { onSuccess: () => setConfirming(false), onError: () => setConfirming(false) }) }} />
  </>
}
