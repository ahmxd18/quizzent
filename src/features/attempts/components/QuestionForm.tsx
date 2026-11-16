import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { RequestError } from '../../../components/ui/RequestError'
import type { AnswerSubmission, AttemptQuestion } from '../api/attempts'
import { useSubmitAnswer } from '../hooks/useAttempt'

export function QuestionForm({ roomId, question, position }: { roomId: string; question: AttemptQuestion; position: number }) {
  const [selected, setSelected] = useState('')
  const lastSubmission = useRef<AnswerSubmission | null>(null)
  const promptRef = useRef<HTMLHeadingElement>(null)
  const answer = useSubmitAnswer(roomId)

  useEffect(() => { promptRef.current?.focus() }, [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || answer.isPending) return
    // If a response was lost, retry the same choice under the same request ID.
    if (lastSubmission.current?.optionId !== selected) {
      lastSubmission.current = { questionId: question.id, optionId: selected, requestId: crypto.randomUUID() }
    }
    answer.mutate(lastSubmission.current)
  }

  return (
    <form onSubmit={submit} aria-busy={answer.isPending} className="space-y-5">
      <h2 ref={promptRef} tabIndex={-1} className="break-words font-display text-2xl outline-none sm:text-3xl">{question.prompt}</h2>
      <RequestError error={answer.error} fallback="We couldn’t confirm your submission. You can retry the selected answer." />
      <fieldset disabled={answer.isPending} className="space-y-3">
        <legend className="mb-3 text-sm font-semibold">Choose one answer</legend>
        {question.options.map(option => (
          <label key={option.id} className={`flex items-start gap-3 rounded-xl border p-4 ${selected === option.id ? 'border-brand bg-brand-soft' : 'border-control bg-surface'}`}>
            <input
              type="radio"
              className="mt-1 size-4 shrink-0 accent-brand"
              name={`question-${position}`}
              value={option.id}
              checked={selected === option.id}
              onChange={() => { setSelected(option.id); answer.reset() }}
            />
            <span className="min-w-0 break-words text-sm leading-relaxed">{option.text}</span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" variant="accent" className="w-full sm:w-auto" disabled={!selected || answer.isPending}>
        {answer.isPending ? 'Submitting…' : answer.error ? 'Retry submission' : 'Submit answer'}
      </Button>
    </form>
  )
}
