import type { ComponentProps } from 'react'
import { Link, type LinkProps } from 'react-router'

type ButtonAppearance = {
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  className?: string
}

const variants = {
  primary: 'border-brand bg-brand text-on-brand hover:border-brand-hover hover:bg-brand-hover',
  accent: 'border-accent bg-accent text-foreground hover:border-accent-hover hover:bg-accent-hover',
  secondary: 'border-control bg-surface text-foreground hover:bg-surface-strong',
  ghost: 'border-transparent text-foreground hover:bg-surface-strong',
}

function buttonClasses({ variant = 'primary', size = 'md', className = '' }: ButtonAppearance) {
  return `inline-flex shrink-0 items-center justify-center gap-2 rounded-full border font-semibold transition-colors motion-reduce:transition-none ${size === 'sm' ? 'min-h-11 px-5 text-sm' : 'min-h-12 px-6 text-sm'} ${variants[variant]} ${className}`
}

export function Button({ variant, size, className, type = 'button', ...props }: ComponentProps<'button'> & ButtonAppearance) {
  return <button type={type} className={`${buttonClasses({ variant, size, className })} disabled:cursor-not-allowed disabled:opacity-60`} {...props} />
}

// Navigation uses a real link, keeping open-in-new-tab and keyboard behaviour.
export function ButtonLink({ variant, size, className, ...props }: LinkProps & ButtonAppearance) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />
}
