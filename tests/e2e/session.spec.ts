import { expect, test, type Page } from '@playwright/test';
import {
  FAMILY_LABEL,
  answer,
  answerShowing,
  cardPanel,
  endSession,
  familyStats,
  goNext,
  gotoStart,
  nextButton,
  onlyFamily,
  startSession,
  statValues,
  type Showing,
} from './helpers';

// Done-criteria 4–6, 8, 12, 34–36 at the phone viewport on a fresh install.

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
  await findCard(
    page,
    async () =>
      (await page.locator('.gv-card__family').textContent()) === FAMILY_LABEL['godot-api'] &&
      (await page.locator('.gv-card .gv-heading').textContent()) === 'Class' &&
      (await page.locator('.gv-card').getAttribute('data-direction')) === 'forward' &&
      // Icon-less classes (Input, OS, Resource…) show four choices with no icon (done-criteria 46).
      (await page.locator('.gv-choice img.gv-icon').count()) > 0,
  );
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

test('34, 35: each showing draws a fresh set of four; later showings of an API class are flipped with its icon', async ({ page }) => {
  await onlyFamily(page, 'godot-api', 3);
  await startSession(page);
  const showings: Showing[] = [];
  let flippedSeen = false;
  for (let i = 0; i < 9; i++) {
    const panel = cardPanel(page);
    if (!flippedSeen && (await panel.getAttribute('data-direction')) === 'flipped' && (await panel.locator('.gv-heading').textContent()) === 'Class') {
      flippedSeen = true;
      const id = (await panel.getAttribute('data-card-id'))!;
      // 35: the name is the question, with its class icon; four descriptions are the choices, without icons.
      const name = panel.locator('.gv-card__name');
      await expect(name).toHaveText(id.replace('api:class:', ''));
      await expect(name.locator('img.gv-icon')).toHaveAttribute('src', new RegExp(`icons/${id.replace('api:class:', '')}\\.svg$`));
      await expect(panel.locator('.gv-card__look')).toHaveText(/^(Second|Third) look$/);
      const choices = page.locator('.gv-choice');
      await expect(choices).toHaveCount(4);
      await expect(choices.locator('img')).toHaveCount(0);
      for (const text of await choices.locator('.gv-choice__label').allTextContents()) expect(text.split(/\s+/).length).toBeGreaterThan(2);
    }
    showings.push(await answerShowing(page));
    if (i < 8) await goNext(page);
  }
  expect(flippedSeen).toBe(true);
  // 34: never the same four twice for one card in one session.
  for (const id of new Set(showings.map((s) => s.cardId))) {
    const sets = showings.filter((s) => s.cardId === id).map((s) => [...s.choices].sort().join('|'));
    expect(sets.length, id).toBe(3);
    expect(new Set(sets).size, id).toBe(sets.length);
  }
});

test('36: after answering, the full description and an official docs link that opens in the browser', async ({ page }) => {
  await startSession(page);
  await expect(page.getByRole('link', { name: /Open (in the Godot docs|on GitHub Docs)/ })).toHaveCount(0);
  const family = await page.locator('.gv-card__family').textContent();
  await answer(page, 0);
  const full = page.getByRole('region', { name: 'Full description' });
  await expect(full).not.toBeEmpty();
  const link = page.getByRole('link', { name: family === 'GitHub' ? /^Open on GitHub Docs/ : /^Open in the Godot docs/ });
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener');
  expect(await link.getAttribute('href')).toMatch(/^https:\/\/(docs\.godotengine\.org|docs\.github\.com)\//);
  // Long text scrolls inside the panel; the screen itself never scrolls sideways.
  expect(await full.evaluate((n) => getComputedStyle(n).overflowY)).toBe('auto');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
  // A wrong first answer is due tomorrow; a right one in three days (short-term steps off).
  expect(stats['Due tomorrow']).toBe(stats.Wrong);
  // Each was shown once, so both carry on rather than count as learned.
  expect(stats['Cards learned']).toBe(0);
  expect(stats['Continue tomorrow']).toBe(2);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
});
