import { useEffect, useState } from 'react'

// URLs: optional "/ar" prefix for Arabic, then the route. "/match/bar-mun-2009", "/ar/match/bar-mun-2009".
export type UrlLang = 'en' | 'ar'

export function splitLang(pathname: string): { lang: UrlLang; path: string } {
  if (pathname === '/ar' || pathname.startsWith('/ar/')) return { lang: 'ar', path: pathname.slice(3) || '/' }
  return { lang: 'en', path: pathname || '/' }
}
export const localize = (lang: UrlLang, path: string) => (lang === 'ar' ? (path === '/' ? '/ar' : '/ar' + path) : path)

const EVENT = 'xi:navigate'
export function go(to: string, opts: { replace?: boolean } = {}) {
  if (to === location.pathname + location.search) return
  history[opts.replace ? 'replaceState' : 'pushState'](null, '', to)
  dispatchEvent(new Event(EVENT))
  if (!opts.replace) scrollTo(0, 0)
}

/** The current pathname + search, re-rendering on navigation and back/forward. */
export function useUrl() {
  const read = () => ({ pathname: location.pathname, search: location.search })
  const [url, setUrl] = useState(read)
  useEffect(() => {
    const on = () => setUrl(u => (u.pathname === location.pathname && u.search === location.search ? u : read()))
    addEventListener(EVENT, on)
    addEventListener('popstate', on)
    on() // a child's effect may already have navigated (effects run child-first), before this listener existed
    return () => { removeEventListener(EVENT, on); removeEventListener('popstate', on) }
  }, [])
  return url
}

/** Plain <a href="/..."> links navigate without a page load (modifier keys and new tabs still work). */
export function interceptLinks() {
  addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null
    if (!a || a.target || a.hasAttribute('download') || a.origin !== location.origin) return
    e.preventDefault()
    go(a.pathname + a.search)
  })
}

/** Links from before path routing ("/#/setup/solo") keep working. */
export function upgradeHashUrl() {
  if (location.hash.startsWith('#/')) history.replaceState(null, '', location.hash.slice(1))
}
