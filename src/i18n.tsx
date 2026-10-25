import { createContext, useContext, type ReactNode } from 'react'
import type { L10n, Player } from './data'
import { store } from './store'
import { go, localize, splitLang, useUrl } from './router'
import { en as enText, ar as arText } from './strings'

export type Lang = 'en' | 'ar'


const en = {
  ...enText,
  task: (team: ReactNode, formation: string) => <>Name <b>{team}</b>'s starting XI · {formation}</>,
}

export type Strings = typeof en

const ar: Strings = {
  ...arText,
  task: (team: ReactNode, formation: string) => <>سمِّ التشكيلة الأساسية لـ<b>{team}</b> · <bdi>{formation}</bdi></>,
}

const strings = { en, ar }

type Ctx = { lang: Lang; t: Strings; setLang: (l: Lang) => void }
const LangCtx = createContext<Ctx>({ lang: 'en', t: en, setLang: () => {} })

function apply(l: Lang) {
  document.documentElement.lang = l
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'
}

/** Before the first render: on an English URL, follow a saved choice, else an Arabic browser. Explicit /ar links are never overridden. */
export function redirectToPreferredLang() {
  const saved = store.get<Lang>('lang')
  const want = saved === 'en' || saved === 'ar' ? saved : navigator.language?.startsWith('ar') ? 'ar' : 'en'
  const { lang, path } = splitLang(location.pathname)
  if (lang === 'en' && want === 'ar') history.replaceState(null, '', localize('ar', path) + location.search)
}

/** The URL decides the language ('/ar/...' is Arabic), so shared links and search results open in the right one. */
export function LangProvider({ children }: { children: ReactNode }) {
  const { pathname, search } = useUrl()
  const { lang, path } = splitLang(pathname)
  apply(lang)
  const setLang = (l: Lang) => { store.set('lang', l); go(localize(l, path) + search) }
  return <LangCtx.Provider value={{ lang, t: strings[lang], setLang }}>{children}</LangCtx.Provider>
}

export function useT() {
  const { lang, t, setLang } = useContext(LangCtx)
  return {
    lang, t, setLang,
    tx: (s: L10n) => s[lang],
    /** An app path in the current language: link('/matches') → '/ar/matches' in Arabic. */
    link: (path: string) => localize(lang, path),
    /** Name on the shirt tag. */
    short: (p: Player) => (lang === 'ar' ? p.ar ?? p.short : p.short),
    /** Full name in feedback lines. */
    full: (p: Player) => (lang === 'ar' ? p.ar ?? p.name : p.name),
    date: (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  }
}
