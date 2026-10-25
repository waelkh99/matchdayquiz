export type L10n = { en: string; ar: string }
export type Player = { short: string; name: string; ar?: string; num: number; aliases: string[] }
export type Kit = { a: string; b: string; stripes?: boolean; num: string }
export type Side = { team: L10n; formation: string; kit: Kit; rows: Player[][] } // rows: GK first, attack last
export type Match = {
  id: string; comp: L10n; date: string; venue: L10n; score: string; note?: L10n
  source: string[]; home: Side; away: Side
}
export type SideKey = 'home' | 'away'

// Loaded on demand (its own chunk) so the first page from a shared link stays small.
let cache: Promise<Match[]> | undefined
const load = () => (cache ??= import('./matches.json').then(m => m.default as Match[]))

// The only data seam: swap these for API calls later.
export async function listMatches(): Promise<Match[]> {
  return load()
}
export async function getMatch(id: string): Promise<Match | undefined> {
  return (await load()).find(m => m.id === id)
}
