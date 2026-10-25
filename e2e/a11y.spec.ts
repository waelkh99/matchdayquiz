import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { fresh, guess, pickMatch, startSolo } from './helpers'

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([])
}

for (const lang of ['en', 'ar'] as const) for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe ${lang} ${scheme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
      await page.addInitScript(l => localStorage.setItem('teamsheet:v2:lang', JSON.stringify(l)), lang)
    })
    test('home', async ({ page }) => { await page.goto('/'); await axe(page) })
    test('setup', async ({ page }) => {
      await page.goto('/#/setup/versus')
      await pickMatch(page, 'bar-mun-2009')
      await axe(page)
    })
    test('play', async ({ page }) => {
      await page.goto('/#/setup/solo')
      await pickMatch(page, 'bar-mun-2009')
      await page.locator('.dock .btn').click()
      await guess(page, 'Messi', 'Nobody')
      await page.locator('.pitch .slot').nth(1).click()
      await axe(page)
    })
    test('result', async ({ page }) => {
      await page.goto('/#/setup/solo')
      await pickMatch(page, 'bar-mun-2009')
      await page.locator('.dock .btn').click()
      await guess(page, 'Messi', 'a', 'b', 'c', 'd', 'e')
      await axe(page)
    })
  })
}

test('keyboard only: play a guess and use a hint without a mouse', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard flow is a desktop concern')
  await startSolo(page)
  await page.locator('.pitch .slot').first().focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.pitch .slot').first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#guess')).toBeFocused()
  await page.keyboard.type('Valdes')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('found')).toHaveText('1/11')
  await expect(page.locator('#guess')).toBeFocused()
})

test('shirts announce their number and state', async ({ page }) => {
  await startSolo(page)
  await expect(page.getByRole('button', { name: 'Shirt 10 unknown' })).toBeVisible()
  await page.getByRole('button', { name: 'Shirt 9 unknown' }).click()
  await page.locator('.dock .btn.card').click()
  await expect(page.getByRole('button', { name: "Shirt 9 hint: starts with E, 4 letters" })).toBeVisible() // Eto'o
  await guess(page, 'Messi')
  await expect(page.getByRole('button', { name: 'Shirt 10 Messi' })).toBeDisabled()
})

test('feedback is announced to screen readers', async ({ page }) => {
  await fresh(page, '#/setup/solo')
  await pickMatch(page, 'bar-mun-2009')
  await page.getByRole('button', { name: 'Kick off' }).click()
  await expect(page.getByTestId('feedback')).toHaveAttribute('aria-live', 'polite')
})
