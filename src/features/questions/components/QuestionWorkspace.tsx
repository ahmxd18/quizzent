import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { RequestError } from '../../../components/ui/RequestError'
import { notify } from '../../../lib/notifications'
import type { Competition } from '../../competitions/api/competitions'
import type { Question } from '../api/questions'
import { useQuestionActions, useQuestions } from '../hooks/useQuestions'
import { QuestionCard } from './QuestionCard'
import { QuestionForm } from './QuestionForm'
import { PublishCompetitionPanel } from '../../competitions/components/PublishCompetitionPanel'

export function QuestionWorkspace({ competition }: { competition: Competition }) {
  const query = useQuestions(competition.id, true)
  const [editing, setEditing] = useState<Question | 'new' | null>(null)
  const [removing, setRemoving] = useState<Question | null>(null)
  const { remove } = useQuestionActions(competition.id)
  const addRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  useEffect(() => {
    if (!editing && wasEditing.current) addRef.current?.focus()
    wasEditing.current = !!editing
  }, [editing])
  const locked = competition.status === 'published'
  const questions = query.data?.questions
  const busy = !!editing || remove.isPending
  function closeEditor(saved: boolean) {
    setEditing(null)
    if (saved) notify.success('Your question has been saved.')
  }
  return (
    <section aria-labelledby="questions-title" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 id="questions-title" className="text-2xl font-semibold">Questions {questions && <span className="text-muted">({questions.length}/100)</span>}</h2><p className="mt-2 text-sm text-muted">Four options. One clear answer.</p></div>
        {!locked && <Button ref={addRef} disabled={busy || !questions || questions.length >= 100} onClick={() => { setEditing('new') }}><Plus size={17} aria-hidden="true" />Add question</Button>}
      </div>
      <RequestError error={remove.error} fallback="Could not remove this question." />
      {query.isPending && <p role="status" className="text-sm text-muted">Loading your questions…</p>}
      {query.isError && <div><p role="alert" className="text-sm text-danger">Couldn’t load the latest questions.</p><Button variant="secondary" className="mt-3" onClick={() => { void query.refetch() }}>Try again</Button></div>}
      {editing && !locked && <QuestionForm key={editing === 'new' ? 'new' : editing.id} competitionId={competition.id} question={editing === 'new' ? undefined : editing} onClose={closeEditor} />}
      {questions?.length === 0 && !editing && <div className="rounded-card border border-dashed border-control p-10 text-center"><h3 className="font-display text-2xl">Start with your first question.</h3><p className="mt-3 text-sm text-muted">Add a question and mark its correct answer. Save each one when it’s ready.</p></div>}
      {questions?.map((question, index) => <QuestionCard key={question.id} question={question} number={index + 1} locked={locked} busy={busy} onEdit={() => { setEditing(question) }} onRemove={() => setRemoving(question)} />)}
      <PublishCompetitionPanel competition={competition} count={questions?.length ?? 0} disabled={busy || query.isPending || query.isError} />
      <ConfirmDialog open={!!removing} title="Remove this question?" description="This removes the saved question and its four options from this draft." confirmLabel="Remove question" cancelLabel="Keep question" pending={remove.isPending} onCancel={() => setRemoving(null)} onConfirm={() => { if (removing && !remove.isPending) remove.mutate(removing.id, { onSuccess: () => { setRemoving(null); notify.success('Question removed.') }, onError: () => setRemoving(null) }) }} />
    </section>
  )
}
