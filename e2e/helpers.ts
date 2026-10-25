import { expect, type Page } from '@playwright/test'
import matches from '../src/data/matches.json' with { type: 'json' }

export { matches }
/** Left-to-right mark that starts every share-grid row. */
export const LRM = String.fromCharCode(0x200e)
/** How many matches involve this team (English name). */
export const withTeam = (team: string) => matches.filter(m => m.home.team.en === team || m.away.team.en === team).length

export const BARCA = ['Valdes', 'Sylvinho', 'Toure', 'Pique', 'Puyol', 'Iniesta', 'Busquets', 'Xavi', 'Henry', 'Messi', "Eto'o"]
export const UTD = ['Van der Sar', 'Evra', 'Vidic', 'Ferdinand', "O'Shea", 'Giggs', 'Carrick', 'Anderson', 'Rooney', 'Ronaldo', 'Park']

/** Fresh visit: empty storage, English. */
export async function fresh(page: Page, hash = '#/') {
  await page.goto('/' + hash)
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('teamsheet:v2:lang', '"en"') })
  await page.reload()
}

export async function pickMatch(page: Page, id: string) {
  await page.locator(`[data-match="${id}"]`).click()
  await expect(page.locator(`[data-match="${id}"]`)).toHaveAttribute('aria-pressed', 'true')
}

export async function startSolo(page: Page, id = 'bar-mun-2009', team?: string) {
  await fresh(page, '#/setup/solo')
  await pickMatch(page, id)
  if (team) await page.getByRole('button', { name: team, exact: true }).click()
  await page.getByRole('button', { name: 'Kick off' }).click()
  await expect(page).toHaveURL(/#\/play$/)
}

export async function guess(page: Page, ...names: string[]) {
  const input = page.locator('#guess')
  for (const n of names) {
    await input.fill(n)
    await input.press('Enter')
    // Cleared input, or the game just ended and the result replaced it.
    await expect(input.or(page.getByTestId('result'))).toBeVisible()
    if (await input.count()) await expect(input).toHaveValue('')
  }
}

export const feedback = (page: Page) => page.getByTestId('feedback')
export const found = (page: Page) => page.getByTestId('found')

export async function noHorizontalScroll(page: Page) {
  const { scroll, client, offenders } = await page.evaluate(() => {
    const w = document.documentElement.clientWidth
    const offenders = [...document.querySelectorAll('body *')]
      .filter(e => {
        const r = e.getBoundingClientRect()
        const textSpills = e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible' && e.clientWidth > 0
        return r.right > w + 0.5 || r.left < -0.5 || (textSpills && r.right + e.scrollWidth - e.clientWidth > w + 0.5)
      })
      .slice(0, 5).map(e => `${e.tagName.toLowerCase()}.${e.className} (${Math.round(e.getBoundingClientRect().left)}..${Math.round(e.getBoundingClientRect().right)})`)
    return { scroll: document.documentElement.scrollWidth, client: w, offenders }
  })
  expect(scroll, `page must not scroll sideways; overflowing: ${offenders.join(', ')}`).toBeLessThanOrEqual(client)
}
