import { Copy } from 'lucide-react'
import { Button } from './Button'
import { notify } from '../../lib/notifications'

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  async function copy() {
    try { await navigator.clipboard.writeText(value); notify.success('Copied to clipboard.') }
    catch { notify.error('Copy unavailable. Please select and copy the text.') }
  }
  return <Button size="sm" variant="secondary" onClick={() => { void copy() }}><Copy size={15} aria-hidden="true" />{label}</Button>
}
