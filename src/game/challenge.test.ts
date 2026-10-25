import { describe, expect, it } from 'vitest'
import { decodeChallenge, encodeChallenge, type ChallengeLink } from './challenge'

const c: ChallengeLink = { matchId: 'bar-mun-2009', side: 'home', name: 'Ahmed', found: 9, hints: 1, misses: 3 }
const raw = (v: unknown) => btoa(JSON.stringify(v)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('challenge links', () => {
  it('round-trips, URL-safe', () => {
    const code = encodeChallenge(c)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeChallenge(code)).toEqual(c)
  })
  it('round-trips Arabic names', () => {
    const ar = { ...c, name: 'أحمد', side: 'away' as const }
    expect(decodeChallenge(encodeChallenge(ar))).toEqual(ar)
  })
  it('trims and caps the name', () => {
    expect(decodeChallenge(encodeChallenge({ ...c, name: '  ' + 'x'.repeat(40) }))!.name).toHaveLength(24)
  })
  it('rejects garbage and out-of-range values', () => {
    for (const bad of ['', '!!!', 'abc', raw({}), raw([1, 2, 3]),
      raw(['bar-mun-2009', 'left', 'A', 1, 0, 0]),
      raw(['../x', 'home', 'A', 1, 0, 0]),
      raw(['bar-mun-2009', 'home', '   ', 1, 0, 0]),
      raw(['bar-mun-2009', 'home', 'A', 12, 0, 0]),
      raw(['bar-mun-2009', 'home', 'A', 1, 4, 0]),
      raw(['bar-mun-2009', 'home', 'A', 1, 0, 6]),
      raw(['bar-mun-2009', 'home', 'A', 1.5, 0, 0]),
      raw(['bar-mun-2009', 'home', 'A', -1, 0, 0]),
      raw(['bar-mun-2009', 'home', 7, 1, 0, 0]),
    ]) expect(decodeChallenge(bad), bad).toBeNull()
  })
})
