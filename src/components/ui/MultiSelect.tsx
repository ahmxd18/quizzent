import { useEffect, useId, useRef, useState } from 'react'
import { Button } from './Button'
import { TextField } from './TextField'
import type { SelectOption } from './Select'

type MultiSelectProps = {
  label: string; options: SelectOption[]; selected: SelectOption[]
  onChange: (selected: SelectOption[]) => void
  search: string; onSearch: (value: string) => void
  loading?: boolean; error?: string; onRetry: () => void
  hasMore?: boolean; onLoadMore: () => void
}

export function MultiSelect({ label, options, selected, onChange, search, onSearch, loading, error, onRetry, hasMore, onLoadMore }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const choices = [...options, ...selected.filter(option => !options.some(item => item.value === option.value))]
  return <div ref={root} className="relative space-y-2"
    onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }}
    onBlur={() => {
      // A label click moves focus before the browser activates its checkbox.
      requestAnimationFrame(() => {
        if (!root.current?.contains(document.activeElement)) setOpen(false)
      })
    }}>
    <span id={`${id}-label`} className="block text-sm font-semibold">{label}</span>
    <button ref={trigger} type="button" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open}
      aria-controls={`${id}-panel`} onClick={() => setOpen(!open)}
      className="min-h-12 w-full rounded-xl border border-control bg-surface px-3 text-left text-sm">
      <span id={`${id}-value`}>{selected.length ? `${selected.length} selected` : 'All organisers'} <span aria-hidden="true">⌄</span></span>
    </button>
    {open && <div id={`${id}-panel`} className="absolute left-0 top-full z-20 w-full min-w-0 space-y-3 rounded-xl border border-control bg-surface p-3 shadow-card">
      <TextField label="Find organisers" type="search" value={search} maxLength={100} onChange={event => onSearch(event.target.value)} />
      <div role="group" aria-labelledby={`${id}-label`} className="max-h-52 space-y-1 overflow-y-auto">
        {choices.map(option => {
          const checked = selected.some(item => item.value === option.value)
          return <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm hover:bg-brand-soft">
            <input type="checkbox" checked={checked} className="mt-1 shrink-0 accent-brand"
              onChange={() => onChange(checked ? selected.filter(item => item.value !== option.value) : [...selected, option])} />
            <span className="min-w-0 break-words">{option.label}</span>
          </label>
        })}
        {!choices.length && !loading && !error && <p className="text-sm text-muted">No matching organisers.</p>}
      </div>
      {error && <p role="status" className="text-sm text-danger">{error} <button type="button" onClick={onRetry} className="underline">Retry</button></p>}
      {hasMore && <Button variant="ghost" size="sm" disabled={loading} onClick={onLoadMore}>Load more organisers</Button>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" disabled={!selected.length} onClick={() => onChange([])}>Clear selection</Button>
        <Button size="sm" variant="secondary" onClick={() => { setOpen(false); trigger.current?.focus() }}>Done</Button>
      </div>
      {loading && <p role="status" className="text-xs text-muted">Loading organisers…</p>}
    </div>}
  </div>
}
