import { useEffect, useMemo, useState } from 'react'
import { listMatches, type Side } from '../data'
import type { Game } from '../game/game'
import { slots } from '../game/match'
import { Pitch } from '../components/Pitch'
import { AdSlot } from '../components/AdSlot'
import { useT } from '../i18n'

const EMPTY = { found: {}, hinted: [] }

export function Home({ resume }: { resume: Game | null }) {
  const { t } = useT()
  const [side, setSide] = useState<Side>()
  useEffect(() => {
    // A random real lineup as the hero, so the kit changes each visit.
    listMatches().then(ms => {
      const m = ms[Math.floor(Math.random() * ms.length)]
      setSide(Math.random() < 0.5 ? m.home : m.away)
    })
  }, [])
  const sl = useMemo(() => side && slots(side), [side])

  return (
    <>
      <h1 className="hero">{t.heroTitle}</h1>
      <p className="sub">{t.tagline}</p>
      <div className="heropitch">{side && sl && <Pitch kit={side.kit} slots={sl} board={EMPTY} reveal={false} full decorative />}</div>

      {resume && <a className="btn card wide" href="#/play">{t.resume}</a>}

      <nav className="fixtures" aria-label={t.modesLabel}>
        <a className="fixture" href="#/setup/solo"><b>{t.modeSolo}</b><span>{t.modeSoloDesc}</span><em className="count">{t.countSolo}</em></a>
        <a className="fixture" href="#/setup/same"><b>{t.modeSame}</b><span>{t.modeSameDesc}</span><em className="count">{t.countSame}</em></a>
        <a className="fixture" href="#/setup/versus"><b>{t.modeVersus}</b><span>{t.modeVersusDesc}</span><em className="count">{t.countVersus}</em></a>
      </nav>

      <section>
        <h3>{t.more}</h3>
        <div className="fixtures">
          <div className="fixture soon" aria-disabled="true"><b>{t.career}</b><em className="count">{t.soon}</em></div>
          <div className="fixture soon" aria-disabled="true"><b>{t.basket}</b><em className="count">{t.soon}</em></div>
        </div>
      </section>
      <AdSlot slot="home" />
    </>
  )
}
