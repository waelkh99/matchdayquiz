import { describe, expect, it } from 'vitest'
import { lev, norm, pattern, resolveGuess, slots } from './match'
import type { Side } from '../data'
import matches from '../data/matches.json'

const all = matches as unknown as { id: string; home: Side; away: Side }[]
const side = (id: string, k: 'home' | 'away') => slots(all.find(m => m.id === id)![k])
const barca = side('bar-mun-2009', 'home')
const utd99 = side('mun-bay-1999', 'home')
const none = new Set<number>()
const hitName = (sl: ReturnType<typeof slots>, text: string, found = none) => {
  const r = resolveGuess(sl, found, text)
  return r.kind === 'hit' ? sl[r.slot].name : r.kind
}

describe('norm', () => {
  it('strips accents and case', () => {
    expect(norm('Piqué')).toBe('pique')
    expect(norm('ČECH')).toBe('cech')
    expect(norm('Müller')).toBe('muller')
  })
  it('drops spaces, hyphens, apostrophes, digits', () => {
    expect(norm("Eto'o")).toBe('etoo')
    expect(norm("Guivarc'h")).toBe('guivarch')
    expect(norm('Park Ji-sung')).toBe('parkjisung')
    expect(norm(' cr7 ')).toBe('cr')
  })
  it('unifies Arabic letter variants and strips tashkeel/tatweel', () => {
    expect(norm('إنييستا')).toBe(norm('انييستا'))
    expect(norm('أ')).toBe('ا')
    expect(norm('آ')).toBe('ا')
    expect(norm('كرة')).toBe('كره')
    expect(norm('مصطفى')).toBe('مصطفي')
    expect(norm('مُحَمَّد')).toBe('محمد')
    expect(norm('ميـــسي')).toBe('ميسي')
  })
  it('returns empty for punctuation only', () => {
    expect(norm(' -.\' ')).toBe('')
  })
})

describe('lev', () => {
  it('computes edit distance', () => {
    expect(lev('messi', 'messi')).toBe(0)
    expect(lev('mesi', 'messi')).toBe(1)
    expect(lev('kitten', 'sitting')).toBe(3)
  })
  it('short-circuits large length gaps', () => {
    expect(lev('a', 'abcdef')).toBeGreaterThan(2)
  })
})

describe('resolveGuess', () => {
  it('accepts surname, full name, alias, accents', () => {
    expect(hitName(barca, 'Messi')).toBe('Lionel Messi')
    expect(hitName(barca, 'lionel messi')).toBe('Lionel Messi')
    expect(hitName(barca, 'leo')).toBe('Lionel Messi')
    expect(hitName(barca, 'pique')).toBe('Gerard Piqué')
    expect(hitName(barca, 'etoo')).toBe("Samuel Eto'o")
    expect(hitName(barca, 'Eto’o')).toBe("Samuel Eto'o") // curly apostrophe from phone keyboards
  })
  it('accepts Arabic names and spelling variants', () => {
    expect(hitName(barca, 'ميسي')).toBe('Lionel Messi')
    expect(hitName(barca, 'انيستا')).toBe('Andrés Iniesta')
    expect(hitName(barca, 'إنييستا')).toBe('Andrés Iniesta')
    expect(hitName(barca, 'شافي')).toBe('Xavi Hernández')
  })
  it('typo tolerance: exact under 5 chars', () => {
    expect(hitName(barca, 'Xavi')).toBe('Xavi Hernández')
    expect(hitName(barca, 'Xavo')).toBe('miss')
  })
  it('typo tolerance: 1 edit for 5–7 chars', () => {
    expect(hitName(barca, 'Mesi')).toBe('Lionel Messi')
    expect(hitName(barca, 'Puyl')).toBe('Carles Puyol')
    expect(hitName(barca, 'Pyl')).toBe('miss')
  })
  it('typo tolerance: 2 edits for 8+ chars', () => {
    expect(hitName(barca, 'Buskets')).toBe('Sergio Busquets')
    expect(hitName(barca, 'Bskts')).toBe('miss')
  })
  it('two same-surname slots fill in order (Neville case)', () => {
    const twins = slots({
      team: { en: 'T', ar: 'T' }, formation: '1-1', kit: { a: '#000', b: '#000', num: '#fff' },
      rows: [[{ short: 'G. Neville', name: 'Gary Neville', num: 2, aliases: ['neville'] }],
        [{ short: 'P. Neville', name: 'Phil Neville', num: 12, aliases: ['neville'] }]],
    })
    expect(resolveGuess(twins, none, 'Neville')).toEqual({ kind: 'hit', slot: 0 })
    expect(resolveGuess(twins, new Set([0]), 'Neville')).toEqual({ kind: 'hit', slot: 1 })
    expect(resolveGuess(twins, new Set([0, 1]), 'Neville')).toEqual({ kind: 'already', slot: 0 })
    expect(resolveGuess(twins, none, 'Phil Neville')).toEqual({ kind: 'hit', slot: 1 })
  })
  it('reports already-found, including with a typo', () => {
    const messi = barca.find(s => s.short === 'Messi')!.i
    expect(resolveGuess(barca, new Set([messi]), 'messi')).toEqual({ kind: 'already', slot: messi })
    expect(resolveGuess(barca, new Set([messi]), 'mesi')).toEqual({ kind: 'already', slot: messi })
  })
  it('exact match on an open slot beats a fuzzy one', () => {
    // 'Cole' exact must hit Andy Cole, not be swallowed by anything fuzzy
    expect(hitName(utd99, 'Cole')).toBe('Andy Cole')
  })
  it('ignores empty input and misses unknown names', () => {
    expect(resolveGuess(barca, none, '   ')).toEqual({ kind: 'empty' })
    expect(resolveGuess(barca, none, 'Ronaldinho')).toEqual({ kind: 'miss' })
  })
})

describe('slots', () => {
  it('lays out GK at the bottom centre and attack at the top', () => {
    const gk = barca[0]
    expect(gk.gk).toBe(true)
    expect([gk.x, gk.y]).toEqual([50, 86])
    const top = barca.filter(s => s.row === 3)
    expect(top.every(s => s.y === 12)).toBe(true)
    expect(top.map(s => s.x)).toEqual([12, 50, 88])
  })
})

describe('pattern', () => {
  it('keeps first letter and separators', () => {
    expect(pattern('Messi')).toBe('M____')
    expect(pattern('Van der Sar')).toBe('V__ ___ ___')
    expect(pattern("Eto'o")).toBe("E__'_")
    expect(pattern('ميسي')).toBe('م___')
  })
})
