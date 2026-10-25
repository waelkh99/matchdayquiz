import type { Match, SideKey } from '../data'
import { norm, resolveGuess, slots, type Slot } from './match'

export const MAX_MISS = 5
export const MAX_HINT = 3

/** solo: one player. same: everyone takes turns on one XI. versus: each player has their own team's XI. */
export type Mode = 'solo' | 'same' | 'versus'

export type Pick = { by: number; hint: boolean }
export type Board = { found: Record<number, Pick>; hinted: number[] }
export type PlayerState = { name: string; side: SideKey; misses: string[]; hints: number; out: boolean }
export type Challenge = { name: string; found: number; hints: number; misses: number }
export type Feedback =
  | { kind: 'hit' | 'already' | 'hint'; slot: number; side: SideKey; by: number }
  | { kind: 'miss'; text: string; by: number }
  | { kind: 'repeat'; text: string; by: number }

export type Game = {
  matchId: string
  mode: Mode
  players: PlayerState[]
  boards: Partial<Record<SideKey, Board>>
  turn: number
  done: boolean
  last?: Feedback
  challenge?: Challenge
}

export type Sheets = Record<SideKey, Slot[]>
export const sheets = (m: Match): Sheets => ({ home: slots(m.home), away: slots(m.away) })

export function newGame(matchId: string, mode: Mode, players: { name: string; side: SideKey }[], challenge?: Challenge): Game {
  const boards: Game['boards'] = {}
  for (const p of players) boards[p.side] ??= { found: {}, hinted: [] }
  return {
    matchId, mode, challenge, turn: 0, done: false, boards,
    players: players.map(p => ({ ...p, misses: [], hints: 0, out: false })),
  }
}

const boardFull = (g: Game, sh: Sheets, side: SideKey) => Object.keys(g.boards[side]!.found).length === sh[side].length

export const finished = (g: Game, sh: Sheets, p: PlayerState) => p.out || p.misses.length >= MAX_MISS || boardFull(g, sh, p.side)

/** Next player after `from` (wrapping, may return `from` itself) who can still play; null when nobody can. */
function nextPlayer(g: Game, sh: Sheets, from: number): number | null {
  const n = g.players.length
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n
    if (!finished(g, sh, g.players[i])) return i
  }
  return null
}

function advance(g: Game, sh: Sheets, keepTurn: boolean): Game {
  if (keepTurn && !finished(g, sh, g.players[g.turn])) return g
  const next = nextPlayer(g, sh, g.turn)
  return next === null ? { ...g, done: true } : { ...g, turn: next }
}

export function guess(g: Game, sh: Sheets, text: string): Game {
  if (g.done) return g
  const p = g.players[g.turn]
  const board = g.boards[p.side]!
  const found = new Set(Object.keys(board.found).map(Number))
  const r = resolveGuess(sh[p.side], found, text)
  if (r.kind === 'empty') return g
  if (r.kind === 'already') return { ...g, last: { kind: 'already', slot: r.slot, side: p.side, by: g.turn } }
  if (r.kind === 'hit') {
    const pick: Pick = { by: g.turn, hint: board.hinted.includes(r.slot) }
    const next: Game = {
      ...g,
      boards: { ...g.boards, [p.side]: { ...board, found: { ...board.found, [r.slot]: pick } } },
      last: { kind: 'hit', slot: r.slot, side: p.side, by: g.turn },
    }
    // A correct name keeps the turn in "same" mode; in versus every guess passes it.
    return advance(next, sh, g.mode !== 'versus')
  }
  const label = text.trim()
  const tried = g.players.some(q => q.side === p.side && q.misses.some(m => norm(m) === norm(label)))
  if (tried) return { ...g, last: { kind: 'repeat', text: label, by: g.turn } }
  const players = g.players.map((q, i) => (i === g.turn ? { ...q, misses: [...q.misses, label] } : q))
  return advance({ ...g, players, last: { kind: 'miss', text: label, by: g.turn } }, sh, false)
}

export function canHint(g: Game, slot: number | null): slot is number {
  if (g.done || slot === null) return false
  const p = g.players[g.turn]
  const b = g.boards[p.side]!
  return p.hints < MAX_HINT && !(slot in b.found) && !b.hinted.includes(slot)
}

export function hint(g: Game, slot: number | null): Game {
  if (!canHint(g, slot)) return g
  const p = g.players[g.turn]
  const b = g.boards[p.side]!
  return {
    ...g,
    players: g.players.map((q, i) => (i === g.turn ? { ...q, hints: q.hints + 1 } : q)),
    boards: { ...g.boards, [p.side]: { ...b, hinted: [...b.hinted, slot] } },
    last: { kind: 'hint', slot, side: p.side, by: g.turn },
  }
}

/** The current player retires; the game ends once nobody is left. */
export function giveUp(g: Game, sh: Sheets): Game {
  if (g.done) return g
  const players = g.players.map((q, i) => (i === g.turn ? { ...q, out: true } : q))
  return advance({ ...g, players, last: undefined }, sh, false)
}

export function score(g: Game, player: number) {
  const b = g.boards[g.players[player].side]!
  const picks = Object.values(b.found).filter(f => f.by === player)
  return { found: picks.length, hints: g.players[player].hints, misses: g.players[player].misses.length }
}

export function verdict(n: number): 'v11' | 'v9' | 'v6' | 'v3' | 'v0' {
  return n >= 11 ? 'v11' : n >= 9 ? 'v9' : n >= 6 ? 'v6' : n >= 3 ? 'v3' : 'v0'
}

/** Emoji grid for one board, attack row on top: 🟩 found, 🟨 found after a hint, ⬜ missed. */
export function grid(g: Game, sh: Sheets, side: SideKey): string {
  const b = g.boards[side]!
  const rows = [...new Set(sh[side].map(s => s.row))].reverse()
  return rows.map(r => sh[side].filter(s => s.row === r)
    .map(s => (s.i in b.found ? (b.found[s.i].hint ? '🟨' : '🟩') : '⬜')).join('')).join('\n')
}
