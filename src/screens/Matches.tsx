import { useEffect, useState } from 'react'
import { listMatches, type Match } from '../data'
import { useT } from '../i18n'
import { useMeta } from '../useMeta'

/** A plain link to a match page (crawlable, unlike the setup picker's buttons). Lists are grouped by competition, so the row shows the venue. */
export function MatchRow({ m }: { m: Match }) {
  const { tx, date, link } = useT()
  return (
    <a className="row" href={link(`/match/${m.id}`)}>
      <span className="rt">{tx(m.home.team)} {m.score} {tx(m.away.team)}</span>
      <span className="rs"><span>{tx(m.venue)}</span><span>{date(m.date)}</span></span>
    </a>
  )
}

/** Every match, grouped by competition. */
export function Matches() {
  const { t, tx, lang } = useT()
  const [all, setAll] = useState<Match[]>()
  useEffect(() => { listMatches().then(setAll) }, [])
  useMeta(all ? { kind: 'matches', count: all.length } : null, lang)
  if (!all) return null
  const groups = new Map<string, Match[]>()
  for (const m of all) groups.set(m.comp.en, [...(groups.get(m.comp.en) ?? []), m])
  return (
    <>
      <h1 className="title">{t.allMatches}</h1>
      {[...groups.values()].map(ms => (
        <section key={ms[0].comp.en}>
          <h2 className="label">{tx(ms[0].comp)}</h2>
          <nav className="list">{ms.map(m => <MatchRow key={m.id} m={m} />)}</nav>
        </section>
      ))}
    </>
  )
}
