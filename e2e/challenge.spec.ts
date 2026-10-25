import { expect, test } from '@playwright/test'
import { BARCA, fresh, guess, startSolo } from './helpers'

const code = (v: unknown) => btoa(JSON.stringify(v)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

test.describe('challenge links', () => {
  test.beforeEach(({ browserName }) => test.skip(browserName !== 'chromium', 'clipboard permissions'))

  test('send a challenge, friend opens it, plays the same XI and sees the comparison', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await startSolo(page)
    await guess(page, ...BARCA.slice(0, 9), 'a', 'b', 'c', 'd', 'e')

    // name is required
    await page.getByRole('button', { name: 'Copy challenge link' }).click()
    await expect(page.getByRole('alert')).toHaveText('Add your name so your friend knows who to beat.')
    await expect(page.getByLabel('Your name, so your friend knows who sent it')).toHaveAttribute('aria-invalid', 'true')
    await page.getByLabel('Your name, so your friend knows who sent it').fill('Ahmed')
    await page.getByRole('button', { name: 'Copy challenge link' }).click()
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
    const text = await page.evaluate(() => navigator.clipboard.readText())
    expect(text).toContain('9/11 · 5 misses')
    const url = text.match(/https?:\/\/\S+\/match\/bar-mun-2009\?c=[A-Za-z0-9_-]+/)?.[0]
    expect(url).toBeTruthy()

    // the friend, in a fresh browser
    const friend = await context.browser()!.newContext()
    const p2 = await friend.newPage()
    await p2.goto(url!)
    await expect(p2.getByTestId('challenge-intro')).toHaveText('Ahmed named 9/11 of this XI. Can you beat it?')
    await expect(p2.locator('.score .t')).toHaveText('Barcelona') // the challenged side is underlined
    await p2.getByRole('button', { name: 'Take the challenge' }).click()
    await guess(p2, ...BARCA)
    await expect(p2.getByTestId('challenge-outcome')).toHaveText('You win')
    await expect(p2.locator('.trow.win')).toContainText('You')
    await expect(p2.locator('.trow').nth(1)).toContainText('Ahmed')
    await friend.close()
  })

  test('the name box starts empty for every game and shows exactly what the friend will see', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await startSolo(page)
    await guess(page, 'Messi', 'a', 'b', 'c', 'd', 'e')
    await expect(page.getByTestId('challenge-preview')).toHaveCount(0)
    await page.getByLabel('Your name, so your friend knows who sent it').fill('Sara')
    await expect(page.getByTestId('challenge-preview')).toHaveText('Your friend will see: “Sara named 1/11 of this XI. Can you beat it?”')
    await page.getByRole('button', { name: 'Copy challenge link' }).click()
    // someone else plays next on the same phone: no name carried over
    await page.getByRole('button', { name: 'Play again' }).click()
    await guess(page, 'a', 'b', 'c', 'd', 'e')
    await expect(page.getByLabel('Your name, so your friend knows who sent it')).toHaveValue('')
    await page.reload()
    await expect(page.getByLabel('Your name, so your friend knows who sent it')).toHaveValue('')
  })

})

test('broken challenge links show an error with a way out', async ({ page }) => {
  await fresh(page, '/c/not-a-real-code')
  await expect(page.getByRole('alert')).toHaveText('This challenge link is broken or out of date.')
  await page.getByRole('link', { name: 'New game' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('challenge for a match that does not exist is rejected', async ({ page }) => {
  await fresh(page, '/c/' + code(['gone-1900', 'home', 'A', 5, 0, 0]))
  await expect(page.getByRole('alert')).toHaveText("That match isn't in the list.")
})

test('challenger names are rendered as text, not HTML', async ({ page }) => {
  let dialog = false
  page.on('dialog', d => { dialog = true; d.dismiss() })
  await fresh(page, '/c/' + code(['bar-mun-2009', 'home', '<img src=x onerror=alert(1)>', 5, 0, 0]))
  await expect(page.getByTestId('challenge-intro')).toContainText('<img src=x')
  await expect(page.locator('img')).toHaveCount(0)
  expect(dialog).toBe(false)
})
