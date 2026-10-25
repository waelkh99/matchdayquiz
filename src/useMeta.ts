import { useEffect } from 'react'
import { BRAND, SITE_URL } from './brand'
import { localize } from './router'
import { meta, type Lang, type Page } from './seo'

function tag(selector: string, create: () => HTMLElement) {
  return (document.head.querySelector(selector) as HTMLElement | null) ?? document.head.appendChild(create())
}
const metaTag = (name: string) => tag(`meta[name="${name}"]`, () => Object.assign(document.createElement('meta'), { name }))
const linkTag = (rel: string, hreflang?: string) =>
  tag(`link[rel="${rel}"]${hreflang ? `[hreflang="${hreflang}"]` : ':not([hreflang])'}`, () =>
    Object.assign(document.createElement('link'), { rel, ...(hreflang ? { hreflang } : {}) }))

/** Keeps <title>, description, canonical, alternates and robots in step with in-app navigation (the build prerenders the same values). */
export function useMeta(page: Page | null, lang: Lang) {
  const key = page ? JSON.stringify(page.kind === 'match' ? ['match', page.match.id] : page) : ''
  useEffect(() => {
    if (!page) return
    const m = meta(page, lang, BRAND, SITE_URL)
    document.title = m.title
    metaTag('description').setAttribute('content', m.description)
    metaTag('robots').setAttribute('content', m.noindex ? 'noindex' : 'index,follow')
    linkTag('canonical').setAttribute('href', SITE_URL + localize(lang, m.path))
    linkTag('alternate', 'en').setAttribute('href', SITE_URL + m.path)
    linkTag('alternate', 'ar').setAttribute('href', SITE_URL + localize('ar', m.path))
    linkTag('alternate', 'x-default').setAttribute('href', SITE_URL + m.path)
  }, [key, lang])
}
