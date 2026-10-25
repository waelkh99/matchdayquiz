import { expect, test, type Page } from '@playwright/test'
import { BARCA, UTD, feedback, found, fresh, guess, pickMatch } from './helpers'

async function setup(page: Page, mode: 'same' | 'versus', names: string[], id = 'bar-mun-2009') {
  await fresh(page, `#/setup/${mode}`)
  await pickMatch(page, id)
  for (let i = 2; i < names.length; i++) await page.getByRole('button', { name: '+ Add player' }).click()
  for (const [i, n] of names.entries()) await page.getByRole('textbox', { name: `Player ${i + 1}` }).fill(n)
}
const turn = (page: Page) => page.locator('.turn.now')
const chip = (page: Page, name: string) => page.locator('.turn', { hasText: name })

test.describe('same XI', () => {
  test('setup: add/remove players up to 6, minimum 2', async ({ page }) => {
    await fresh(page, '#/setup/same')
    await expect(page.getByRole('textbox', { name: /Player \d/ })).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Remove player' })).toHaveCount(0)
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '+ Add player' }).click()
    await expect(page.getByRole('textbox', { name: /Player \d/ })).toHaveCount(6)
    await expect(page.getByRole('button', { name: '+ Add player' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Remove player' }).first().click()
    await expect(page.getByRole('textbox', { name: /Player \d/ })).toHaveCount(5)
  })

  test('setup: duplicate names are rejected, blanks get default names', async ({ page }) => {
    await setup(page, 'same', ['Ahmed', 'ahmed'])
    await page.getByRole('button', { name: 'Kick off' }).click()
    await expect(page.getByRole('alert')).toHaveText('Every player needs a different name.')
    await page.getByRole('textbox', { name: 'Player 2' }).fill('')
    await page.getByRole('button', { name: 'Kick off' }).click()
    await expect(chip(page, 'Ahmed')).toBeVisible()
    await expect(chip(page, 'Player 2')).toBeVisible()
  })

  test('turns: a hit keeps the turn, a miss passes it; points go to the guesser', async ({ page }) => {
    await setup(page, 'same', ['Ahmed', 'Basel', 'Sara'])
    await page.getByRole('button', { name: 'Kick off' }).click()
    await expect(page.getByRole('heading', { name: "Ahmed's turn" })).toBeVisible()
    await expect(page.locator('#guess')).toHaveAttribute('placeholder', 'Ahmed, type a name')
    await guess(page, 'Messi', 'Xavi')
    await expect(turn(page)).toContainText('Ahmed')
    await guess(page, 'Nobody')
    await expect(page.getByRole('heading', { name: "Basel's turn" })).toBeVisible()
    await guess(page, 'nobody') // already tried by Ahmed: free, Basel keeps the turn
    await expect(feedback(page)).toHaveText('nobody was already tried.')
    await expect(turn(page)).toContainText('Basel')
    await guess(page, 'Iniesta', 'Someone')
    await expect(turn(page)).toContainText('Sara')
    await expect(chip(page, 'Ahmed').locator('.n')).toHaveText('2')
    await expect(chip(page, 'Basel').locator('.n')).toHaveText('1')
    await expect(chip(page, 'Sara').locator('.n')).toHaveText('0')
    await expect(found(page)).toHaveText('3/11') // shared board
    await expect(page.locator('.misses s')).toHaveText(['Nobody', 'Someone'])
    // each player has their own lives
    await expect(page.getByTestId('misses')).toHaveAttribute('data-used', '0')
  })

  test('retire skips that player; game ends when the board is full and the winner is named', async ({ page }) => {
    await setup(page, 'same', ['Ahmed', 'Basel'])
    await page.getByRole('button', { name: 'Kick off' }).click()
    await guess(page, 'Messi', 'Nobody') // Ahmed 1, then Basel's turn
    await page.getByRole('button', { name: 'Retire' }).click()
    await page.getByRole('button', { name: 'Tap again to retire' }).click()
    await expect(chip(page, 'Basel')).toHaveClass(/out/)
    await expect(turn(page)).toContainText('Ahmed')
    await guess(page, ...BARCA.filter(n => n !== 'Messi'))
    const result = page.getByTestId('result')
    await expect(result.getByRole('heading', { level: 2 })).toHaveText('Ahmed wins')
    await expect(result.locator('.trow')).toHaveText([/Ahmed\s*11\/11/, /Basel\s*0\/11/])
    await expect(page.getByTestId('share')).toContainText('Ahmed: 11/11\nBasel: 0/11')
    await expect(result.getByLabel('Your name')).toHaveCount(0) // challenges are solo only
  })

  test('ends in a draw when everyone runs out of lives level', async ({ page }) => {
    await setup(page, 'same', ['Ahmed', 'Basel'])
    await page.getByRole('button', { name: 'Kick off' }).click()
    await guess(page, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j')
    await expect(page.getByTestId('result').getByRole('heading', { level: 2 })).toHaveText("It's a draw")
  })

  test('saved names are offered next time', async ({ page }) => {
    await setup(page, 'same', ['Ahmed', 'Basel', 'Sara'])
    await page.getByRole('button', { name: 'Kick off' }).click()
    await page.goto('/#/setup/same')
    await expect(page.getByRole('textbox', { name: /Player \d/ })).toHaveCount(3)
    await expect(page.getByRole('textbox', { name: 'Player 3' })).toHaveValue('Sara')
  })
})

test.describe('team vs team', () => {
  test('setup shows who plays which team, and swap works', async ({ page }) => {
    await setup(page, 'versus', ['Ahmed', 'Basel'])
    await expect(page.locator('.prow .team')).toHaveText(['Barcelona', 'Manchester United'])
    await page.getByRole('button', { name: 'Swap teams' }).click()
    await expect(page.locator('.prow .team')).toHaveText(['Manchester United', 'Barcelona'])
    await expect(page.getByRole('button', { name: '+ Add player' })).toHaveCount(0)
  })

  test('each guess passes the turn and switches to that player\'s team sheet', async ({ page }) => {
    await setup(page, 'versus', ['Ahmed', 'Basel'])
    await page.getByRole('button', { name: 'Kick off' }).click()
    await expect(page.locator('.task')).toContainText("Barcelona's starting XI")
    await guess(page, 'Messi')
    await expect(page.getByRole('heading', { name: "Basel's turn" })).toBeVisible()
    await expect(feedback(page)).toHaveText('Ahmed: Lionel Messi, #10.')
    await expect(page.locator('.task')).toContainText("Manchester United's starting XI")
    await expect(found(page)).toHaveText('0/11')
    await guess(page, 'Messi') // not in United's XI
    await expect(feedback(page)).toHaveText("Basel: Messi didn't start this one.")
    await expect(page.locator('.task')).toContainText("Barcelona's starting XI")
    await expect(found(page)).toHaveText('1/11')
  })

  test('full game: result shows both revealed teams and the winner', async ({ page }) => {
    await setup(page, 'versus', ['Ahmed', 'Basel'])
    await page.getByRole('button', { name: 'Kick off' }).click()
    // they alternate; Basel misses 5 times and is out, then Ahmed finishes alone
    for (let i = 0; i < 5; i++) await guess(page, BARCA[i], 'Nobody' + 'abcde'[i])
    await expect(page.getByRole('heading', { name: "Ahmed's turn" })).toBeVisible()
    await expect(chip(page, 'Basel')).toHaveClass(/out/)
    await guess(page, ...BARCA.slice(5))
    const result = page.getByTestId('result')
    await expect(result.getByRole('heading', { level: 2 })).toHaveText('Ahmed wins')
    await expect(result.locator('.boards .pitch')).toHaveCount(2)
    await expect(result.locator('.boards h3')).toHaveText(['Barcelona', 'Manchester United'])
    await expect(page.getByTestId('share')).toContainText('Barcelona\n\u200E🟩🟩🟩')
    await expect(page.getByTestId('share')).toContainText('Manchester United\n\u200E⬜⬜⬜')
  })
})
