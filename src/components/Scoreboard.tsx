import type { ReactNode } from 'react'
import type { Match, SideKey } from '../data'
import { useT } from '../i18n'

/** Match header. `side` underlines the team being guessed. */
export function Scoreboard({ m, side, children }: { m: Match; side?: SideKey; children?: ReactNode }) {
  const { tx, date } = useT()
  const cls = (k: SideKey) => (side === undefined ? '' : side === k ? 't' : 'o')
  return (
    <div className="board">
      <div className="comp"><span>{tx(m.comp)}</span><span>{date(m.date)}</span></div>
      <div className="score">
        <span className={'h ' + cls('home')}>{tx(m.home.team)}</span>
        <span className="s">{m.score}</span>
        <span className={cls('away')}>{tx(m.away.team)}</span>
      </div>
      <div className="comp"><span>{tx(m.venue)}</span><span>{m.note ? tx(m.note) : ''}</span></div>
      {children && <div className="task">{children}</div>}
    </div>
  )
}
