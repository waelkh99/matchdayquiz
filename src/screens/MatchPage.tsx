import { useEffect, useState } from 'react'
import { listMatches, type Match, type SideKey } from '../data'
import { decodeChallenge } from '../game/challenge'
import { newGame, type Game } from '../game/game'
import { Scoreboard } from '../components/Scoreboard'
import { MatchRow } from './Matches'
import { useT } from '../i18n'
import { useMeta } from '../useMeta'

/** One page per match: what search results and shared links land on. A ?c=… challenge shows who to beat. */
export function MatchPage({ id, challenge, onStart }: { id: string; challenge: string | null; onStart: (g: Game) => void }) {
  const { t, tx, link, lang } = useT()
  const [all, setAll] = useState<Match[]>()
  useEffect(() => { listMatches().then(setAll) }, [])
  const m = all?.find(x => x.id === id)
  useMeta(m ? { kind: 'match', match: m } : null, lang)
  if (!all) return null
  if (!m) return (
    <>
      <p className="err" role="alert">{t.notFound}</p>
      <a className="btn wide" href={link('/matches')}>{t.browseAll}</a>
    </>
  )

  const c = challenge ? decodeChallenge(challenge) : null
  const ch = c && c.matchId === m.id ? c : null
  const play = (side: SideKey) => onStart(newGame(m.id, 'solo', [{ name: t.you, side }],
    ch && ch.side === side ? { name: ch.name, found: ch.found, hints: ch.hints, misses: ch.misses } : undefined))
  const related = all.filter(x => x.id !== m.id && x.comp.en === m.comp.en).slice(0, 6)

  return (
    <>
      <Scoreboard m={m} side={ch?.side} />
      <h1 className="title">{t.matchH1(tx(m.home.team), tx(m.away.team))}</h1>

      {challenge && !ch && <p className="err" role="alert">{t.badLink}</p>}
      {ch && (
        <div className="panel">
          <h2 className="title" data-testid="challenge-intro">{t.challengeIntro(ch.name, ch.found)}</h2>
          <button type="button" className="btn wide card" onClick={() => play(ch.side)}>{t.accept}</button>
        </div>
      )}

      {!ch && (
        <>
          <p className="sub">{t.matchIntro}</p>
          <div className="play-sides">
            {(['home', 'away'] as const).map(k => (
              <button key={k} type="button" className="btn card" onClick={() => play(k)}>{t.playSide(tx(m[k].team))}</button>
            ))}
          </div>
        </>
      )}

      <section>
        <h3>{t.withFriends}</h3>
        <div className="tools">
          <a className="btn" href={link(`/setup/same?m=${m.id}`)}>{t.modeSame}</a>
          <a className="btn" href={link(`/setup/versus?m=${m.id}`)}>{t.modeVersus}</a>
        </div>
      </section>

      {related.length > 0 && (
        <section>
          <h3>{t.moreIn(tx(m.comp))}</h3>
          <nav className="list">{related.map(x => <MatchRow key={x.id} m={x} />)}</nav>
        </section>
      )}
      <a className="ghost" href={link('/matches')}>{t.browseAll}</a>
    </>
  )
}
