// Builds match entries from English Wikipedia match articles.
//   node scripts/import-wikipedia.mjs "2010 UEFA Champions League final" ... > out.json
// Names, shirt numbers, positions, kits, venue and date come from the article's lineup tables.
// Arabic names come from each article's Arabic Wikipedia counterpart (langlinks).
// Output still needs a human check: formations are inferred from position codes.

const UA = { 'User-Agent': 'XIGuess-content-import/1.0 (lineup quiz; contact via repo)' }
const API = 'https://en.wikipedia.org/w/api.php'

const raw = async (title, tries = 5) => {
  await new Promise(res => setTimeout(res, 800))
  const r = await fetch(`https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&action=raw&redirect=yes`, { headers: UA })
  if (r.status === 429 && tries > 0) { await new Promise(res => setTimeout(res, 5000)); return raw(title, tries - 1) }
  if (!r.ok) throw new Error(`${title}: HTTP ${r.status}`)
  let text = await r.text()
  const redirect = text.match(/^#REDIRECT\s*\[\[([^\]|#]+)/i)
  if (redirect) return raw(redirect[1])
  return text
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
/** The API rate-limits bursts; back off and retry. */
async function getJson(url, tries = 8) {
  for (let i = 0; i < tries; i++) {
    await sleep(1500 * 2 ** i)
    const r = await fetch(url, { headers: UA })
    const body = await r.text()
    try { return JSON.parse(body) } catch { /* rate limited: retry */ }
  }
  throw new Error('API kept refusing: ' + url.slice(0, 120))
}

/** English title → Arabic Wikipedia title, following redirects. */
async function arabicTitles(titles) {
  const out = new Map()
  const uniq = [...new Set(titles)]
  for (let i = 0; i < uniq.length; i += 50) {
    const batch = uniq.slice(i, i + 50)
    const url = `${API}?action=query&format=json&prop=langlinks&lllang=ar&lllimit=500&redirects=1&titles=${encodeURIComponent(batch.join('|'))}`
    const j = await getJson(url)
    const alias = new Map()
    for (const n of j.query.normalized ?? []) alias.set(n.to, n.from)
    for (const r of j.query.redirects ?? []) alias.set(r.to, alias.get(r.from) ?? r.from)
    for (const p of Object.values(j.query.pages)) {
      const ar = p.langlinks?.[0]?.['*']
      if (!ar) continue
      out.set(p.title, ar)
      let k = p.title
      while (alias.has(k)) { k = alias.get(k); out.set(k, ar) }
    }
  }
  return out
}

// ---------- lineup parsing ----------

const SIDE = { L: 0, C: 1, R: 2 }
const CODES = {
  GK: ['gk', 'C'], SW: ['def', 'C'], LB: ['def', 'L'], CB: ['def', 'C'], RB: ['def', 'R'],
  LWB: ['wb', 'L'], RWB: ['wb', 'R'], DM: ['dm', 'C'], CM: ['mid', 'C'], LM: ['mid', 'L'], RM: ['mid', 'R'],
  AM: ['am', 'C'], LW: ['wing', 'L'], RW: ['wing', 'R'], LF: ['fwd', 'L'], RF: ['fwd', 'R'], CF: ['fwd', 'C'], SS: ['fwd', 'C'], ST: ['fwd', 'C'],
}

function parseTeamTable(block) {
  const players = []
  for (const line of block.split('\n')) {
    if (/Substitut(?:es|ions):/.test(line)) break
    const m = line.match(/^\|\s*([A-Z]{2,3})\s*\|\|\s*'''\s*(\d+)\s*'''\s*\|\|(.*)$/)
    if (!m) continue
    const [, code, num, rest] = m
    const link = rest.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/)
    if (!link) throw new Error('no player link in: ' + line)
    if (!CODES[code]) throw new Error('unknown position ' + code + ' in: ' + line)
    players.push({ code, num: Number(num), title: link[1].trim(), display: (link[2] ?? link[1]).replace(/\s*\(.*\)$/, '').trim() })
  }
  if (players.length !== 11) throw new Error(`expected 11 starters, got ${players.length}`)
  return players
}

/** Rows from goalkeeper up, each ordered left → right. Wikipedia lists each line right → left. */
function toRows(players) {
  const has = b => players.some(p => CODES[p.code][0] === b)
  const centralFwds = players.filter(p => ['CF', 'ST', 'SS'].includes(p.code)).length
  const rowOf = p => {
    const band = CODES[p.code][0]
    if (band === 'wb') return 'mid'
    if (band === 'wing') return has('am') ? 'am' : centralFwds >= 2 ? 'mid' : 'fwd'
    return band
  }
  const order = ['gk', 'def', 'dm', 'mid', 'am', 'fwd']
  return order.map(r => players.map((p, i) => ({ p, i })).filter(x => rowOf(x.p) === r)
    .sort((a, b) => SIDE[CODES[a.p.code][1]] - SIDE[CODES[b.p.code][1]] || b.i - a.i)
    .map(x => x.p)).filter(r => r.length)
}

const PARTICLES = new Set(['van', 'de', 'der', 'den', 'di', 'da', 'dos', 'das', 'do', 'von', 'le', 'la', 'mac', 'ter', 'el', 'al', 'ben', 'bin', 'abd', 'abu'])
/** Korean names put the family name first: "Park Ji-sung" → "Park". */
const familyFirst = display => { const w = display.split(/\s+/); return w.length === 2 && /^[A-Z][a-z]+-[a-z]+$/.test(w[1]) }
function shortName(display) {
  const w = display.split(/\s+/)
  if (w.length === 1) return display
  if (familyFirst(display)) return w[0]
  let i = w.length - 1
  while (i > 1 && PARTICLES.has(w[i - 1].toLowerCase())) i--
  const s = w.slice(i).join(' ')
  return s[0].toUpperCase() + s.slice(1)
}
const AR_PARTICLES = new Set(['فان', 'دي', 'دير', 'در', 'دا', 'دوس', 'فون', 'لو', 'ماك', 'تير', 'بن', 'عبد', 'أبو'])
function arShort(arTitle, display) {
  const t = arTitle.replace(/\s*\(.*\)\s*$/, '').trim()
  // A mononym ("Xavi") maps to a full Arabic title ("تشافي هيرنانديز"): its first word is the known name.
  if (display.split(/\s+/).length === 1 || familyFirst(display)) return t.split(/\s+/)[0]
  const w = t.split(/\s+/)
  let i = w.length - 1
  while (i > 1 && AR_PARTICLES.has(w[i - 1])) i--
  return w.slice(i).join(' ')
}

// ---------- match box ----------

const COUNTRY = { ARG: 'Argentina', KSA: 'Saudi Arabia', MAR: 'Morocco', POR: 'Portugal', FRA: 'France', ESP: 'Spain', BRA: 'Brazil', GER: 'Germany', ENG: 'England', NED: 'Netherlands', ITA: 'Italy', CRO: 'Croatia', BEL: 'Belgium', URU: 'Uruguay', JPN: 'Japan', KOR: 'South Korea', QAT: 'Qatar', TUN: 'Tunisia', EGY: 'Egypt', ALG: 'Algeria', SEN: 'Senegal', CMR: 'Cameroon', GHA: 'Ghana', MEX: 'Mexico', USA: 'United States', POL: 'Poland' }
/** "منتخب الأرجنتين لكرة القدم" → "الأرجنتين", "نادي برشلونة" → "برشلونة" */
const teamAr = t => t.replace(/\s*\(.*\)\s*$/, '').replace(/^(منتخب|نادي)\s+/, '').replace(/\s+لكرة القدم$/, '').trim()

const field = (box, k) => box.match(new RegExp(`\\|\\s*${k}\\s*=\\s*([^\\n]*)`))?.[1]?.trim() ?? ''
const linkText = s => s.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/)
const plain = s => s.replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, '').replace(/\{\{[^}]*\}\}/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1').replace(/'''?/g, '').trim()
const hexOk = h => (/^[0-9a-f]{6}$/i.test(h) ? '#' + h.toLowerCase() : null)
const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 }

function kits(text) {
  return [...text.matchAll(/\{\{Football kit([\s\S]*?)\n\}\}/g)].slice(0, 2).map(k => {
    const body = hexOk(field(k[1], 'body')) ?? '#888888'
    const arm = hexOk(field(k[1], 'leftarm')) ?? body
    const stripes = /stripe/i.test(field(k[1], 'pattern_b')) && arm !== body
    return { a: body, b: stripes ? arm : body, ...(stripes ? { stripes: true } : {}), num: lum(body) > 0.6 ? '#111111' : '#ffffff' }
  })
}

// "Page @ Section heading" imports one match from a page that lists several (group or knockout pages).
async function importMatch(arg) {
  const [title, section] = arg.split(' @ ')
  let text = await raw(title)
  if (section) {
    const heading = text.split('\n').find(l => l.startsWith('=') && l.replace(/=/g, '').trim() === section)
    const at = heading ? text.indexOf(heading) : -1
    if (at < 0) throw new Error(`${title}: section "${section}" not found`)
    text = text.slice(at)
  }
  const boxStart = text.search(/\{\{\s*(?:#invoke:\s*football box\s*\|\s*main|Football box)/i)
  if (boxStart < 0) throw new Error(title + ': no Football box')
  const box = text.slice(boxStart, text.indexOf('\n}}', boxStart))
  const dateField = field(box, 'date')
  const date = dateField.match(/(\d{4})\|(\d{1,2})\|(\d{1,2})/)
  const textDate = new Date(plain(dateField) + ' 12:00 UTC') // "10 February 2008"
  const iso = date ? `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}`
    : isNaN(+textDate) ? '' : textDate.toISOString().slice(0, 10)
  const teams = ['team1', 'team2'].map(k => {
    // National-team boxes use flag templates; the infobox above has real links.
    let v = field(box, k)
    if (!linkText(v)) v = text.match(new RegExp(`\\|\\s*${k}\\s*=\\s*(\\[\\[[^\\n]*)`))?.[1] ?? v
    const l = linkText(v)
    if (l) return { title: l[1].trim(), name: (l[2] ?? l[1]).trim() }
    const code = field(box, k).match(/\|([A-Z]{3})\}\}/)?.[1] // {{#invoke:flagg|...|ARG}} on group/knockout pages
    const name = COUNTRY[code] ?? plain(v)
    return { title: `${name} national football team`, name }
  })
  const firstScore = s => s.match(/(\d+)\s*[–-]\s*(\d+)/)?.slice(1, 3).join('–') ?? ''
  const score = firstScore(field(box, 'score'))
  const pens = firstScore(field(box, 'penaltyscore'))
  const aet = /^y/i.test(field(box, 'aet')) || /a\.e\.t/i.test(field(box, 'score'))
  const stadiumRaw = field(box, 'stadium')
  const stadiumLinks = [...stadiumRaw.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)]
  const venue = plain(stadiumRaw)

  // the two starting XI tables follow the box
  const after = text.slice(boxStart).replace(/\{\{abbr\|([A-Z]{2,3})\|[^}]*\}\}/g, '$1') // {{abbr|RB|Right-back}} → RB
  // each team's starters are the last 11 player rows before its "Substitutes:" line
  const chunks = after.split(/Substitut(?:es|ions):/)
  if (chunks.length < 3) throw new Error(title + ': lineup tables not found')
  const tables = chunks.slice(0, 2).map(c => c.split('\n').filter(l => /^\|\s*[A-Z]{2,3}\s*\|\|\s*'''\s*\d+\s*'''/.test(l)).slice(-11).join('\n'))
  const xi = tables.map(parseTeamTable)
  const ar = await arabicTitles([...xi.flat().map(p => p.title), ...teams.map(t => t.title), ...stadiumLinks.map(l => l[1])])
  const kit = kits(after)

  const sides = xi.map((players, s) => {
    const rows = toRows(players)
    return {
      team: { en: teams[s].name, ar: teamAr(ar.get(teams[s].title) ?? '') },
      formation: rows.slice(1).map(r => r.length).join('-'),
      kit: kit[s] ?? { a: '#888888', b: '#888888', num: '#ffffff' },
      rows: rows.map(r => r.map(p => ({
        short: shortName(p.display), name: p.display,
        ar: ar.has(p.title) ? arShort(ar.get(p.title), p.display) : '',
        num: p.num, aliases: [], _pos: p.code, _arFull: ar.get(p.title) ?? '',
      }))),
    }
  })
  const [p1, p2] = pens ? pens.split('–').map(Number) : []
  const winnerOnPens = pens ? (p1 > p2 ? 0 : 1) : null
  const pensWin = pens ? `${Math.max(p1, p2)}–${Math.min(p1, p2)}` : '' // winner's score first
  return {
    id: '', _title: arg,
    comp: { en: '', ar: '' }, date: iso,
    venue: { en: venue, ar: stadiumLinks.map(l => ar.get(l[1]) ?? '?').join('، ') },
    score,
    ...(pens ? { note: { en: `${teams[winnerOnPens].name} won ${pensWin} on penalties`, ar: `فاز ${sides[winnerOnPens].team.ar} ${pensWin} بركلات الترجيح` } }
      : aet ? { note: { en: 'After extra time', ar: 'بعد الأشواط الإضافية' } } : {}),
    source: [`https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}${section ? '#' + encodeURIComponent(section.replace(/ /g, '_')) : ''}`],
    home: sides[0], away: sides[1],
  }
}

const out = []
for (const t of process.argv.slice(2)) {
  try { out.push(await importMatch(t)) } catch (e) { console.error('FAILED', t, '-', e.message) }
}
console.log(JSON.stringify(out, null, 2))
