// After `vite build`: writes a static HTML file per page and language, plus sitemap.xml and robots.txt.
// Crawlers and link previews (WhatsApp, X, iMessage don't run JavaScript) get a real title, description,
// share image and readable content. React replaces the static content when it starts.
// Never put player names here: the page must not give the answers away.
//   node scripts/prerender.ts            (Node 24 runs TypeScript directly)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import matchesJson from '../src/data/matches.json' with { type: 'json' }
import { BRAND, BRAND_SPLIT, SITE_URL } from '../src/brand.ts'
import { fixture, meta, type Lang, type Meta, type Page } from '../src/seo.ts'
import { ar as arText, en as enText } from '../src/strings.ts'
import type { Match } from '../src/data/index.ts'

const matches = matchesJson as Match[]
const DIST = 'dist'
const template = readFileSync(join(DIST, 'index.html'), 'utf8')
const START = '<!--seo:', END = '<!--/seo-->'
if (!template.includes(START) || !template.includes(END) || !template.includes('<div id="root"></div>')) throw new Error('dist/index.html is missing the seo markers or #root')

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const ldJson = (o: object) => JSON.stringify(o).split('<').join(String.fromCharCode(92) + 'u003c') // keep "</script>" out of JSON-LD
const prefix = (lang: Lang, path: string) => (lang === 'ar' ? (path === '/' ? '/ar' : '/ar' + path) : path)
const abs = (lang: Lang, path: string) => SITE_URL + prefix(lang, path)
const text = (lang: Lang) => (lang === 'ar' ? arText : enText)
const date = (iso: string, lang: Lang) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function head(m: Meta, lang: Lang) {
  const url = abs(lang, m.path)
  return [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
    `<meta name="robots" content="${m.noindex ? 'noindex' : 'index,follow'}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<link rel="alternate" hreflang="en" href="${abs('en', m.path)}" />`,
    `<link rel="alternate" hreflang="ar" href="${abs('ar', m.path)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${abs('en', m.path)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(BRAND)}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${m.image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:locale" content="${lang === 'ar' ? 'ar_AR' : 'en_GB'}" />`,
    `<meta property="og:locale:alternate" content="${lang === 'ar' ? 'en_GB' : 'ar_AR'}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${m.image}" />`,
    ...(m.jsonLd ?? []).map(o => `<script type="application/ld+json">${ldJson(o)}</script>`),
  ].join('\n    ')
}

const row = (m: Match, lang: Lang, grouped = true) =>
  `<a class="row" href="${prefix(lang, `/match/${m.id}`)}"><span class="rt">${esc(fixture(m, lang))}</span><span class="rs"><span>${esc(grouped ? m.venue[lang] : m.comp[lang])}</span><span>${date(m.date, lang)}</span></span></a>`

function body(page: Page, lang: Lang, path: string) {
  const t = text(lang)
  const other: Lang = lang === 'ar' ? 'en' : 'ar'
  const header = `<header><a class="brand" href="${prefix(lang, '/')}">${BRAND.slice(0, BRAND_SPLIT)}<span>${BRAND.slice(BRAND_SPLIT)}</span></a>`
    + `<a class="lang" lang="${other}" hreflang="${other}" href="${prefix(other, path)}">${other === 'ar' ? 'عربي' : 'English'}</a></header>`
  let main = ''
  switch (page.kind) {
    case 'home':
      main = `<h1 class="hero">${esc(t.heroTitle)}</h1><p class="sub">${esc(t.tagline)}</p>`
        + `<nav class="fixtures">${(['solo', 'same', 'versus'] as const).map(k => {
          const [name, desc] = k === 'solo' ? [t.modeSolo, t.modeSoloDesc] : k === 'same' ? [t.modeSame, t.modeSameDesc] : [t.modeVersus, t.modeVersusDesc]
          return `<a class="fixture" href="${prefix(lang, `/setup/${k}`)}"><b>${esc(name)}</b><span>${esc(desc)}</span></a>`
        }).join('')}</nav>`
        + `<a class="btn wide" href="${prefix(lang, '/matches')}">${esc(t.browseAll)}</a>`
        + `<nav class="list">${matches.slice(0, 12).map(m => row(m, lang, false)).join('')}</nav>`
      break
    case 'matches': {
      const groups = new Map<string, Match[]>()
      for (const m of matches) groups.set(m.comp.en, [...(groups.get(m.comp.en) ?? []), m])
      main = `<h1 class="title">${esc(t.allMatches)}</h1>` + [...groups.values()].map(ms =>
        `<section><h2 class="label">${esc(ms[0].comp[lang])}</h2><nav class="list">${ms.map(m => row(m, lang)).join('')}</nav></section>`).join('')
      break
    }
    case 'match': {
      const m = page.match
      const related = matches.filter(x => x.id !== m.id && x.comp.en === m.comp.en).slice(0, 6)
      main = `<div class="board"><div class="comp"><span>${esc(m.comp[lang])}</span><span>${date(m.date, lang)}</span></div>`
        + `<div class="score"><span class="h">${esc(m.home.team[lang])}</span><span class="s">${esc(m.score)}</span><span>${esc(m.away.team[lang])}</span></div>`
        + `<div class="comp"><span>${esc(m.venue[lang])}</span><span>${m.note ? esc(m.note[lang]) : ''}</span></div></div>`
        + `<h1 class="title">${esc(t.matchH1(m.home.team[lang], m.away.team[lang]))}</h1><p class="sub">${esc(t.matchIntro)}</p>`
        + `<section><h3>${esc(t.withFriends)}</h3><div class="tools"><a class="btn" href="${prefix(lang, `/setup/same?m=${m.id}`)}">${esc(t.modeSame)}</a>`
        + `<a class="btn" href="${prefix(lang, `/setup/versus?m=${m.id}`)}">${esc(t.modeVersus)}</a></div></section>`
        + (related.length ? `<section><h3>${esc(t.moreIn(m.comp[lang]))}</h3><nav class="list">${related.map(x => row(x, lang)).join('')}</nav></section>` : '')
        + `<a class="ghost" href="${prefix(lang, '/matches')}">${esc(t.browseAll)}</a>`
      break
    }
    default:
      main = ''
  }
  return `<div class="wrap">${header}${main}</div>`
}

function render(page: Page, lang: Lang) {
  const m = meta(page, lang, BRAND, SITE_URL)
  const s = template.indexOf(START), e = template.indexOf(END) + END.length
  const html = (template.slice(0, s) + head(m, lang) + template.slice(e))
    .replace('<html lang="en" dir="ltr">', `<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`)
    .replace('<div id="root"></div>', `<div id="root">${body(page, lang, m.path)}</div>`)
  // "/match/x" → match/x.html: static hosts (Cloudflare Pages, Netlify, Vercel cleanUrls) serve it at /match/x without a trailing-slash redirect
  const url = prefix(lang, m.path)
  const out = join(DIST, url === '/' ? 'index.html' : url.slice(1) + '.html')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, html)
  return m
}

const pages: Page[] = [
  { kind: 'home', count: matches.length },
  { kind: 'matches', count: matches.length },
  ...matches.map(match => ({ kind: 'match' as const, match })),
  { kind: 'setup', mode: 'solo' }, { kind: 'setup', mode: 'same' }, { kind: 'setup', mode: 'versus' },
  { kind: 'play' },
]
const indexable: string[] = []
for (const lang of ['en', 'ar'] as const) for (const p of pages) {
  const m = render(p, lang)
  if (!m.noindex && lang === 'en') indexable.push(m.path)
}

const alt = (path: string) => (['en', 'ar'] as const).map(l => `<xhtml:link rel="alternate" hreflang="${l}" href="${abs(l, path)}"/>`).join('')
  + `<xhtml:link rel="alternate" hreflang="x-default" href="${abs('en', path)}"/>`
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${indexable.flatMap(path => (['en', 'ar'] as const).map(l => `<url><loc>${abs(l, path)}</loc>${alt(path)}</url>`)).join('\n')}
</urlset>
`)
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /play
Disallow: /ar/play

Sitemap: ${SITE_URL}/sitemap.xml
`)
console.log(`prerendered ${pages.length * 2} pages, ${indexable.length * 2} in the sitemap`)
