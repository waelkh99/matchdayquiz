import { useState } from 'react'
import type { Match, SideKey } from '../data'
import { grid, newGame, score, verdict, type Game, type Sheets } from '../game/game'
import { encodeChallenge } from '../game/challenge'
import { Pitch } from '../components/Pitch'
import { Scoreboard } from '../components/Scoreboard'
import { AdSlot } from '../components/AdSlot'
import { useT } from '../i18n'
import { store } from '../store'
import { BRAND } from '../brand'

type Props = { m: Match; sh: Sheets; game: Game; onStart: (g: Game) => void }

export function Result({ m, sh, game, onStart }: Props) {
  const { t, tx, link } = useT()
  const [copied, setCopied] = useState<'result' | 'link' | null>(null)
  const [fallback, setFallback] = useState<string | null>(null)
  const [me, setMe] = useState(() => store.get<string>('me') ?? '')
  const [nameErr, setNameErr] = useState(false)

  const multi = game.players.length > 1
  const scores = game.players.map((p, i) => ({ ...score(game, i), name: p.name }))
  const sides = Object.keys(game.boards) as SideKey[]
  const year = m.date.slice(0, 4)
  const solo = scores[0]
  const ch = game.challenge

  let heading: string
  if (!multi) heading = t[verdict(solo.found)]
  else {
    const top = Math.max(...scores.map(s => s.found))
    const winners = scores.filter(s => s.found === top)
    heading = winners.length > 1 ? t.draw : t.wins(winners[0].name)
  }

  // Each line opens with a strong character of its own language so chat apps lay it out correctly;
  // grid rows get a left-to-right mark so the formation never mirrors (left-back stays left).
  const ltrGrid = (k: SideKey) => grid(game, sh, k).replace(/^/gm, '\u200E')
  const shareText = multi
    ? t.shareHead(BRAND, `${tx(m.home.team)} ${m.score} ${tx(m.away.team)} (${year})`) + '\n'
      + scores.map(s => `${s.name}: ${s.found}/11`).join('\n') + '\n\n'
      + sides.map(k => `${tx(m[k].team)}\n${ltrGrid(k)}`).join('\n\n')
    : `${t.shareHead(BRAND, `${tx(m[sides[0]].team)} ${year}`)}\n${t.summary(solo.found, solo.hints, solo.misses)}\n\n${ltrGrid(sides[0])}`

  async function copy(text: string, what: 'result' | 'link') {
    setFallback(null)
    try { await navigator.clipboard.writeText(text); setCopied(what) } catch { setFallback(text) }
  }
  async function share() {
    try { await navigator.share({ text: shareText }) } catch { /* cancelled */ }
  }
  function challengeLink() {
    const name = me.trim()
    if (!name) return setNameErr(true)
    store.set('me', name)
    const code = encodeChallenge({ matchId: m.id, side: sides[0], name, found: solo.found, hints: solo.hints, misses: solo.misses })
    const url = `${location.origin}${link(`/match/${m.id}`)}?c=${code}` // the match page gives the link a proper preview
    copy(`${shareText}\n\n${t.beatMe} ${url}`, 'link')
  }
  const again = () => onStart(newGame(m.id, game.mode, game.players.map(p => ({ name: p.name, side: p.side })), ch))

  const top = Math.max(...scores.map(s => s.found))
  return (
    <>
      <Scoreboard m={m} side={multi && game.mode === 'versus' ? undefined : sides[0]} />
      <div className="result" data-testid="result">
        <div className="verdict">
          <h2 className="title">{heading}</h2>
          {!multi && <span className="big">{solo.found}/11</span>}
        </div>
        {!multi && <p className="sub">{game.players[0].out ? t.gaveUp + ' ' : ''}{solo.found < 11 ? t.missedShown : t.allFound}</p>}

        {ch && (
          <div className="table">
            <div className={'trow' + (solo.found > ch.found ? ' win' : '')}><span>{t.you}</span><b>{solo.found}/11</b></div>
            <div className={'trow' + (ch.found > solo.found ? ' win' : '')}><bdi>{ch.name}</bdi><b>{ch.found}/11</b></div>
            <p className="title" data-testid="challenge-outcome">{solo.found === ch.found ? t.draw : solo.found > ch.found ? t.youWin : t.wins(ch.name)}</p>
          </div>
        )}

        {multi && (
          <div className="table">
            {[...scores].sort((a, b) => b.found - a.found).map((s, i) => (
              <div key={i} className={'trow' + (s.found === top ? ' win' : '')}><bdi>{s.name}</bdi><b>{s.found}/11</b></div>
            ))}
          </div>
        )}
        {multi && <p className="sub">{t.missedShown}</p>}

        <div className="boards">
          {sides.map(k => (
            <section key={k}>
              {sides.length > 1 && <h3>{tx(m[k].team)}</h3>}
              <Pitch kit={m[k].kit} slots={sh[k]} board={game.boards[k]!} reveal full />
            </section>
          ))}
        </div>

        <div className="panel">
          <pre className="share" data-testid="share">{shareText}</pre>
          <div className="tools">
            <button className="btn" type="button" onClick={() => copy(shareText, 'result')}>{copied === 'result' ? t.copied : t.copy}</button>
            {'share' in navigator && <button className="btn card" type="button" onClick={share}>{t.share}</button>}
          </div>

          {!multi && (
            <div className="field">
              <label className="label" htmlFor="me">{t.challengeTitle}</label>
              <div className="prow">
                <input id="me" className="input" value={me} maxLength={24} dir="auto" placeholder={t.yourName} aria-invalid={nameErr}
                  aria-describedby={nameErr ? 'me-err' : undefined}
                  onChange={e => { setMe(e.target.value); setNameErr(false) }} />
                <button className="btn card" type="button" onClick={challengeLink}>{copied === 'link' ? t.copied : t.challengeBtn}</button>
              </div>
              {nameErr && <p className="err" id="me-err" role="alert">{t.needYourName}</p>}
            </div>
          )}

          {fallback !== null && (
            <>
              <p>{t.copyFail}</p>
              <textarea className="fallback" readOnly value={fallback} ref={el => { el?.focus(); el?.select() }} />
            </>
          )}
        </div>

        <div className="tools">
          <button className="btn" type="button" onClick={again}>{t.playAgain}</button>
          <a className="ghost" href={link('/')}>{t.newGame}</a>
        </div>
      </div>
      <AdSlot slot="result" />
    </>
  )
}
