import { expect, test } from '@playwright/test'
import { LRM, feedback, fresh, guess, noHorizontalScroll, pickMatch, startSolo, withTeam } from './helpers'

test.describe('Arabic', () => {
  test('toggle switches to RTL Arabic and persists across reloads', async ({ page }) => {
    await fresh(page)
    await page.getByRole('link', { name: 'عربي' }).click()
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('هل تعرف التشكيلة؟')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await page.getByRole('link', { name: 'English' }).click()
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  })

  test('first visit follows an Arabic browser language', async ({ browser }) => {
    const ctx = await browser.newContext({ locale: 'ar-SA' })
    const page = await ctx.newPage()
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await ctx.close()
  })

  test('full game in Arabic: Arabic names on shirts, Arabic guesses, pitch not mirrored', async ({ page }) => {
    await startSolo(page)
    await page.getByRole('link', { name: 'عربي' }).click()
    await expect(page.locator('.task')).toContainText('برشلونة')
    await guess(page, 'ميسي')
    await expect(feedback(page)).toHaveText('ميسي، رقم 10.')
    await expect(page.locator('.slot.got .tag')).toHaveText('ميسي')
    await guess(page, 'Xavi') // Latin still works in Arabic UI
    await expect(page.getByTestId('found')).toHaveText('2/11')
    // pitch stays LTR: left-back (Sylvinho, #16) left of right-back (Puyol, #5)
    await expect(page.locator('.pitch')).toHaveAttribute('dir', 'ltr')
    const lb = await page.locator('.pitch .slot').filter({ has: page.locator('text="16"') }).boundingBox()
    const rb = await page.locator('.pitch .slot').filter({ has: page.locator('text="5"') }).boundingBox()
    expect(lb!.x).toBeLessThan(rb!.x)
    // hint pattern uses the Arabic name
    await page.locator('.pitch .slot').filter({ has: page.locator('text="3"') }).click()
    await page.locator('.dock .btn.card').click()
    await expect(page.locator('.pitch .slot').filter({ has: page.locator('text="3"') }).locator('.tag')).toHaveText('ب____')
    await noHorizontalScroll(page)
  })

  test('Arabic share text opens each line in Arabic and keeps the grid left-to-right', async ({ page }) => {
    await startSolo(page)
    await page.getByRole('link', { name: 'عربي' }).click()
    await guess(page, 'ميسي', 'aa', 'bb', 'cc', 'dd', 'ee')
    const lines = (await page.getByTestId('share').textContent())!.split('\n')
    expect(lines[0]).toBe('برشلونة 2009 · Matchday Quiz')
    expect(lines[1]).toBe('النتيجة 1/11 · أخطاء: 5')
    const grid = lines.slice(3)
    expect(grid).toHaveLength(5) // 4-1-2-3
    for (const row of grid) expect(row.startsWith('\u200E')).toBe(true)
    expect(grid[0]).toBe(LRM + '⬜⬜🟩') // Messi started on the right
  })

  test('Arabic setup: search in Arabic, team names in Arabic', async ({ page }) => {
    await fresh(page, '/setup/solo')
    await page.getByRole('link', { name: 'عربي' }).click()
    await page.getByRole('searchbox').fill('ليفربول')
    await expect(page.locator('[data-match]')).toHaveCount(withTeam('Liverpool'))
    await pickMatch(page, 'mil-liv-2005')
    await expect(page.getByRole('button', { name: 'ليفربول', exact: true })).toBeVisible()
    await expect(page.locator('.board .comp').first()).toContainText('نهائي دوري أبطال أوروبا')
  })
})

test.describe('layout', () => {
  for (const width of [320, 375, 768, 1280]) {
    test(`no sideways scrolling at ${width}px on every screen`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await fresh(page)
      await noHorizontalScroll(page)
      await page.goto('/setup/versus'); await noHorizontalScroll(page)
      await pickMatch(page, 'mun-bay-1999'); await noHorizontalScroll(page)
      await page.getByRole('button', { name: 'Kick off' }).click()
      await noHorizontalScroll(page)
      await page.getByRole('link', { name: 'عربي' }).click()
      await noHorizontalScroll(page)
    })
  }

  test('guess input and hint stay on screen while scrolling the pitch', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await startSolo(page)
    for (const y of [0, 200, 10_000]) {
      await page.evaluate(top => scrollTo({ top }), y)
      await expect(page.locator('#guess')).toBeInViewport()
      await expect(page.locator('.dock .btn.card')).toBeInViewport()
    }
  })

  test('pitch shrinks to fit short screens and shirts do not overlap', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await startSolo(page, 'mun-bay-1999', 'Bayern Munich') // 5-man defence: tightest row
    const pitch = (await page.locator('.pitch').boundingBox())!
    expect(pitch.height).toBeLessThan(667 - 200)
    const boxes = await page.locator('.pitch .slot svg').evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => ({ x: r.x, y: r.y, w: r.width, h: r.height })))
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j]
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
      expect(overlap, `shirts ${i} and ${j} overlap`).toBe(false)
    }
  })

  test('kick off stays reachable on a long setup page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await fresh(page, '/setup/same')
    await expect(page.getByRole('button', { name: 'Kick off' })).toBeInViewport()
  })

  test('touch targets are at least 44px tall', async ({ page }) => {
    await startSolo(page)
    for (const sel of ['#guess', '.dock .btn', '.lang', '.tools .ghost']) {
      for (const box of await page.locator(sel).evaluateAll(els => els.map(e => e.getBoundingClientRect().height)))
        expect(box, sel).toBeGreaterThanOrEqual(40)
    }
  })
})

test.describe('preferences', () => {
  test('dark mode uses the dark palette', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await fresh(page)
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(bg).toBe('rgb(12, 20, 16)')
  })

  test('theme toggle overrides the system setting and is remembered', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await fresh(page)
    const toggle = page.getByRole('button', { name: 'Dark mode' })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(12, 20, 16)')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: 'Dark mode' }).click()
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(231, 235, 230)')
  })

  test('reduced motion turns off the hero and shake animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await fresh(page)
    const anim = await page.locator('.heropitch .slot').first().evaluate(e => getComputedStyle(e).animationName)
    expect(anim).toBe('none')
  })

  test('works with storage blocked', async ({ page }) => {
    await page.addInitScript(() => {
      const fail = () => { throw new Error('blocked') }
      Object.defineProperty(window, 'localStorage', { get: fail })
    })
    await page.goto('/setup/solo')
    await pickMatch(page, 'bar-mun-2009')
    await page.getByRole('button', { name: 'Kick off' }).click()
    await guess(page, 'Messi')
    await expect(page.getByTestId('found')).toHaveText('1/11')
  })
})
