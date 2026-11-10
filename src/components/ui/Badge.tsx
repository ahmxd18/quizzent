import type { ComponentProps } from 'react'

type BadgeProps = ComponentProps<'span'> & { tone?: 'neutral' | 'brand' | 'accent' }

const tones = {
  neutral: 'bg-surface-strong text-muted',
  brand: 'bg-brand-soft text-brand',
  accent: 'bg-accent text-foreground',
}

export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${tones[tone]} ${className}`} {...props} />
}
