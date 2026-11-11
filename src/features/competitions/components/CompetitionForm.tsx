import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LoaderCircle, Save } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { TextField } from '../../../components/ui/TextField'
import { TextareaField } from '../../../components/ui/TextareaField'
import { ApiError } from '../../../lib/http'
import type { Competition } from '../api/competitions'
import { useSaveCompetition } from '../hooks/useCompetitions'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'

export function CompetitionForm({ competition }: { competition?: Competition }) {
  const [title, setTitle] = useState(competition?.title ?? '')
  const [description, setDescription] = useState(competition?.description ?? '')
  const [seconds, setSeconds] = useState(String(competition?.questionTimeSeconds ?? 10))
  const mutation = useSaveCompetition(competition?.id)
  const navigate = useNavigate()
  const errorRef = useRef<HTMLDivElement>(null)
  const dirty = title !== (competition?.title ?? '') || description !== (competition?.description ?? '') || seconds !== String(competition?.questionTimeSeconds ?? 10)
  const navigation = useUnsavedChanges(dirty)
  const fieldErrors = mutation.error instanceof ApiError ? mutation.error.fieldErrors : {}
  useEffect(() => { if (mutation.error) errorRef.current?.focus() }, [mutation.error])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    mutation.mutate({ title, description, questionTimeSeconds: Number(seconds) }, { onSuccess: () => {
      navigation.allowSavedNavigation()
      navigate('/organiser', { replace: true, state: { draftSaved: true } })
    } })
  }

  return (
    <><Card className="p-6 sm:p-9">
      <form onSubmit={submit} aria-busy={mutation.isPending}>
        {mutation.error && <div ref={errorRef} role="alert" tabIndex={-1} className="mb-6 rounded-xl border border-danger p-4 text-sm text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : 'Could not save your draft. Check your connection and try again.'}
        </div>}
        <fieldset disabled={mutation.isPending} className="space-y-7">
          <TextField label="Competition title" name="title" value={title} onChange={event => setTitle(event.target.value)} required maxLength={100} placeholder="e.g. Friday Brainstorm" hint="A clear name makes your competition easy to find." error={fieldErrors.title} />
          <TextareaField label="Description (optional)" name="description" value={description} onChange={event => setDescription(event.target.value)} maxLength={500} placeholder="What’s this competition about?" hint={`${description.length}/500 characters`} error={fieldErrors.description} />
          <div className="border-t border-outline pt-7">
            <div className="max-w-sm"><TextField label="Time per question (seconds)" name="questionTimeSeconds" type="number" inputMode="numeric" min={5} max={120} step={1} required value={seconds} onChange={event => setSeconds(event.target.value)} hint="5–120 seconds. Every question uses this same limit." error={fieldErrors.questionTimeSeconds} /></div>
          </div>
        </fieldset>
        <div className="mt-8 flex flex-col gap-3 border-t border-outline pt-7 sm:flex-row sm:items-center">
          <Button type="submit" disabled={mutation.isPending || (!!competition && !dirty)}>
            {mutation.isPending ? <><LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Saving draft…</> : <><Save size={17} aria-hidden="true" />{competition ? 'Save changes' : 'Create draft'}</>}
          </Button>
          {mutation.isPending ? <Button variant="ghost" disabled>Cancel</Button> : <ButtonLink to="/organiser" variant="ghost">Cancel</ButtonLink>}
          <span role="status" className="text-center text-xs text-muted sm:ml-auto">{mutation.isPending ? 'Saving…' : dirty ? 'Unsaved changes' : competition ? 'All changes saved' : 'Not saved yet'}</span>
        </div>
      </form>
    </Card>
    <ConfirmDialog open={navigation.blocked} title="Discard unsaved changes?" description="Your changes haven’t been saved. Keep editing, or discard them and leave this page." onCancel={navigation.keepEditing} onConfirm={navigation.discardChanges} />
    </>
  )
}
