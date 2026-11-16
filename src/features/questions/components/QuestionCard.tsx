import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import type { Question } from '../api/questions'

export function QuestionCard({ question, number, locked, busy, onEdit, onRemove }: { question: Question; number: number; locked: boolean; busy: boolean; onEdit: () => void; onRemove: () => void }) {
  return (
    <Card className="p-6 sm:p-8">
      <p className="text-xs font-semibold text-brand">Question {number}</p>
      <h3 className="mt-3 whitespace-pre-wrap break-words text-lg font-semibold leading-relaxed">{question.prompt}</h3>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {question.options.map((option, index) => <li key={option.id} className={`min-w-0 rounded-xl border p-4 ${option.id === question.correctOptionId ? 'border-brand bg-brand-soft' : 'border-outline'}`}>
          <div className="flex items-center justify-between gap-2 text-xs"><span className="font-semibold">Option {'ABCD'[index]}</span>{option.id === question.correctOptionId && <Badge tone="accent">Correct</Badge>}</div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{option.text}</p>
        </li>)}
      </ul>
      {!locked && <div className="mt-5 flex gap-3"><Button variant="secondary" size="sm" disabled={busy} onClick={onEdit} aria-label={`Edit question ${number}`}>Edit</Button><Button variant="ghost" size="sm" disabled={busy} onClick={onRemove} aria-label={`Remove question ${number}`}>Remove</Button></div>}
    </Card>
  )
}
