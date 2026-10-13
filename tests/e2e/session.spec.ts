import { expect, test, type Page } from '@playwright/test';
import { FAMILY_LABEL, answer, endSession, familyStats, goNext, gotoStart, nextButton, startSession, statValues } from './helpers';

// Done-criteria 4–6, 8, 12 at the phone viewport on a fresh install.

/** Answers cards (first choice) until `match` holds for the current card; fails after `limit`. */
async function findCard(page: Page, match: () => Promise<boolean>, limit = 40): Promise<void> {
  for (let i = 0; i < limit; i++) {
    if (await match()) return;
    await answer(page, i % 4);
    await goNext(page);
  }
  throw new Error('No matching card came up.');
}

test.beforeEach(async ({ page }) => {
  await gotoStart(page);
});

test('4: Start shows due, new and overdue per family and one Start button', async ({ page }) => {
  expect(await familyStats(page, 'godot-api')).toEqual({ Due: 0, 'New today': 10, Overdue: 0 });
  expect(await familyStats(page, 'gdscript')).toEqual({ Due: 0, 'New today': 5, Overdue: 0 });
  expect(await familyStats(page, 'github')).toEqual({ Due: 0, 'New today': 5, Overdue: 0 });
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeEnabled();
});

test('5, 8: a new card is a question with one prompt and exactly four choices', async ({ page }) => {
  await startSession(page);
  await expect(page.locator('.gv-card__prompt')).toHaveCount(1);
  await expect(page.locator('.gv-card__prompt')).not.toBeEmpty();
  await expect(page.getByRole('group', { name: 'Choices' }).getByRole('button')).toHaveCount(4);
  // Asked before taught: no explanation and no Next until a choice is tapped.
  await expect(page.locator('.gv-explain')).toHaveCount(0);
  await expect(nextButton(page)).toHaveCount(0);
  // The whole first session is new cards (fresh install), so every card met is a question first.
  await expect(page.getByRole('progressbar', { name: 'Cards done' })).toHaveAttribute('aria-valuemax', '20');
});

test('5: an API class card shows the class icon beside every choice', async ({ page }) => {
  await startSession(page);
  await findCard(page, async () => (await page.locator('.gv-card__family').textContent()) === FAMILY_LABEL['godot-api'] && (await page.locator('.gv-card .gv-heading').textContent()) === 'Class');
  const choices = page.locator('.gv-choice');
  await expect(choices).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    const img = choices.nth(i).locator('img.gv-icon');
    await expect(img).toHaveCount(1);
    const label = await choices.nth(i).locator('.gv-choice__label').textContent();
    expect(await img.getAttribute('src')).toContain(`icons/${label}.svg`);
    expect(await img.evaluate((n: HTMLImageElement) => n.complete && n.naturalWidth > 0)).toBe(true);
  }
});

test('5: a language snippet card renders code in JetBrains Mono with syntax colours', async ({ page }) => {
  await startSession(page);
  await findCard(page, async () => (await page.locator('.gv-card .gv-code').count()) > 0);
  const code = page.locator('.gv-card .gv-code').first();
  expect(await code.evaluate((n) => getComputedStyle(n).fontFamily)).toContain('JetBrains Mono');
  expect(await page.evaluate(() => document.fonts.check('16px "JetBrains Mono"'))).toBe(true);
  const colours = await code.locator('[class^="tok-"]').evaluateAll((nodes) => [...new Set(nodes.map((n) => getComputedStyle(n).color))]);
  expect(colours.length).toBeGreaterThan(1);
});

test('6: one tap locks all four, marks it, reveals the answer, explains, and offers Next', async ({ page }) => {
  await startSession(page);
  const choices = page.locator('.gv-choice');
  await choices.nth(1).click();
  await expect(nextButton(page)).toBeVisible();
  for (let i = 0; i < 4; i++) await expect(choices.nth(i)).toBeDisabled();
  const states = await choices.evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.state));
  expect(['chosen-right', 'chosen-wrong']).toContain(states[1]);
  // Exactly one choice is shown as the right answer: the tapped one, or another revealed.
  expect(states.filter((s) => s === 'chosen-right' || s === 'revealed-right')).toHaveLength(1);
  await expect(page.locator('.gv-explain')).not.toBeEmpty();
  await expect(page.locator('.gv-feedback p').first()).toHaveText(/^(Right\.|Not quite\. It is .+\.)$/);

  // No second guess: tapping another choice changes nothing.
  await choices.nth(2).click({ force: true });
  expect(await choices.evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.state))).toEqual(states);
  await expect(page.getByRole('progressbar', { name: 'Cards done' })).toHaveAttribute('aria-valuenow', '1');

  await goNext(page);
  await expect(page.locator('.gv-choice:not([disabled])')).toHaveCount(4);
});

test('12: the summary shows cards seen, right, wrong and due tomorrow', async ({ page }) => {
  await startSession(page);
  await answer(page, 0);
  await goNext(page);
  await answer(page, 1);
  await endSession(page);
  const stats = await statValues(page.locator('.gv-stat'));
  expect(stats['Cards seen']).toBe(2);
  expect(stats.Right! + stats.Wrong!).toBe(2);
  // Both cards come back before the end of tomorrow (short-term steps or relearning).
  expect(stats['Due tomorrow']).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
});
