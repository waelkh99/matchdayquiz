import { Component, useEffect, useState, type ReactNode } from 'react'
import type { Game, Mode } from './game/game'
import { LangProvider, useT } from './i18n'
import { store } from './store'
import { BRAND, BRAND_SPLIT } from './brand'
import { Home } from './screens/Home'
import { Setup } from './screens/Setup'
import { Play } from './screens/Play'
import { ChallengeLanding } from './screens/ChallengeLanding'

export const go = (path: string) => { location.hash = path }

function useHash() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => { setHash(location.hash); window.scrollTo(0, 0) }
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return hash.replace(/^#\/?/, '')
}

/** A saved game from an older version (or corrupted storage) must not brick the app: drop it and recover. */
class Recover extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() {
    if (!this.state.failed) return this.props.children
    return <a className="btn wide" href="#/" onClick={() => this.setState({ failed: false })}>{RECOVER_LABEL[document.documentElement.lang === 'ar' ? 'ar' : 'en']}</a>
  }
}
const RECOVER_LABEL = { en: 'Something went wrong with that game. Start a new one', ar: 'حدث خطأ في هذه المباراة. ابدأ مباراة جديدة' }

type Theme = 'light' | 'dark'
const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches

function applyTheme(t: Theme | null) {
  if (t) document.documentElement.dataset.theme = t
  else delete document.documentElement.dataset.theme
}

/** Follows the system until the viewer picks; the choice is remembered. */
function ThemeToggle() {
  const { t } = useT()
  const [theme, setTheme] = useState<Theme | null>(() => {
    const saved = store.get<Theme>('theme')
    const v = saved === 'light' || saved === 'dark' ? saved : null
    applyTheme(v)
    return v
  })
  const dark = theme ? theme === 'dark' : systemDark()
  const toggle = () => {
    const next: Theme = dark ? 'light' : 'dark'
    store.set('theme', next); applyTheme(next); setTheme(next)
  }
  return (
    <button type="button" className="theme" aria-pressed={dark} aria-label={t.darkMode} onClick={toggle}>
      {dark
        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>}
    </button>
  )
}

function Shell() {
  const { lang, setLang } = useT()
  const route = useHash()
  const [game, setGameState] = useState<Game | null>(() => store.get<Game>('game'))
  const setGame = (g: Game | null) => { store.set('game', g ?? undefined); setGameState(g) }
  const start = (g: Game) => { setGame(g); go('/play') }

  const [screen, arg] = route.split('/')
  let page
  if (screen === 'setup' && ['solo', 'same', 'versus'].includes(arg)) page = <Setup mode={arg as Mode} onStart={start} />
  else if (screen === 'play' && game) page = <Play game={game} setGame={setGame} onStart={start} />
  else if (screen === 'c' && arg) page = <ChallengeLanding code={arg} onStart={start} />
  else page = <Home resume={game && !game.done ? game : null} />

  return (
    <div className="wrap">
      <header>
        <a className="brand" href="#/">{BRAND.slice(0, BRAND_SPLIT)}<span>{BRAND.slice(BRAND_SPLIT)}</span></a>
        <ThemeToggle />
        {lang === 'en'
          ? <button type="button" className="lang" lang="ar" onClick={() => setLang('ar')}>عربي</button>
          : <button type="button" className="lang" lang="en" onClick={() => setLang('en')}>English</button>}
      </header>
      <Recover key={route} onError={() => setGame(null)}>{page}</Recover>
    </div>
  )
}

export default function App() {
  return <LangProvider><Shell /></LangProvider>
}
