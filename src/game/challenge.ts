import type { SideKey } from '../data'
import type { Challenge } from './game'

export type ChallengeLink = Challenge & { matchId: string; side: SideKey }

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function encodeChallenge(c: ChallengeLink): string {
  const json = JSON.stringify([c.matchId, c.side, c.name, c.found, c.hints, c.misses])
  return b64url(new TextEncoder().encode(json))
}

const count = (v: unknown, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max

/** Parses a link code from the URL. Untrusted input: anything malformed returns null. */
export function decodeChallenge(code: string): ChallengeLink | null {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
    const v: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))))
    if (!Array.isArray(v) || v.length !== 6) return null
    const [matchId, side, name, found, hints, misses] = v
    if (typeof matchId !== 'string' || !/^[a-z0-9-]{1,64}$/.test(matchId)) return null
    if (side !== 'home' && side !== 'away') return null
    if (typeof name !== 'string') return null
    const clean = name.trim().slice(0, 24)
    if (!clean || !count(found, 11) || !count(hints, 3) || !count(misses, 5)) return null
    return { matchId, side, name: clean, found, hints, misses }
  } catch {
    return null
  }
}
