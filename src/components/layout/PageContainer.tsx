import type { ComponentProps } from 'react'

export function PageContainer({ className = '', ...props }: ComponentProps<'div'>) {
  return <div className={`mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12 ${className}`} {...props} />
}
