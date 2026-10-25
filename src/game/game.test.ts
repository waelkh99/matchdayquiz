import { describe, expect, it } from 'vitest'
import { canHint, finished, giveUp, grid, guess, hint, newGame, score, sheets, verdict, type Game } from './game'
import { getMatch } from '../data'

const m = (await getMatch('bar-mun-2009'))!
const sh = sheets(m)
const BARCA = ['Valdes', 'Sylvinho', 'Toure', 'Pique', 'Puyol', 'Iniesta', 'Busquets', 'Xavi', 'Henry', 'Messi', 'Etoo']
const UTD = ['Van der Sar', 'Evra', 'Vidic', 'Ferdinand', "O'Shea", 'Giggs', 'Carrick', 'Anderson', 'Rooney', 'Ronaldo', 'Park']
const play = (g: Game, ...texts: string[]) => texts.reduce((s, t) => guess(s, sh, t), g)
const solo = () => newGame(m.id, 'solo', [{ name: 'Me', side: 'home' }])

describe('solo', () => {
  it('wins with all 11', () => {
    const g = play(solo(), ...BARCA)
    expect(g.done).toBe(true)
    expect(score(g, 0)).toEqual({ found: 11, hints: 0, misses: 0 })
    expect(grid(g, sh, 'home')).toBe('🟩🟩🟩\n🟩🟩\n🟩\n🟩🟩🟩🟩\n🟩') // 4-1-2-3
  })
  it('ends after 5 distinct misses; repeat misses are free', () => {
    let g = play(solo(), 'Nobody', 'nobody', 'NOBODY')
    expect(g.players[0].misses).toEqual(['Nobody'])
    expect(g.last).toEqual({ kind: 'repeat', text: 'NOBODY', by: 0 })
    g = play(g, 'a1', 'Bb', 'Cc', 'Dd')
    expect(g.done).toBe(true)
    expect(play(g, 'Messi')).toBe(g) // no moves after game over
  })
  it('already-found guesses cost nothing', () => {
    const g = play(solo(), 'Messi', 'Messi')
    expect(g.last).toMatchObject({ kind: 'already' })
    expect(g.players[0].misses).toHaveLength(0)
  })
  it('allows 3 hints, one per shirt, only on open shirts', () => {
    let g = solo()
    expect(canHint(g, null)).toBe(false)
    g = hint(g, 1)
    expect(canHint(g, 1)).toBe(false)
    g = hint(hint(g, 2), 3)
    expect(g.players[0].hints).toBe(3)
    expect(canHint(g, 4)).toBe(false)
    expect(hint(g, 4)).toBe(g)
    g = play(g, 'Sylvinho')
    expect(grid(g, sh, 'home').split('\n')[4]).toBe('⬜')
    expect(grid(g, sh, 'home').split('\n')[3]).toBe('🟨⬜⬜⬜')
    expect(canHint(play(solo(), 'Valdes'), 0)).toBe(false)
  })
  it('give up ends the game', () => {
    const g = giveUp(play(solo(), 'Messi'), sh)
    expect(g.done).toBe(true)
    expect(score(g, 0).found).toBe(1)
  })
})

describe('same XI (shared board, turns)', () => {
  const three = () => newGame(m.id, 'same', ['A', 'B', 'C'].map(name => ({ name, side: 'home' as const })))
  it('correct guess keeps the turn, a miss passes it', () => {
    let g = play(three(), 'Messi', 'Xavi')
    expect(g.turn).toBe(0)
    g = play(g, 'Nobody')
    expect(g.turn).toBe(1)
    g = play(g, 'Iniesta', 'Zzz')
    expect(g.turn).toBe(2)
    expect([score(g, 0).found, score(g, 1).found, score(g, 2).found]).toEqual([2, 1, 0])
  })
  it('a name tried by anyone is a free repeat', () => {
    const g = play(three(), 'Nobody', 'nobody')
    expect(g.turn).toBe(1)
    expect(g.last).toEqual({ kind: 'repeat', text: 'nobody', by: 1 })
    expect(g.players[1].misses).toHaveLength(0)
  })
  it('skips players who are out, ends when the board is full', () => {
    let g = play(three(), 'xa') // A misses → B
    g = giveUp(g, sh) // B retires → C
    expect(g.turn).toBe(2)
    g = play(g, 'xb') // C misses → A (B skipped)
    expect(g.turn).toBe(0)
    g = play(g, ...BARCA)
    expect(g.done).toBe(true)
    expect(score(g, 0).found).toBe(11)
  })
  it('ends when every player is out of lives', () => {
    const g = play(newGame(m.id, 'same', [{ name: 'A', side: 'home' }, { name: 'B', side: 'home' }]),
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j')
    expect(g.done).toBe(true)
    expect(g.players.every(p => finished(g, sh, p))).toBe(true)
  })
})

describe('versus (each player has a team)', () => {
  const vs = () => newGame(m.id, 'versus', [{ name: 'A', side: 'home' }, { name: 'B', side: 'away' }])
  it('every guess passes the turn and fills the guesser\'s own board', () => {
    let g = play(vs(), 'Messi')
    expect(g.turn).toBe(1)
    g = play(g, 'Messi') // not on United's sheet
    expect(g.players[1].misses).toEqual(['Messi'])
    g = play(g, 'Xavi', 'Rooney')
    expect([score(g, 0).found, score(g, 1).found]).toEqual([2, 1])
    expect(Object.keys(g.boards.away!.found)).toHaveLength(1)
  })
  it('a finished player is skipped until the other finishes', () => {
    // A and B alternate; B misses 5 times and is out after A's 5th find
    let g = vs()
    for (let i = 0; i < 5; i++) g = play(g, BARCA[i], 'miss' + 'abcde'[i])
    expect(finished(g, sh, g.players[1])).toBe(true)
    expect(g.turn).toBe(0)
    g = play(g, ...BARCA.slice(5, 10))
    expect(g.turn).toBe(0) // B is skipped
    expect(g.done).toBe(false)
    g = play(g, BARCA[10])
    expect(g.done).toBe(true)
    expect([score(g, 0).found, score(g, 1).found]).toEqual([11, 0])

    // A fills their sheet first; B keeps playing alone
    let h = vs()
    for (let i = 0; i < 11; i++) h = play(h, BARCA[i], UTD[i] === 'Park' ? 'nobody' : UTD[i])
    expect(h.done).toBe(false)
    expect(h.turn).toBe(1)
    h = play(h, 'Park')
    expect(h.done).toBe(true)
    expect([score(h, 0).found, score(h, 1).found, score(h, 1).misses]).toEqual([11, 11, 1])
  })
})

describe('verdict', () => {
  it('maps scores to verdict keys', () => {
    expect([11, 10, 9, 8, 6, 5, 3, 2, 0].map(verdict)).toEqual(['v11', 'v9', 'v9', 'v6', 'v6', 'v3', 'v3', 'v0', 'v0'])
  })
})
