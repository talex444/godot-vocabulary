import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { backToStart, cardPanel, deck, gotoStart, onlyFamily, open, playSession, startReady, startSession } from './helpers';

// Done-criteria 37: Skip this card, at the phone viewport.

test('37: skip with a reason; gone from the session, listed in Settings, exported, and undo brings it back', async ({ page }) => {
  await gotoStart(page);
  await onlyFamily(page, 'github', 3);
  await startSession(page);

  const skippedId = (await cardPanel(page).getAttribute('data-card-id'))!;
  const title = deck('github').find((c) => c.id === skippedId)!.answer;
  await page.getByRole('button', { name: 'Skip this card' }).click();
  const reason = page.getByLabel('Reason (optional)');
  await expect(reason).toBeFocused();
  // Cancel closes the field and keeps the card.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(reason).toBeHidden();
  await expect(cardPanel(page)).toHaveAttribute('data-card-id', skippedId);

  await page.getByRole('button', { name: 'Skip this card' }).click();
  await reason.fill('The wording is confusing');
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(cardPanel(page)).not.toHaveAttribute('data-card-id', skippedId);

  // The rest of the session never shows it again.
  const showings = await playSession(page);
  expect(showings.map((s) => s.cardId)).not.toContain(skippedId);
  expect(new Set(showings.map((s) => s.cardId)).size).toBe(2);
  await page.getByRole('button', { name: 'Done' }).click();
  await startReady(page);

  await open(page, 'Settings');
  const list = page.getByRole('list', { name: 'Skipped cards' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText(title);
  await expect(list).toContainText('GitHub');
  await expect(list).toContainText('“The wording is confusing”');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()]);
  const file = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(file.skipped).toHaveLength(1);
  expect(file.skipped[0]).toMatchObject({ cardId: skippedId, reason: 'The wording is confusing' });

  await page.getByRole('button', { name: `Undo skip: ${title}` }).click();
  await expect(page.getByRole('list', { name: 'Skipped cards' })).toHaveCount(0);
  await expect(page.getByText('No skipped cards.', { exact: false })).toBeVisible();
  await backToStart(page);

  // Back in the deck: it is the one new card left for today.
  await startSession(page);
  await expect(cardPanel(page)).toHaveAttribute('data-card-id', skippedId);
});
