import { useId } from 'react'
import type { Kit } from '../data'
import type { Board } from '../game/game'
import { pattern, type Slot } from '../game/match'
import { useT } from '../i18n'

const GK = { a: '#cfd84a', num: '#16200c' }
const SHIRT = 'M13 4 L7 6.5 L1.5 13 L6 19 L10 16.5 L10 37 L30 37 L30 16.5 L34 19 L38.5 13 L33 6.5 L27 4 Q20 9.5 13 4 Z'

type Props = {
  kit: Kit
  slots: Slot[]
  board: Board
  reveal: boolean
  selected?: number | null
  pop?: number | null
  onSelect?: (i: number) => void
  /** Full container width instead of fitting the viewport height. */
  full?: boolean
  /** Hidden from assistive tech and not focusable (home hero). */
  decorative?: boolean
}

export function Pitch({ kit, slots, board, reveal, selected = null, pop = null, onSelect, full, decorative }: Props) {
  const { t, short } = useT()
  const fill = useId().replace(/:/g, '') + 'kit'
  return (
    <div className={full ? 'pitch full' : 'pitch'} dir="ltr" aria-hidden={decorative || undefined} inert={decorative || undefined}>
      <svg className="lines" viewBox="0 0 68 92" aria-hidden="true">
        <defs>
          {kit.stripes
            ? <pattern id={fill} width="10" height="40" patternUnits="userSpaceOnUse"><rect width="5" height="40" fill={kit.a} /><rect x="5" width="5" height="40" fill={kit.b} /></pattern>
            : <pattern id={fill} width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill={kit.a} /></pattern>}
        </defs>
        <g fill="none" stroke="var(--chalk)" strokeWidth=".35">
          <rect x="2" y="2" width="64" height="88" />
          <line x1="2" y1="46" x2="66" y2="46" />
          <circle cx="34" cy="46" r="9.15" />
          <rect x="13.84" y="2" width="40.32" height="16.5" />
          <rect x="24.84" y="2" width="18.32" height="5.5" />
          <rect x="13.84" y="73.5" width="40.32" height="16.5" />
          <rect x="24.84" y="84.5" width="18.32" height="5.5" />
          <path d="M26.7 18.5 A9.15 9.15 0 0 0 41.3 18.5" />
          <path d="M26.7 73.5 A9.15 9.15 0 0 1 41.3 73.5" />
        </g>
        <g fill="var(--chalk)"><circle cx="34" cy="46" r=".5" /><circle cx="34" cy="13" r=".45" /><circle cx="34" cy="79" r=".45" /></g>
      </svg>
      {slots.map(p => {
        const got = p.i in board.found
        const hinted = board.hinted.includes(p.i)
        const name = short(p)
        const [label, cls] = got ? [name, 'tag'] : reveal ? [name, 'tag missed'] : hinted ? [pattern(name), 'tag hinted'] : ['? ? ?', 'tag unknown']
        const cls2 = ['slot', got && 'got', selected === p.i && 'sel', pop === p.i && 'pop'].filter(Boolean).join(' ')
        return (
          <button
            key={p.i} type="button" className={cls2} data-slot={p.i}
            style={{ left: p.x + '%', top: p.y + '%', ['--i' as string]: p.i }}
            disabled={got || reveal || !onSelect}
            aria-pressed={onSelect ? selected === p.i : undefined}
            onClick={() => onSelect?.(p.i)}
          >
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <path d={SHIRT} fill={p.gk ? GK.a : `url(#${fill})`} stroke="rgba(0,0,0,.35)" strokeWidth=".8" />
              <text x="20" y="28.5" textAnchor="middle" fontFamily="Big Shoulders Display, Impact, sans-serif" fontWeight="900" fontSize="15"
                fill={p.gk ? GK.num : kit.num} stroke="rgba(0,0,0,.25)" strokeWidth=".4">{p.num}</text>
            </svg>
            {/* Accessible name comes from content: "Shirt 10 Messi", "Shirt 10 unknown", "Shirt 10 hint: starts with M, 5 letters" */}
            <span className="vh">{t.shirtNo(p.num)} </span>
            <span className={cls} aria-hidden={got || reveal ? undefined : true}>{label}</span>
            {!got && !reveal && <span className="vh">{hinted ? t.hintA11y(name[0], [...name].filter(c => !/[\s'.-]/.test(c)).length) : t.unknown}</span>}
          </button>
        )
      })}
    </div>
  )
}
