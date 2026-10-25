import type { Player, Side } from '../data'

/** x, y and room are % of the pitch; room is the width a name tag can use without hitting a neighbour or the touchline. */
export type Slot = Player & { i: number; keys: string[]; x: number; y: number; room: number; row: number; gk: boolean }

// Accents stripped, lowercased, Arabic letter variants unified, everything else dropped.
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase()
    .replace(/[\u064B-\u0670\u065F\u0640]/g, '') // tashkeel, tatweel
    .replace(/[\u0625\u0623\u0622]/g, '\u0627').replace(/\u0629/g, '\u0647').replace(/\u0649/g, '\u064A') // إأآ→ا  ة→ه  ى→ي
    .replace(/[^a-z\u0621-\u064A]/g, '')
}

export function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

// Typo allowance by answer length: exact under 5, 1 for 5–7, 2 for 8+.
const allowed = (k: string) => (k.length >= 8 ? 2 : k.length >= 5 ? 1 : 0)

/** Flatten a side into slots with pitch positions (% of width/height, GK at the bottom). */
export function slots(side: Side): Slot[] {
  const out: Slot[] = []
  const n = side.rows.length
  side.rows.forEach((row, ri) => {
    const y = n === 1 ? 50 : 86 - ri * (74 / (n - 1))
    row.forEach((p, ci) => {
      const x = row.length === 1 ? 50 : 12 + ci * (76 / (row.length - 1))
      const keys = [...new Set([p.short, p.name, p.ar ?? '', ...p.aliases].map(norm).filter(Boolean))]
      const gap = row.length === 1 ? 100 : 76 / (row.length - 1)
      const room = Math.min(gap, 2 * Math.min(x, 100 - x)) - 2
      out.push({ ...p, i: out.length, keys, x, y, room, row: ri, gk: ri === 0 })
    })
  })
  return out
}

export type GuessResult =
  | { kind: 'hit'; slot: number }
  | { kind: 'already'; slot: number }
  | { kind: 'miss' }
  | { kind: 'empty' }

const exact = (all: Slot[], pool: number[], g: string) => pool.find(i => all[i].keys.includes(g))

function fuzzy(all: Slot[], pool: number[], g: string): number | undefined {
  let best: number | undefined, bd = 9
  for (const i of pool) for (const k of all[i].keys) {
    const d = lev(g, k)
    if (d <= allowed(k) && d < bd) { bd = d; best = i }
  }
  return best
}

// Order: exact open → exact found → fuzzy open → fuzzy found. Same-surname slots fill in sheet order.
export function resolveGuess(all: Slot[], found: Set<number>, text: string): GuessResult {
  const g = norm(text)
  if (!g) return { kind: 'empty' }
  const open = all.filter(s => !found.has(s.i)).map(s => s.i)
  const done = [...found]
  let i = exact(all, open, g)
  if (i !== undefined) return { kind: 'hit', slot: i }
  if ((i = exact(all, done, g)) !== undefined) return { kind: 'already', slot: i }
  if ((i = fuzzy(all, open, g)) !== undefined) return { kind: 'hit', slot: i }
  if ((i = fuzzy(all, done, g)) !== undefined) return { kind: 'already', slot: i }
  return { kind: 'miss' }
}

/** Hint: first letter, then underscores, keeping spaces/dots/apostrophes. "Messi" \u2192 "M____" */
export function pattern(s: string): string {
  return [...s].map((c, i) => (i === 0 ? c.toUpperCase() : /[\s'.-]/.test(c) ? c : '_')).join('')
}
