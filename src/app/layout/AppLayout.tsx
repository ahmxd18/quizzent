import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

const titles: Record<string, string> = {
  '/': 'Quizzent — Sharp minds. Good times.',
  '/join': 'Join a room — Quizzent',
  '/login': 'Organiser login — Quizzent',
  '/signup': 'Become an organiser — Quizzent',
  '/organiser': 'Organiser space — Quizzent',
}

export function AppLayout() {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef(pathname)

  useEffect(() => {
    document.title = titles[pathname] ?? 'Page not found — Quizzent'
    if (previousPath.current !== pathname) {
      // Announce the new page to keyboard/screen-reader users after navigation.
      mainRef.current?.focus({ preventScroll: true })
      window.scrollTo(0, 0)
      previousPath.current = pathname
    }
  }, [pathname])

  return (
    <div className="flex min-h-svh flex-col">
      <a href="#main-content" className="sr-only rounded-full bg-brand px-5 py-3 font-semibold text-on-brand focus:not-sr-only focus:fixed focus:left-5 focus:top-5 focus:z-50">Skip to content</a>
      <SiteHeader />
      <main ref={mainRef} id="main-content" tabIndex={-1} className="flex-1 focus-visible:outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
