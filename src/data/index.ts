import raw from './matches.json'

export type L10n = { en: string; ar: string }
export type Player = { short: string; name: string; ar?: string; num: number; aliases: string[] }
export type Kit = { a: string; b: string; stripes?: boolean; num: string }
export type Side = { team: L10n; formation: string; kit: Kit; rows: Player[][] } // rows: GK first, attack last
export type Match = {
  id: string; comp: L10n; date: string; venue: L10n; score: string; note?: L10n
  source: string[]; home: Side; away: Side
}
export type SideKey = 'home' | 'away'

const MATCHES = raw as Match[]

// The only data seam: swap these for API calls later.
export async function listMatches(): Promise<Match[]> {
  return MATCHES
}
export async function getMatch(id: string): Promise<Match | undefined> {
  return MATCHES.find(m => m.id === id)
}
