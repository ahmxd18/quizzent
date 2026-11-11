import { useId, type ComponentProps } from 'react'

type TextareaFieldProps = ComponentProps<'textarea'> & { label: string; hint?: string; error?: string }

export function TextareaField({ label, hint, error, id, className = '', 'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }: TextareaFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const message = error || hint
  const messageId = `${inputId}-message`
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-semibold">{label}</label>
      <textarea id={inputId} rows={4}
        className={`min-h-32 w-full resize-y rounded-xl border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted disabled:cursor-not-allowed disabled:bg-surface-strong ${error ? 'border-danger' : 'border-control'} ${className}`}
        aria-invalid={error ? true : invalid}
        aria-describedby={[describedBy, message ? messageId : undefined].filter(Boolean).join(' ') || undefined}
        {...props} />
      {message && <p id={messageId} className={`text-sm leading-relaxed ${error ? 'text-danger' : 'text-muted'}`}>{message}</p>}
    </div>
  )
}
