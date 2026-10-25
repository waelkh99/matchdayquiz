import { describe, expect, it } from 'vitest'
import { listMatches } from '.'
import { resolveGuess, slots } from '../game/match'

const matches = await listMatches()
const latin = /[A-Za-z]/
const hex = /^#[0-9a-f]{6}$/i

describe('match data', () => {
  it('has unique ids and valid dates', () => {
    expect(new Set(matches.map(m => m.id)).size).toBe(matches.length)
    for (const m of matches) expect(new Date(m.date).toISOString().slice(0, 10), m.id).toBe(m.date)
  })

  for (const m of matches) for (const k of ['home', 'away'] as const) {
    const side = m[k]
    const label = `${m.id} ${k} (${side.team.en})`
    describe(label, () => {
      const sl = slots(side)

      it('has 11 players, one goalkeeper, rows matching the formation', () => {
        expect(sl).toHaveLength(11)
        expect(side.rows[0]).toHaveLength(1)
        expect(side.formation.split('-').map(Number)).toEqual(side.rows.slice(1).map(r => r.length))
      })
      it('has unique shirt numbers', () => {
        expect(new Set(sl.map(s => s.num)).size).toBe(11)
      })
      it('has valid kit colours and https sources', () => {
        for (const c of [side.kit.a, side.kit.b, side.kit.num]) expect(c).toMatch(hex)
        expect(m.source.length).toBeGreaterThan(0)
        for (const s of m.source) expect(s).toMatch(/^https:\/\//)
      })
      it('has Arabic text with no Latin letters', () => {
        for (const t of [m.comp.ar, m.venue.ar, m.note?.ar ?? '', side.team.ar]) expect(t, t).not.toMatch(latin)
        for (const p of sl) {
          expect(p.ar, p.name).toBeTruthy()
          expect(p.ar, p.name).not.toMatch(latin)
          for (const a of p.aliases) if (!latin.test(a)) expect(a).not.toMatch(latin)
        }
      })
      it('every name and alias resolves to its own player', () => {
        for (const p of sl) for (const key of [p.short, p.name, p.ar!, ...p.aliases]) {
          const r = resolveGuess(sl, new Set(), key)
          expect(r, `"${key}" should be ${p.name}`).toEqual({ kind: 'hit', slot: p.i })
        }
      })
    })
  }
})
