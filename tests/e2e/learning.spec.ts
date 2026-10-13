import { expect, test } from '@playwright/test';
import { gotoStart, onlyFamily, playSession, startSession, statValues } from './helpers';

// Done-criteria 33: first-session learning on a 10-card session, at the phone viewport.

test('33: ten new cards come back spaced, never adjacent, until learned; the summary counts each once', async ({ page }) => {
  await gotoStart(page);
  await onlyFamily(page, 'godot-api', 10);
  await startSession(page);
  await expect(page.getByRole('progressbar', { name: 'Cards done' })).toHaveAttribute('aria-valuemax', '10');

  // The third card's first answer is wrong; every other answer is right.
  let firstShowings = 0;
  const showings = await playSession(page, (_, showing) => showing === 0 && ++firstShowings === 3);
  const ids = [...new Set(showings.map((s) => s.cardId))];
  expect(ids).toHaveLength(10);

  for (let i = 1; i < showings.length; i++) expect(showings[i]!.cardId, `showing ${i + 1}`).not.toBe(showings[i - 1]!.cardId);
  for (const id of ids) {
    const at = showings.flatMap((s, i) => (s.cardId === id ? [i] : []));
    const answers = showings.filter((s) => s.cardId === id);
    // Asked three times, then right last; the showing numbers count up from the first.
    expect(answers.length, id).toBeGreaterThanOrEqual(3);
    expect(answers.at(-1)!.correct, id).toBe(true);
    expect(answers.map((s) => s.showing)).toEqual(answers.map((_, i) => i));
    // Spread out: eight other showings between two of the same card while the queue is long
    // (the unit tests pin the exact rule near the end, where fewer are left).
    for (let k = 1; k < at.length; k++) {
      if (at[k - 1]! < showings.length - 18) expect(at[k]! - at[k - 1]! - 1, `${id} gap`).toBeGreaterThanOrEqual(8);
    }
  }
  expect(showings.filter((s) => !s.correct)).toHaveLength(1);
  // Later showings of these description cards are flipped (decision 24).
  expect(showings.some((s) => s.direction === 'flipped')).toBe(true);
  expect(showings.filter((s) => s.showing === 0).every((s) => s.direction === 'forward')).toBe(true);

  const stats = await statValues(page.locator('.gv-stat'));
  expect(stats['Cards seen']).toBe(10);
  expect(stats.Right).toBe(9);
  expect(stats.Wrong).toBe(1);
  expect(stats['Cards learned']).toBe(10);
  expect(stats['Continue tomorrow']).toBe(0);
});
