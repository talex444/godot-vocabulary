import { expect, test } from '@playwright/test';
import { answer, deck, exportFile, familyStats, goNext, gotoStart, importFromStart, openArea, overdueProgress, startSession } from './helpers';

// Done-criteria 11 (and 21 on the way in): an overdue review blocks new cards until it is answered.
// The overdue state is seeded through the app's own Import with a crafted version 1 export file.

const area2d = deck('godot-api').find((c) => c.id === 'api:class:Area2D')!;
const progressbar = (page: import('@playwright/test').Page) => page.getByRole('progressbar', { name: 'Cards done' });

test('with one overdue review, the session is that review first, then new cards follow', async ({ page }) => {
  await gotoStart(page);
  await importFromStart(page, exportFile({ progress: [overdueProgress(area2d)] }));

  const api = await familyStats(page, 'godot-api');
  expect(api.Overdue).toBeGreaterThanOrEqual(1);
  expect(api.Due).toBeGreaterThanOrEqual(1);
  await expect(page.locator('.gv-note')).toHaveText('New cards wait until the 1 overdue review is done.');

  await startSession(page);
  // Reviews only: the queue holds the one overdue card.
  await expect(progressbar(page)).toHaveAttribute('aria-valuemax', '1');
  await expect(page.locator('.gv-card__prompt')).toContainText(area2d.prompt.replace(/`/g, ''));

  await answer(page, 0);
  // Cleared: the new cards are appended behind it.
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
  expect(Number(await progressbar(page).getAttribute('aria-valuemax'))).toBeGreaterThan(1);

  // A new card comes within the next two (a wrong answer re-asks Area2D first).
  let sawNew = false;
  for (let i = 0; i < 2 && !sawNew; i++) {
    await goNext(page);
    sawNew = !(await page.locator('.gv-card__prompt').textContent())!.includes(area2d.prompt.replace(/`/g, ''));
    if (!sawNew) await answer(page, 0);
  }
  expect(sawNew).toBe(true);
});

test('a fresh install with nothing overdue gets new cards at once', async ({ page }) => {
  await gotoStart(page);
  for (const f of ['godot-api', 'gdscript'] as const) expect((await familyStats(page, f)).Overdue).toBe(0);
  await expect(page.locator('.gv-note')).toHaveCount(0);
  await startSession(page);
  await expect(progressbar(page)).toHaveAttribute('aria-valuemax', '15');
});

test('decision 21, amended: an overdue Godot review does not hold back GitHub’s new cards', async ({ page }) => {
  await gotoStart(page);
  await importFromStart(page, exportFile({ progress: [overdueProgress(area2d)] }));
  await expect(page.locator('.gv-note')).toHaveText('New cards wait until the 1 overdue review is done.');
  await openArea(page, 'Git & GitHub');
  expect(await familyStats(page, 'github')).toEqual({ Due: 0, 'New today': 5, Overdue: 0 });
  await expect(page.locator('.gv-note')).toHaveCount(0);
  await startSession(page);
  await expect(progressbar(page)).toHaveAttribute('aria-valuemax', '5');
});
