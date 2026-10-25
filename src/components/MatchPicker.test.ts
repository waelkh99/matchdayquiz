import { describe, expect, it } from 'vitest'
import { searchMatches } from './MatchPicker'
import { listMatches } from '../data'

const all = await listMatches()
const ids = (q: string) => searchMatches(all, q).map(m => m.id)

describe('searchMatches', () => {
  it('returns everything for an empty query', () => {
    expect(searchMatches(all, '  ')).toHaveLength(all.length)
  })
  it('needs every word to match: teams and years combine', () => {
    for (const id of ids('barcelona 2009')) expect(id).toMatch(/2009$/)
    expect(ids('barcelona 2009')).toContain('bar-mun-2009')
    expect(ids('man united 1999')).toEqual(['mun-bay-1999'])
  })
  it('years match the date, not other numbers', () => {
    for (const m of searchMatches(all, '2014')) expect(m.date.startsWith('2014')).toBe(true)
  })
  it('finds nicknames', () => {
    expect(ids('man utd').length).toBeGreaterThan(0)
    expect(ids('psg').length).toBeGreaterThan(0)
    // "barça" is the club; "barcelona" also finds matches played in the city (Camp Nou 1999)
    const barca = searchMatches(all, 'barça')
    expect(barca.length).toBeGreaterThan(0)
    for (const m of barca) expect([m.home.team.en, m.away.team.en]).toContain('Barcelona')
    expect(ids('barcelona')).toEqual(expect.arrayContaining(barca.map(m => m.id)))
    expect(ids('barcelona')).toContain('mun-bay-1999')
  })
  it('ignores accents and case, and searches in Arabic', () => {
    expect(ids('ATLETICO')).toEqual(ids('Atlético'))
    expect(ids('ليفربول')).toEqual(ids('liverpool'))
    expect(ids('السعودية').length).toBeGreaterThan(0)
  })
  it('a query of only punctuation matches nothing', () => {
    expect(ids('---')).toEqual([])
  })
})
