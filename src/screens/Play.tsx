import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { getMatch, type Match } from '../data'
import { canHint, finished, giveUp, guess, hint, MAX_HINT, MAX_MISS, score, sheets, type Game } from '../game/game'
import { Pitch } from '../components/Pitch'
import { Scoreboard } from '../components/Scoreboard'
import { Result } from './Result'
import { useT } from '../i18n'

type Props = { game: Game; setGame: (g: Game | null) => void; onStart: (g: Game) => void }

export function Play({ game, setGame, onStart }: Props) {
  const { t, tx, full } = useT()
  const [m, setM] = useState<Match>()
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [pop, setPop] = useState<number | null>(null)
  const [armed, setArmed] = useState(false)
  const [shake, setShake] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getMatch(game.matchId).then(x => {
      if (x) setM(x)
      else { setGame(null); location.hash = '/' } // saved game for a match that no longer exists
    })
  }, [game.matchId])
  useEffect(() => { setSelected(null); setArmed(false) }, [game.turn])
  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), 3500)
    return () => clearTimeout(id)
  }, [armed])
  useEffect(() => {
    if (pop === null) return
    const id = setTimeout(() => setPop(null), 500)
    return () => clearTimeout(id)
  }, [pop])

  const sh = useMemo(() => m && sheets(m), [m])
  if (!m || !sh) return null
  if (game.done) return <Result m={m} sh={sh} game={game} onStart={onStart} />

  const multi = game.players.length > 1
  const p = game.players[game.turn]
  const board = game.boards[p.side]!
  const slots = sh[p.side]
  const foundN = Object.keys(board.found).length

  function submit(e: FormEvent) {
    e.preventDefault()
    const next = guess(game, sh!, text)
    setText('')
    if (next === game) return
    if (next.last?.kind === 'hit' && next.last.side === p.side) {
      setPop(next.last.slot)
      if (selected === next.last.slot) setSelected(null)
    }
    if (next.last?.kind === 'miss') setShake(true)
    setGame(next)
  }

  const last = game.last
  let fb = t.intro, fbCls = ''
  if (last) {
    if (last.kind === 'miss' || last.kind === 'repeat') {
      fb = last.kind === 'miss' ? t.fbMiss(last.text) : t.fbRepeat(last.text)
      if (last.kind === 'miss') fbCls = 'bad'
    } else {
      const s = sh[last.side][last.slot]
      if (last.kind === 'hit') { fb = t.fbHit(full(s), s.num); fbCls = 'good' }
      else if (last.kind === 'already') fb = t.fbAlready(full(s))
      else fb = t.fbHint(s.num)
    }
  }
  // Pass-and-play: once the turn has moved on, say who the last guess belonged to.
  const lastBy = last ? game.players[last.by] : undefined
  if (multi && lastBy && last!.by !== game.turn) fb = t.byPlayer(lastBy.name, fb)
  const sideMisses = game.players.filter(q => q.side === p.side).flatMap(q => q.misses)
  const hintOk = canHint(game, selected)
  const hintLabel = p.hints >= MAX_HINT ? t.noHints : selected === null ? t.tapShirt : t.hintFor(slots[selected].num)

  return (
    <>
      <Scoreboard m={m} side={p.side}>{t.task(tx(m[p.side].team), m[p.side].formation)}</Scoreboard>

      {multi && (
        <div className="turns" aria-label={t.players}>
          {game.players.map((q, i) => (
            <span key={i} className={['turn', i === game.turn && 'now', finished(game, sh, q) && 'out'].filter(Boolean).join(' ')}
              aria-current={i === game.turn ? 'true' : undefined}>
              <bdi>{q.name}</bdi> <span className="n">{score(game, i).found}</span>
            </span>
          ))}
        </div>
      )}
      {multi && <h2 className="title" aria-live="polite">{t.turnOf(p.name)}</h2>}

      <Pitch kit={m[p.side].kit} slots={slots} board={board} reveal={false} selected={selected} pop={pop}
        onSelect={i => { setSelected(selected === i ? null : i); input.current?.focus({ preventScroll: true }) }} />

      <div className="dock">
        <div className={'feedback ' + fbCls} aria-live="polite" data-testid="feedback">{fb}</div>
        <form className={'guess' + (shake ? ' shake' : '')} onSubmit={submit} autoComplete="off" onAnimationEnd={() => setShake(false)}>
          <label htmlFor="guess" className="vh">{t.guessLabel}</label>
          <input id="guess" ref={input} className="input" value={text} onChange={e => setText(e.target.value)}
            placeholder={multi ? t.guessPhFor(p.name) : t.guessPh}
            spellCheck={false} autoCapitalize="off" autoCorrect="off" enterKeyHint="go" dir="auto" />
          <button className="btn" type="submit">{t.guessBtn}</button>
        </form>
        <div className="status">
          <div className="stat">{t.found} <span className="count" data-testid="found">{foundN}/{slots.length}</span></div>
          <div className="stat">{t.misses} <span className="pips" data-testid="misses" data-used={p.misses.length}
            role="img" aria-label={`${p.misses.length}/${MAX_MISS}`}>
            {Array.from({ length: MAX_MISS }, (_, i) => <span key={i} className={'pip' + (i < p.misses.length ? ' used' : '')} />)}
          </span></div>
          <div className="stat">{t.hints} <span className="count" data-testid="hints">{MAX_HINT - p.hints}</span></div>
        </div>
        <button className="btn card sm" type="button" disabled={!hintOk}
          onClick={() => { setGame(hint(game, selected)); input.current?.focus({ preventScroll: true }) }}>{hintLabel}</button>
      </div>

      <div className="tools">
        <button className="ghost danger" type="button" onClick={() => { if (armed) { setArmed(false); setGame(giveUp(game, sh)) } else setArmed(true) }}>
          {multi ? (armed ? t.confirmRetire : t.retire) : (armed ? t.confirmGiveUp : t.giveUp)}
        </button>
      </div>
      {sideMisses.length > 0 && <div className="misses">{t.notInXI} {sideMisses.map((x, i) => <s key={i}>{x}</s>)}</div>}
    </>
  )
}
