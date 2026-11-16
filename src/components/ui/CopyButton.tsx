import { useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from './Button'

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(value); setFailed(false) }
    catch { setFailed(true) }
  }
  return <div><Button size="sm" variant="secondary" onClick={() => { void copy() }}><Copy size={15} aria-hidden="true" /><span aria-live="polite">{copied === value ? 'Copied' : label}</span></Button>{failed && <p role="alert" className="mt-2 text-xs text-danger">Copy unavailable. Please select and copy the text.</p>}</div>
}
