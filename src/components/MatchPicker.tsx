import { useMemo, useState } from 'react'
import type { Match } from '../data'
import { norm } from '../game/match'
import { useT } from '../i18n'

/** Every query word must match: digits against the year/date, anything else against teams, competition and venue in both languages. */
export function searchMatches(all: Match[], q: string): Match[] {
  const words = q.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return all
  return all.filter(m => {
    const hay = [m.home.team, m.away.team, m.comp, m.venue].flatMap(s => [s.en, s.ar]).map(norm).join('|')
    return words.every(w => (/^\d+$/.test(w) ? m.date.includes(w) : norm(w) !== '' && hay.includes(norm(w))))
  })
}

export function MatchPicker({ matches, value, onPick }: { matches: Match[]; value: string | null; onPick: (id: string) => void }) {
  const { t, tx, date } = useT()
  const [q, setQ] = useState('')
  const shown = useMemo(() => searchMatches(matches, q), [matches, q])
  const random = () => {
    const pool = (shown.length ? shown : matches).filter(m => m.id !== value)
    if (pool.length) onPick(pool[Math.floor(Math.random() * pool.length)].id)
  }
  return (
    <section className="field">
      <label className="label" htmlFor="search">{t.findMatch}</label>
      <div className="prow">
        <input id="search" className="input" type="search" placeholder={t.searchPh} value={q} onChange={e => setQ(e.target.value)} autoComplete="off" dir="auto" />
        <button type="button" className="btn card" onClick={random}>{t.random}</button>
      </div>
      <div className="list">
        {shown.map(m => (
          <button key={m.id} type="button" className="row" aria-pressed={m.id === value} onClick={() => onPick(m.id)} data-match={m.id}>
            <span className="rt">{tx(m.home.team)} {m.score} {tx(m.away.team)}</span>
            <span className="rs"><span>{tx(m.comp)}</span><span>{date(m.date)}</span></span>
          </button>
        ))}
        {!shown.length && <p className="empty">{t.noResults}</p>}
      </div>
    </section>
  )
}
