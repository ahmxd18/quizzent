import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { TextareaField } from '../../../components/ui/TextareaField'
import { TextField } from '../../../components/ui/TextField'
import { ApiError } from '../../../lib/http'
import { useUnsavedChanges } from '../../competitions/hooks/useUnsavedChanges'
import type { Question } from '../api/questions'
import { useQuestionActions } from '../hooks/useQuestions'

export function QuestionForm({ competitionId, question, onClose }: { competitionId: string; question?: Question; onClose: (saved: boolean) => void }) {
  const initialOptions = question?.options.map(option => option.text) ?? ['', '', '', '']
  const initialCorrect = question ? question.options.findIndex(option => option.id === question.correctOptionId) : -1
  const [prompt, setPrompt] = useState(question?.prompt ?? '')
  const [options, setOptions] = useState(initialOptions)
  const [correct, setCorrect] = useState(initialCorrect)
  const [cancelRequested, setCancelRequested] = useState(false)
  const dirty = prompt !== (question?.prompt ?? '') || correct !== initialCorrect || options.some((option, index) => option !== initialOptions[index])
  const navigation = useUnsavedChanges(dirty)
  const { save } = useQuestionActions(competitionId, question?.id)
  const errorRef = useRef<HTMLDivElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { promptRef.current?.focus() }, [])
  useEffect(() => { if (save.error) errorRef.current?.focus() }, [save.error])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (save.isPending) return
    save.mutate({ prompt, options, correctOptionIndex: correct }, { onSuccess: () => {
      navigation.allowSavedNavigation()
      onClose(true)
    } })
  }

  return <>
    <Card className="p-6 sm:p-8">
      <h2 className="mb-6 text-xl font-semibold">{question ? 'Edit question' : 'Add a question'}</h2>
      <form onSubmit={submit} aria-busy={save.isPending} className="space-y-6">
        {save.error && <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-xl border border-danger p-4 text-sm text-danger">{save.error instanceof ApiError ? save.error.message : 'Could not save your question. Check your connection and try again.'}</div>}
        <fieldset disabled={save.isPending} className="space-y-6">
          <TextareaField ref={promptRef} label="Question" name="prompt" value={prompt} onChange={event => setPrompt(event.target.value)} required maxLength={1000} hint="Keep it clear and specific. Up to 1,000 characters." placeholder="What would you like to ask?" />
          <fieldset className="space-y-4">
            <legend className="mb-3 text-sm font-semibold">Four options · one correct answer</legend>
            {options.map((option, index) => <div key={index} className={`rounded-2xl border p-4 ${correct === index ? 'border-brand bg-brand-soft' : 'border-outline'}`}>
              <TextField label={`Option ${'ABCD'[index]}`} name={`option-${index}`} required maxLength={200} value={option} onChange={event => setOptions(options.map((value, position) => position === index ? event.target.value : value))} />
              <label className="mt-3 flex min-h-10 cursor-pointer items-center gap-3 text-sm"><input type="radio" name="correct-answer" value={index} required checked={correct === index} onChange={() => setCorrect(index)} className="size-4 accent-brand" />Option {'ABCD'[index]} is correct</label>
            </div>)}
          </fieldset>
        </fieldset>
        <div className="flex flex-wrap gap-3 border-t border-outline pt-6">
          <Button type="submit" disabled={save.isPending || (!!question && !dirty)}>{save.isPending ? 'Saving question…' : 'Save question'}</Button>
          <Button variant="ghost" disabled={save.isPending} onClick={() => dirty ? setCancelRequested(true) : onClose(false)}>Cancel</Button>
        </div>
      </form>
    </Card>
    <ConfirmDialog open={navigation.blocked || cancelRequested} title="Discard question changes?" description="Your question changes haven’t been saved." onCancel={() => { setCancelRequested(false); navigation.keepEditing() }} onConfirm={() => { if (navigation.blocked) navigation.discardChanges(); else onClose(false) }} />
  </>
}
