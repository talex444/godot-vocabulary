import { expect, test } from '@playwright/test';
import { FAMILY_LABEL, answer, endSession, enterArea, familyStats, gotoStart, homeReady, open, openArea, screenReady, startReady, startSession, backToStart, type Family } from './helpers';

// Done-criteria 1–3: installable, works offline after one load, progress survives closing the app.
test.use({ serviceWorkers: 'allow' });

// The Godot area's families: the app opens on its start screen.
const FAMILIES: Family[] = ['godot-api', 'gdscript'];

test('installs, runs offline and keeps progress, settings and custom cards across a reopen', async ({ context, page }) => {
  await gotoStart(page);

  // 1: the manifest is linked and parses; the service worker is registered and controls the page.
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifest = await (await page.request.get(new URL(manifestHref!, page.url()).href)).json();
  expect(manifest).toMatchObject({ name: 'Godot Vocabulary', short_name: 'GodotVocab', display: 'standalone', theme_color: '#130e09' });
  // 1.3.0: the description names both areas; the bars wear the home page's base colour.
  expect(manifest.description).toMatch(/Godot.*Git & GitHub/);
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(await page.evaluate(async () => !!(await navigator.serviceWorker.ready).active)).toBe(true);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  // 2: offline, the app reloads and a session runs.
  await context.setOffline(true);
  await page.reload();
  await homeReady(page);
  await enterArea(page, 'Godot');
  const initial = Object.fromEntries(await Promise.all(FAMILIES.map(async (f) => [f, await familyStats(page, f)] as const)));
  await startSession(page);
  const label = await page.locator('.gv-card__family').textContent();
  const answered = FAMILIES.find((f) => FAMILY_LABEL[f] === label)!;
  await answer(page, 0);
  await endSession(page);
  await expect(page.locator('.gv-stat').filter({ hasText: 'Cards seen' }).locator('dd')).toHaveText('1');
  await page.getByRole('button', { name: 'Done' }).click();
  await startReady(page);

  // Still offline: change a setting and add a card.
  await open(page, 'Settings');
  await page.getByRole('group', { name: 'GitHub', exact: true }).getByRole('button', { name: 'More: New cards per day' }).click();
  await backToStart(page);
  await open(page, 'Add card');
  await page.getByLabel('Family').selectOption('github');
  await page.getByLabel('Question').fill('Replays your commits on top of another branch, one by one.');
  await page.getByLabel('Right answer').fill('rebase');
  await page.getByLabel('Wrong answer 1').fill('merge');
  await page.getByLabel('Wrong answer 2').fill('cherry-pick');
  await page.getByLabel('Wrong answer 3').fill('squash');
  await page.getByRole('button', { name: 'Save' }).click();
  await screenReady(page, 'Card saved');
  await backToStart(page);
  const before = Object.fromEntries(await Promise.all(FAMILIES.map(async (f) => [f, await familyStats(page, f)] as const)));
  // The answered card is no longer new today (GitHub's budget also went up by one).
  const extra = answered === 'github' ? 1 : 0;
  expect(before[answered]!['New today']).toBe(initial[answered]!['New today']! - 1 + extra);

  // 3: close the app, reopen with the network still off: same counts, settings and custom cards.
  await page.close();
  const reopened = await context.newPage();
  await gotoStart(reopened);
  for (const f of FAMILIES) expect(await familyStats(reopened, f)).toEqual(before[f]);
  // The GitHub deck loads offline too: five new cards a day plus one, and the custom card is one of them.
  await openArea(reopened, 'Git & GitHub');
  expect((await familyStats(reopened, 'github'))['New today']).toBe(6);
  await open(reopened, 'Settings');
  await expect(reopened.getByRole('group', { name: 'GitHub', exact: true }).locator('output')).toHaveText('6');
  await backToStart(reopened);
  await open(reopened, 'Add card');
  await expect(reopened.locator('.gv-custom__answer')).toHaveText(['rebase']);
  await context.setOffline(false);
});
