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
  '/organiser/competitions/new': 'Create competition — Quizzent',
}
const routeTitles: [RegExp, string][] = [
  [/^\/join\/[^/]+$/, 'Join room'],
  [/^\/rooms\/[^/]+$/, 'Your room'],
  [/^\/organiser\/rooms\/[^/]+$/, 'Manage room'],
  [/^\/organiser\/competitions\/[^/]+\/questions$/, 'Competition questions'],
  [/^\/organiser\/competitions\/[^/]+\/edit$/, 'Competition details'],
]

export function AppLayout() {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef(pathname)

  useEffect(() => {
    const routeTitle = routeTitles.find(([pattern]) => pattern.test(pathname))?.[1]
    document.title = titles[pathname] ?? `${routeTitle ?? 'Page not found'} — Quizzent`
    if (previousPath.current !== pathname) {
      // Announce the new page to keyboard/screen-reader users after navigation.
      mainRef.current?.focus({ preventScroll: true })
      window.scrollTo(0, 0)
      previousPath.current = pathname
    }
  }, [pathname])

  return (
    <div className="flex min-h-svh flex-col">
      {/* Move focus without replacing a personal invitation's URL fragment. */}
      <a href="#main-content" onClick={event => { event.preventDefault(); mainRef.current?.focus() }} className="sr-only rounded-full bg-brand px-5 py-3 font-semibold text-on-brand focus:not-sr-only focus:fixed focus:left-5 focus:top-5 focus:z-50">Skip to content</a>
      <SiteHeader />
      <main ref={mainRef} id="main-content" tabIndex={-1} className="flex-1 focus-visible:outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
