import { useEffect, useState } from 'react'
import { getMatch, type Match } from '../data'
import { decodeChallenge } from '../game/challenge'
import { newGame, type Game } from '../game/game'
import { Scoreboard } from '../components/Scoreboard'
import { useT } from '../i18n'

export function ChallengeLanding({ code, onStart }: { code: string; onStart: (g: Game) => void }) {
  const { t, tx } = useT()
  const c = decodeChallenge(code)
  const [m, setM] = useState<Match | null | undefined>(undefined) // undefined: loading, null: not found
  useEffect(() => { if (c) getMatch(c.matchId).then(x => setM(x ?? null)) }, [code]) // eslint-disable-line

  if (!c || m === null) return (
    <>
      <p className="err" role="alert">{t.badLink}</p>
      <a className="btn wide" href="#/">{t.newGame}</a>
    </>
  )
  if (!m) return null
  const accept = () => onStart(newGame(m.id, 'solo', [{ name: t.you, side: c.side }], { name: c.name, found: c.found, hints: c.hints, misses: c.misses }))
  return (
    <>
      <Scoreboard m={m} side={c.side}>{t.task(tx(m[c.side].team), m[c.side].formation)}</Scoreboard>
      <h2 className="title" data-testid="challenge-intro">{t.challengeIntro(c.name, c.found)}</h2>
      <button type="button" className="btn wide card" onClick={accept}>{t.accept}</button>
    </>
  )
}
