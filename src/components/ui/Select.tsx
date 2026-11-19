import { useId, type ComponentProps } from 'react'

export type SelectOption = { value: string; label: string }

export function Select({ label, options, id, className = '', ...props }: ComponentProps<'select'> & { label: string; options: SelectOption[] }) {
  const generated = useId()
  const inputId = id ?? generated
  return <div className="space-y-2">
    <label htmlFor={inputId} className="block text-sm font-semibold">{label}</label>
    <select id={inputId} {...props} className={`min-h-12 w-full rounded-xl border border-control bg-surface px-3 text-sm text-foreground ${className}`}>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>
}
