// Share-preview images (1200×630) for every match, plus a default. Re-run after adding matches:
//   node scripts/og-images.ts        → public/og/<id>.jpg, public/og/default.jpg
// No player names on the cards: a preview must not give the answers away.
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'
import matchesJson from '../src/data/matches.json' with { type: 'json' }
import type { Kit, Match } from '../src/data/index.ts'

const matches = matchesJson as Match[]
const OUT = 'public/og'
mkdirSync(OUT, { recursive: true })

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const SHIRT = 'M13 4 L7 6.5 L1.5 13 L6 19 L10 16.5 L10 37 L30 37 L30 16.5 L34 19 L38.5 13 L33 6.5 L27 4 Q20 9.5 13 4 Z'
const shirt = (kit: Kit, id: string, size: number) => `<svg width="${size}" height="${size}" viewBox="0 0 40 40">
  <defs><pattern id="${id}" width="10" height="40" patternUnits="userSpaceOnUse"><rect width="5" height="40" fill="${kit.a}"/><rect x="5" width="5" height="40" fill="${kit.stripes ? kit.b : kit.a}"/></pattern></defs>
  <path d="${SHIRT}" fill="url(#${id})" stroke="rgba(0,0,0,.35)" stroke-width=".8"/>
  <text x="20" y="28.5" text-anchor="middle" font-family="Big Shoulders Display" font-weight="900" font-size="15" fill="${kit.num}">?</text></svg>`

const page = (inner: string) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@900&family=Barlow+Condensed:wght@600;700&family=Cairo:wght@700&display=block" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;overflow:hidden;font-family:'Barlow Condensed',sans-serif;color:#f4f7f2;
    background:repeating-linear-gradient(90deg,#2f7a43 0 100px,#2a7140 100px 200px)}
  .card{position:absolute;inset:40px;background:#0e1a14;border-radius:18px;padding:44px 56px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;justify-content:space-between;align-items:baseline;font-size:30px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a9bcb1}
  .brand{font-family:'Big Shoulders Display';font-weight:900;font-size:48px;letter-spacing:.01em;color:#fff}
  .brand span{color:#3fbf72}
  .score{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:28px;font-family:'Big Shoulders Display';font-weight:900;text-transform:uppercase;line-height:.95}
  .team{font-size:76px;display:flex;flex-direction:column;gap:14px}
  .team.h{align-items:flex-end;text-align:right}
  .team small{font-family:Cairo;font-size:34px;text-transform:none;color:#c7d4cc;font-weight:700}
  .s{font-size:104px;color:#f2c230}
  .ask{display:flex;justify-content:space-between;align-items:center;font-size:40px;font-weight:700}
  .ask .ar{font-family:Cairo;font-size:36px}
  .shirts{display:flex;gap:18px}
</style></head><body><div class="card">${inner}</div></body></html>`

const card = (m: Match) => page(`
  <div class="top"><span class="brand">XI<span> GUESS</span></span><span>${esc(m.comp.en)} · ${m.date.slice(0, 4)}</span></div>
  <div class="score">
    <div class="team h">${esc(m.home.team.en)}<small>${esc(m.home.team.ar)}</small></div>
    <div class="s">${esc(m.score)}</div>
    <div class="team">${esc(m.away.team.en)}<small>${esc(m.away.team.ar)}</small></div>
  </div>
  <div class="ask"><div class="shirts">${shirt(m.home.kit, 'h', 96)}${shirt(m.away.kit, 'a', 96)}</div>
    <div style="text-align:right">Can you name the starting XIs?<div class="ar">هل تعرف التشكيلتين؟</div></div></div>`)

const kits: Kit[] = [{ a: '#a50044', b: '#004d98', stripes: true, num: '#fff' }, { a: '#dc052d', b: '#dc052d', num: '#fff' }, { a: '#ffffff', b: '#ffffff', num: '#111' }, { a: '#75aadb', b: '#ffffff', stripes: true, num: '#1b2a4a' }, { a: '#015a55', b: '#015a55', num: '#fff' }]
const fallback = page(`
  <div class="top"><span class="brand" style="font-size:120px;line-height:.9">XI<span> GUESS</span></span></div>
  <div class="team" style="font-family:'Big Shoulders Display';font-size:84px;text-transform:uppercase;line-height:.95">Can you name the XI?<small>هل تعرف التشكيلة؟</small></div>
  <div class="ask"><div class="shirts">${kits.map((k, i) => shirt(k, 'k' + i, 88)).join('')}</div><div>${matches.length} famous matches</div></div>`)

const browser = await chromium.launch()
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } })
async function shot(html: string, file: string) {
  await tab.setContent(html, { waitUntil: 'networkidle' })
  await tab.evaluate(() => document.fonts.ready)
  await tab.screenshot({ path: `${OUT}/${file}`, type: 'jpeg', quality: 82 })
}
await shot(fallback, 'default.jpg')
for (const m of matches) await shot(card(m), `${m.id}.jpg`)
await browser.close()
console.log(`wrote ${matches.length + 1} images to ${OUT}/`)
