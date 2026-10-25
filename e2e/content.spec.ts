import { expect, test } from '@playwright/test'
import matches from '../src/data/matches.json' with { type: 'json' }
import { noHorizontalScroll } from './helpers'

// Renders every lineup, fully revealed, on a small phone and checks the name tags fit.
test.describe('every lineup fits on a small phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile only')
  test.use({ viewport: { width: 360, height: 780 } })

  for (const lang of ['en', 'ar'] as const) {
    test(`all ${matches.length} matches, ${lang}`, async ({ page }) => {
      test.setTimeout(180_000)
      await page.goto('/')
      const problems: string[] = []
      for (const m of matches) {
        await page.evaluate(([id, l]) => {
          localStorage.setItem('teamsheet:v2:lang', JSON.stringify(l))
          localStorage.setItem('teamsheet:v2:game', JSON.stringify({
            matchId: id, mode: 'versus', turn: 0, done: true,
            players: [{ name: 'A', side: 'home', misses: [], hints: 0, out: true }, { name: 'B', side: 'away', misses: [], hints: 0, out: true }],
            boards: { home: { found: {}, hinted: [] }, away: { found: {}, hinted: [] } },
          }))
        }, [m.id, lang])
        await page.goto('/play')
        await page.reload()
        const pitches = page.locator('.boards .pitch')
        await expect(pitches).toHaveCount(2)
        for (let s = 0; s < 2; s++) {
          const boxes = await pitches.nth(s).locator('.tag').evaluateAll(els => els.map(e => {
            const r = e.getBoundingClientRect(), p = e.closest('.pitch')!.getBoundingClientRect()
            return { t: e.textContent, x: r.x, y: r.y, w: r.width, h: r.height, inside: r.left >= p.left - 1 && r.right <= p.right + 1 }
          }))
          expect(boxes).toHaveLength(11)
          for (const [i, a] of boxes.entries()) {
            if (!a.inside) problems.push(`${m.id} ${s ? 'away' : 'home'}: "${a.t}" sticks out of the pitch`)
            for (const b of boxes.slice(i + 1))
              if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
                problems.push(`${m.id} ${s ? 'away' : 'home'}: "${a.t}" overlaps "${b.t}"`)
          }
        }
        await noHorizontalScroll(page)
      }
      expect(problems).toEqual([])
    })
  }
})
