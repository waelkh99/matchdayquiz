import { expect, test, type APIRequestContext } from '@playwright/test'
import { fresh, matches } from './helpers'

// These read the raw HTML the server sends: what crawlers and link previews (which don't run JavaScript) see.
const SITE = 'https://xiguess.com'
const raw = async (request: APIRequestContext, path: string) => {
  const r = await request.get(path)
  expect(r.status(), path).toBe(200)
  return r.text()
}
const attr = (html: string, re: RegExp) => html.match(re)?.[1]
/** Matches a name only as a whole word: Sassi (ساسي) must not match الأساسية ("starting"). */
const words = (s: string) => ` ${s.split(/[^\p{L}\p{M}'-]+/u).filter(Boolean).join(' ')} `
const wholeWord = (name: string) => ({ test: (html: string) => words(html).includes(words(name)) })
const ld = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]))

test.describe('prerendered pages (no JavaScript)', () => {
  test.skip(({ isMobile }) => isMobile, 'server output is the same for every device')

  test('match page: title, description, canonical, hreflang, share image, structured data', async ({ request }) => {
    for (const lang of ['en', 'ar'] as const) {
      const path = (lang === 'ar' ? '/ar' : '') + '/match/bar-mun-2009'
      const html = await raw(request, path)
      expect(html).toContain(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`)
      expect(attr(html, /<title>([^<]+)<\/title>/)).toContain(lang === 'ar' ? 'برشلونة 2–0 مانشستر يونايتد' : 'Barcelona 2–0 Manchester United, 2009 Champions League Final')
      expect(attr(html, /<meta name="description" content="([^"]+)"/)!.length).toBeGreaterThan(80)
      expect(attr(html, /<link rel="canonical" href="([^"]+)"/)).toBe(SITE + path)
      expect(attr(html, /hreflang="en" href="([^"]+)"/)).toBe(SITE + '/match/bar-mun-2009')
      expect(attr(html, /hreflang="ar" href="([^"]+)"/)).toBe(SITE + '/ar/match/bar-mun-2009')
      expect(attr(html, /hreflang="x-default" href="([^"]+)"/)).toBe(SITE + '/match/bar-mun-2009')
      expect(attr(html, /<meta name="robots" content="([^"]+)"/)).toBe('index,follow')
      expect(attr(html, /<meta property="og:image" content="([^"]+)"/)).toBe(SITE + '/og/bar-mun-2009.jpg')
      expect(attr(html, /<meta name="twitter:card" content="([^"]+)"/)).toBe('summary_large_image')
      const [event, crumbs] = ld(html)
      expect(event).toMatchObject({ '@type': 'SportsEvent', startDate: '2009-05-27', homeTeam: { '@type': 'SportsTeam' }, awayTeam: { '@type': 'SportsTeam' } })
      expect(crumbs['@type']).toBe('BreadcrumbList')
      expect(html).toMatch(/<h1[^>]*>[^<]+<\/h1>/) // real content, not an empty #root
    }
  })

  test('share images exist for every match', async ({ request }) => {
    for (const img of ['default', ...matches.map(m => m.id)]) {
      const r = await request.get(`/og/${img}.jpg`)
      expect(r.status(), img).toBe(200)
      expect(r.headers()['content-type']).toContain('image/jpeg')
    }
  })

  test('no page gives the answers away', async ({ request }) => {
    for (const m of matches) for (const lang of ['en', 'ar'] as const) {
      const html = (await raw(request, (lang === 'ar' ? '/ar' : '') + `/match/${m.id}`)).toLowerCase()
      // words that legitimately appear: teams, competition, venue, note
      const context = [m.home.team, m.away.team, m.comp, m.venue, m.note].filter(Boolean).flatMap(x => [x!.en, x!.ar]).join(' ').toLowerCase()
      for (const side of [m.home, m.away]) for (const p of side.rows.flat()) {
        for (const name of [p.name, p.short, p.ar ?? ''].map(n => n.toLowerCase()).filter(n => n.length >= 4 && !context.includes(n)))
          expect(wholeWord(name).test(html), `${m.id} (${lang}) leaks "${name}"`).toBe(false)
      }
    }
  })

  test('home and the match index link to every match page', async ({ request }) => {
    const home = await raw(request, '/')
    for (const p of ['/matches', '/setup/solo', '/setup/same', '/setup/versus']) expect(home).toContain(`href="${p}"`)
    for (const lang of ['', '/ar']) {
      const index = await raw(request, lang + '/matches')
      for (const m of matches) expect(index, m.id).toContain(`href="${lang}/match/${m.id}"`)
    }
  })

  test('setup and play pages are noindex', async ({ request }) => {
    for (const p of ['/setup/solo', '/ar/setup/versus', '/play']) expect(await raw(request, p)).toContain('<meta name="robots" content="noindex" />')
  })

  test('sitemap lists every indexable page in both languages, and they all load', async ({ request }) => {
    const xml = await raw(request, '/sitemap.xml')
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
    expect(locs).toHaveLength((2 + matches.length) * 2)
    expect(locs).toContain(SITE + '/')
    expect(locs).toContain(SITE + '/ar/match/arg-ksa-2022')
    expect(xml).not.toContain('/setup/')
    for (const loc of locs) {
      const html = await raw(request, loc.replace(SITE, '') || '/')
      expect(attr(html, /<link rel="canonical" href="([^"]+)"/), loc).toBe(loc)
    }
  })

  test('robots.txt points at the sitemap', async ({ request }) => {
    const txt = await raw(request, '/robots.txt')
    expect(txt).toContain(`Sitemap: ${SITE}/sitemap.xml`)
    expect(txt).toContain('Disallow: /play')
  })
})

test.describe('in the app', () => {
  test('navigation keeps title and canonical in step, and back works', async ({ page }) => {
    await fresh(page)
    await page.getByRole('link', { name: 'Browse all matches' }).click()
    await expect(page).toHaveURL(/\/matches$/)
    await expect(page).toHaveTitle('All matches · XI Guess')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', SITE + '/matches')
    await page.locator('a[href="/match/bar-mun-2009"]').first().click()
    await expect(page).toHaveTitle(/^Barcelona 2–0 Manchester United/)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', SITE + '/match/bar-mun-2009')
    await page.getByRole('link', { name: 'عربي' }).click()
    await expect(page).toHaveURL(/\/ar\/match\/bar-mun-2009$/)
    await expect(page).toHaveTitle(/^برشلونة/)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', SITE + '/ar/match/bar-mun-2009')
    await page.goBack()
    await expect(page).toHaveURL(/\/match\/bar-mun-2009$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/matches$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('All matches')
  })

  test('match page: pick a side to play, or take it to friends', async ({ page }) => {
    await fresh(page, '/match/bar-mun-2009')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Barcelona v Manchester United: name both lineups')
    await page.getByRole('button', { name: "Name Manchester United's XI" }).click()
    await expect(page).toHaveURL(/\/play$/)
    await expect(page.locator('.task')).toContainText("Manchester United's starting XI")
    await page.goto('/match/bar-mun-2009')
    await page.getByRole('link', { name: 'Team vs team' }).click()
    await expect(page).toHaveURL(/\/setup\/versus\?m=bar-mun-2009$/)
    await expect(page.locator('[data-match="bar-mun-2009"]')).toHaveAttribute('aria-pressed', 'true')
  })

  test('unknown match id says so and offers the list', async ({ page }) => {
    await fresh(page, '/match/no-such-match')
    await expect(page.getByRole('alert')).toHaveText("That match isn't in the list.")
    await page.getByRole('link', { name: 'Browse all matches' }).click()
    await expect(page).toHaveURL(/\/matches$/)
  })

  test('old hash links still work', async ({ page }) => {
    await page.goto('/#/setup/solo')
    await expect(page).toHaveURL(/\/setup\/solo$/)
    await expect(page.getByRole('heading', { name: 'Solo' })).toBeVisible()
    const code = btoa(JSON.stringify(['bar-mun-2009', 'home', 'Ahmed', 7, 0, 2])).replace(/=+$/, '')
    await page.goto('/#/c/' + code)
    await expect(page).toHaveURL(new RegExp('/match/bar-mun-2009[?]c='))
    await expect(page.getByTestId('challenge-intro')).toHaveText('Ahmed named 7/11 of this XI. Can you beat it?')
  })

  test('Arabic links stay Arabic even for someone who chose English', async ({ page }) => {
    await fresh(page)
    await page.goto('/ar/matches')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('كل المباريات')
  })
})
