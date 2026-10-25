import { useEffect, useState } from 'react'
import { listMatches, type Match, type SideKey } from '../data'
import { newGame, type Game, type Mode } from '../game/game'
import { norm } from '../game/match'
import { MatchPicker } from '../components/MatchPicker'
import { Scoreboard } from '../components/Scoreboard'
import { useT } from '../i18n'
import { store } from '../store'
import { useMeta } from '../useMeta'

const MAX_PLAYERS = 6

export function Setup({ mode, preselect, onStart }: { mode: Mode; preselect: string | null; onStart: (g: Game) => void }) {
  const { t, tx, link, lang } = useT()
  useMeta({ kind: 'setup', mode }, lang)
  const [matches, setMatches] = useState<Match[]>([])
  const [id, setId] = useState<string | null>(preselect)
  const [side, setSide] = useState<SideKey>('home')
  const [names, setNames] = useState<string[]>(() => {
    const saved = store.get<string[]>('names') ?? []
    const n = mode === 'same' ? Math.max(2, Math.min(saved.length, MAX_PLAYERS)) : 2
    return Array.from({ length: n }, (_, i) => saved[i] ?? '')
  })
  const [err, setErr] = useState('')
  useEffect(() => { listMatches().then(setMatches) }, [])
  const m = matches.find(x => x.id === id)

  const setName = (i: number, v: string) => setNames(ns => ns.map((n, j) => (j === i ? v : n)))
  const other: Record<SideKey, SideKey> = { home: 'away', away: 'home' }

  function start() {
    if (!m) return setErr(t.needMatch)
    if (mode === 'solo') return onStart(newGame(m.id, 'solo', [{ name: t.you, side }]))
    const clean = names.map((n, i) => n.trim().slice(0, 24) || t.playerN(i + 1))
    if (new Set(clean.map(n => norm(n) || n)).size !== clean.length) return setErr(t.needNames)
    store.set('names', names.map(n => n.trim()))
    const players = mode === 'versus'
      ? [{ name: clean[0], side }, { name: clean[1], side: other[side] }]
      : clean.map(name => ({ name, side }))
    onStart(newGame(m.id, mode, players))
  }

  const title = { solo: t.modeSolo, same: t.modeSame, versus: t.modeVersus }[mode]
  return (
    <>
      <div className="titlebar">
        <h2 className="title">{title}</h2>
        <a className="ghost" href={link('/')}>{t.back}</a>
      </div>

      <MatchPicker matches={matches} value={id} onPick={x => { setId(x); setErr('') }} />

      {m && <Scoreboard m={m} side={mode === 'versus' ? undefined : side} />}

      {m && mode !== 'versus' && (
        <section className="field">
          <h3>{t.pickTeam}</h3>
          <div className="seg">
            {(['home', 'away'] as const).map(k => (
              <button key={k} type="button" aria-pressed={side === k} onClick={() => setSide(k)}>{tx(m[k].team)}</button>
            ))}
          </div>
        </section>
      )}

      {mode !== 'solo' && (
        <section className="field">
          <h3>{t.players}</h3>
          <div className="players">
            {names.map((n, i) => (
              <div className="prow" key={i}>
                <input
                  className="input" value={n} maxLength={24} dir="auto" autoComplete="off"
                  aria-label={t.playerN(i + 1)} placeholder={t.playerN(i + 1)}
                  onChange={e => { setName(i, e.target.value); setErr('') }}
                />
                {mode === 'versus' && m && <span className="team">{tx(m[i === 0 ? side : other[side]].team)}</span>}
                {mode === 'same' && names.length > 2 && (
                  <button type="button" className="x" aria-label={t.removePlayer} onClick={() => setNames(ns => ns.filter((_, j) => j !== i))}>×</button>
                )}
              </div>
            ))}
          </div>
          <div className="tools">
            {mode === 'same' && names.length < MAX_PLAYERS && (
              <button type="button" className="ghost" onClick={() => setNames(ns => [...ns, ''])}>+ {t.addPlayer}</button>
            )}
            {mode === 'versus' && m && <button type="button" className="ghost" onClick={() => setSide(other[side])}>{t.swap}</button>}
          </div>
        </section>
      )}

      <div className="dock">
        {err && <p className="err" role="alert">{err}</p>}
        <button type="button" className="btn wide" onClick={start}>{t.start}</button>
      </div>
    </>
  )
}
