import { expect, test } from '@playwright/test'
import { BARCA, feedback, found, fresh, guess, pickMatch, startSolo } from './helpers'

test.describe('home', () => {
  test('shows the three modes and coming-soon modes', async ({ page }) => {
    await fresh(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Can you name the XI?')
    const nav = page.getByRole('navigation', { name: 'Game modes' })
    await expect(nav.getByRole('link')).toHaveCount(3)
    await nav.getByRole('link', { name: /Solo/ }).click()
    await expect(page).toHaveURL(/#\/setup\/solo$/)
    await page.getByRole('link', { name: 'Back' }).click()
    await expect(page).toHaveURL(/#\/$/)
    await expect(page.getByText('Career path')).toBeVisible()
    await expect(page.locator('.fixture.soon')).toHaveCount(2)
  })

  test('hero pitch is decorative: 11 shirts, hidden from assistive tech, not focusable', async ({ page }) => {
    await fresh(page)
    const hero = page.locator('.heropitch .pitch')
    await expect(hero.locator('.slot')).toHaveCount(11)
    await expect(hero).toHaveAttribute('aria-hidden', 'true')
    await expect(hero).toHaveAttribute('inert', '')
  })

  test('unknown routes fall back to home', async ({ page }) => {
    await fresh(page, '#/nope/123')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.goto('/#/play') // no saved game
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('match search', () => {
  test.beforeEach(async ({ page }) => fresh(page, '#/setup/solo'))

  test('lists every match', async ({ page }) => {
    await expect(page.locator('[data-match]')).toHaveCount(7)
  })
  test('filters by team, year, competition, combined words, and Arabic', async ({ page }) => {
    const box = page.getByRole('searchbox', { name: 'Find a match' })
    const rows = page.locator('[data-match]')
    await box.fill('liverpool'); await expect(rows).toHaveCount(1)
    await box.fill('2009'); await expect(rows).toHaveCount(1)
    await box.fill('world cup'); await expect(rows).toHaveCount(3)
    await box.fill('france 1998'); await expect(rows).toHaveCount(1)
    await box.fill('BAYERN'); await expect(rows).toHaveCount(2)
    await box.fill('munchen'); await expect(rows).toHaveCount(0) // German spelling isn't an alias
    await box.fill('برشلونة'); await expect(rows).toHaveCount(2) // Barça 2009 + the 1999 final at Camp Nou, Barcelona
    await box.fill('barcelona'); await expect(rows).toHaveCount(2)
    await box.fill('xyz'); await expect(page.getByText('No matches found.')).toBeVisible()
    await box.fill(''); await expect(rows).toHaveCount(7)
  })
  test('random picks a match and changes on the next tap', async ({ page }) => {
    await page.getByRole('button', { name: 'Random' }).click()
    const first = await page.locator('[data-match][aria-pressed="true"]').getAttribute('data-match')
    expect(first).toBeTruthy()
    await page.getByRole('button', { name: 'Random' }).click()
    const second = await page.locator('[data-match][aria-pressed="true"]').getAttribute('data-match')
    expect(second).not.toBe(first)
  })
  test('random respects the current search', async ({ page }) => {
    await page.getByRole('searchbox').fill('world cup')
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'Random' }).click()
      const id = await page.locator('[data-match][aria-pressed="true"]').getAttribute('data-match')
      expect(['ned-esp-2010', 'bra-fra-1998', 'arg-fra-2022']).toContain(id)
    }
  })
  test('kick off without a match shows an error', async ({ page }) => {
    await page.getByRole('button', { name: 'Kick off' }).click()
    await expect(page.getByRole('alert')).toHaveText('Pick a match first.')
    await pickMatch(page, 'mil-liv-2005')
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
  test('team choice: underlines the chosen team and plays that side', async ({ page }) => {
    await pickMatch(page, 'bar-mun-2009')
    await page.getByRole('button', { name: 'Man United', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Man United', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Kick off' }).click()
    await expect(page.locator('.task')).toContainText("Man United's starting XI")
    await guess(page, 'Rooney')
    await expect(feedback(page)).toHaveText('Wayne Rooney, #10.')
  })
})

test.describe('solo game', () => {
  test('starts clean', async ({ page }) => {
    await startSolo(page)
    await expect(found(page)).toHaveText('0/11')
    await expect(page.getByTestId('hints')).toHaveText('3')
    await expect(page.locator('.pitch .slot')).toHaveCount(11)
    await expect(page.locator('.tag.unknown')).toHaveCount(11)
    await expect(feedback(page)).toHaveText('Surnames are enough. Accents and small typos are fine.')
  })

  test('accepts surnames, full names, aliases, accents, typos, Arabic; rejects others', async ({ page }) => {
    await startSolo(page)
    await guess(page, 'messi'); await expect(feedback(page)).toHaveText('Lionel Messi, #10.')
    await guess(page, 'Andrés Iniesta'); await expect(feedback(page)).toHaveText('Andrés Iniesta, #8.')
    await guess(page, 'titi'); await expect(feedback(page)).toHaveText('Thierry Henry, #14.')
    await guess(page, 'PIQUÉ'); await expect(feedback(page)).toHaveText('Gerard Piqué, #3.')
    await guess(page, 'Buskets'); await expect(feedback(page)).toHaveText('Sergio Busquets, #28.')
    await guess(page, 'تشافي'); await expect(feedback(page)).toHaveText('Xavi Hernández, #6.')
    await expect(found(page)).toHaveText('6/11')
    await expect(page.locator('.slot.got')).toHaveCount(6)
    await expect(page.locator('.slot.got .tag').first()).not.toHaveText('? ? ?')
    await guess(page, 'Ronaldinho')
    await expect(feedback(page)).toHaveText("Ronaldinho didn't start this one.")
    await expect(page.getByTestId('misses')).toHaveAttribute('data-used', '1')
    await expect(page.locator('.misses s')).toHaveText(['Ronaldinho'])
  })

  test('repeat misses and already-found names cost nothing; blank input is ignored', async ({ page }) => {
    await startSolo(page)
    await guess(page, 'Ronaldinho', 'ronaldinho')
    await expect(feedback(page)).toHaveText('ronaldinho was already tried.')
    await guess(page, 'Messi', 'Messi')
    await expect(feedback(page)).toHaveText('Lionel Messi is already on the sheet.')
    await page.locator('#guess').fill('   ')
    await page.locator('#guess').press('Enter')
    await expect(page.getByTestId('misses')).toHaveAttribute('data-used', '1')
    await expect(found(page)).toHaveText('1/11')
  })

  test('win with all 11: verdict, revealed pitch, share grid', async ({ page }) => {
    await startSolo(page)
    await guess(page, ...BARCA)
    const result = page.getByTestId('result')
    await expect(result.getByRole('heading', { level: 2 })).toHaveText('Full house')
    await expect(result.locator('.big')).toHaveText('11/11')
    await expect(result.getByText('Every name on the sheet.')).toBeVisible()
    await expect(page.getByTestId('share')).toHaveText('Teamsheet · Barcelona 2009\n11/11 · 0 misses\n\n‎🟩🟩🟩\n‎🟩🟩🟩\n‎🟩🟩🟩🟩\n‎🟩')
    await expect(result.locator('.tag.missed')).toHaveCount(0)
    await expect(page.locator('#guess')).toHaveCount(0)
  })

  test('lose after 5 distinct misses: the missed players are revealed', async ({ page }) => {
    await startSolo(page)
    await guess(page, 'Messi', 'Aa', 'Bb', 'Cc', 'Dd')
    await expect(page.getByTestId('misses')).toHaveAttribute('data-used', '4')
    await guess(page, 'Ee')
    const result = page.getByTestId('result')
    await expect(result.getByRole('heading', { level: 2 })).toHaveText('Back to the archive')
    await expect(result.locator('.big')).toHaveText('1/11')
    await expect(result.locator('.tag.missed')).toHaveCount(10)
    await expect(result.locator('.tag.missed').first()).not.toHaveText('? ? ?')
    await expect(page.getByTestId('share')).toContainText('1/11 · 5 misses')
  })

  test('hints: pick a shirt, see first letter and length, max 3, grid shows yellow', async ({ page }) => {
    await startSolo(page)
    const hintBtn = page.locator('.dock .btn.card')
    await expect(hintBtn).toHaveText('Tap a shirt for a hint')
    await expect(hintBtn).toBeDisabled()
    const messi = page.locator('.pitch .slot', { hasText: '10' })
    await messi.click()
    await expect(messi).toHaveAttribute('aria-pressed', 'true')
    await expect(hintBtn).toHaveText('Hint for #10')
    await hintBtn.click()
    await expect(messi.locator('.tag')).toHaveText('M____')
    await expect(page.getByTestId('hints')).toHaveText('2')
    await expect(feedback(page)).toHaveText('Hint used on #10.')
    await expect(hintBtn).toBeDisabled() // already hinted
    for (const num of ['8', '6']) {
      await page.locator('.pitch .slot').filter({ has: page.locator(`text="${num}"`) }).click()
      await hintBtn.click()
    }
    await expect(page.getByTestId('hints')).toHaveText('0')
    await page.locator('.pitch .slot').filter({ has: page.locator('text="9"') }).click()
    await expect(hintBtn).toHaveText('No hints left')
    await expect(hintBtn).toBeDisabled()
    await guess(page, 'Messi')
    await guess(page, 'zz', 'yy', 'xx', 'ww', 'vv')
    await expect(page.getByTestId('share')).toContainText('1/11 · 3 hints · 5 misses')
    await expect(page.getByTestId('share')).toContainText('⬜🟨⬜')
  })

  test('selecting a shirt then finding that player clears the selection', async ({ page }) => {
    await startSolo(page)
    const messi = page.locator('.pitch .slot').filter({ has: page.locator('text="10"') })
    await messi.click()
    await guess(page, 'Messi')
    await expect(messi).toBeDisabled()
    await expect(page.locator('.dock .btn.card')).toHaveText('Tap a shirt for a hint')
  })

  test('give up needs a second tap and reveals the XI', async ({ page }) => {
    await startSolo(page)
    await guess(page, 'Messi')
    const btn = page.getByRole('button', { name: 'Give up' })
    await btn.click()
    await expect(page.getByRole('button', { name: 'Tap again to reveal the XI' })).toBeVisible()
    await expect(page.locator('#guess')).toBeVisible()
    await page.getByRole('button', { name: 'Tap again to reveal the XI' }).click()
    await expect(page.getByTestId('result')).toContainText('You gave up.')
    await expect(page.getByTestId('result').locator('.tag.missed')).toHaveCount(10)
  })

  test('give up disarms itself after a few seconds', async ({ page }) => {
    await startSolo(page)
    await page.getByRole('button', { name: 'Give up' }).click()
    await expect(page.getByRole('button', { name: 'Give up' })).toBeVisible({ timeout: 5000 })
  })

  test('progress survives a reload and home offers to continue', async ({ page }) => {
    await startSolo(page)
    await guess(page, 'Messi', 'Nobody')
    await page.reload()
    await expect(found(page)).toHaveText('1/11')
    await expect(page.getByTestId('misses')).toHaveAttribute('data-used', '1')
    await page.goto('/#/')
    await page.getByRole('link', { name: 'Continue your game' }).click()
    await expect(found(page)).toHaveText('1/11')
  })

  test('a corrupted or outdated saved game recovers instead of a blank screen', async ({ page }) => {
    await fresh(page)
    await page.evaluate(() => localStorage.setItem('teamsheet:v2:game', JSON.stringify({ matchId: 'bar-mun-2009', mode: 'solo', players: [], boards: {}, turn: 0, done: false })))
    await page.goto('/#/play')
    await page.reload() // a hash-only goto doesn't reload, and the saved game is read at startup
    await page.getByRole('link', { name: /Something went wrong/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('teamsheet:v2:game'))).toBeNull()
    await page.evaluate(() => localStorage.setItem('teamsheet:v2:game', '{not json'))
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('play again restarts the same match; new game goes home', async ({ page }) => {
    await startSolo(page)
    await guess(page, 'a', 'b', 'c', 'd', 'e')
    await page.getByRole('button', { name: 'Play again' }).click()
    await expect(found(page)).toHaveText('0/11')
    await expect(page.locator('.task')).toContainText("Barcelona's starting XI")
    await guess(page, 'a', 'b', 'c', 'd', 'e')
    await page.getByRole('link', { name: 'New game' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Continue your game' })).toHaveCount(0) // finished games aren't offered
  })

  test('copy result puts the share text on the clipboard', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await startSolo(page)
    await guess(page, 'Messi', 'a', 'b', 'c', 'd', 'e')
    await page.getByRole('button', { name: 'Copy result' }).click()
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
    const text = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n') // Windows clipboard uses CRLF
    expect(text).toBe(await page.getByTestId('share').textContent())
  })

  test('copy falls back to a selectable textarea when the clipboard is blocked', async ({ page }) => {
    await startSolo(page)
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } }))
    await guess(page, 'a', 'b', 'c', 'd', 'e')
    await page.getByRole('button', { name: 'Copy result' }).click()
    await expect(page.getByText("Copy didn't work here.")).toBeVisible()
    await expect(page.locator('textarea.fallback')).toHaveValue(/Teamsheet · Barcelona 2009/)
  })
})
