import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { answer, backToStart, endSession, enterArea, gotoStart, homeReady, importOnSettings, open, screenReady, startReady, startSession, statValues } from './helpers';

test.use({ acceptDownloads: true });

// Done-criteria 19–21: settings persist, the load maths and the twenty warning, add a card,
// export, then a fresh install imports the file and gets progress, settings and custom cards back.

const WARNING = 'Above twenty new cards a day the review pile grows to about two hundred a day. It is allowed; it is a lot.';
const family = (page: Page, name: string) => page.getByRole('group', { name, exact: true });
const load = (page: Page) => statValues(page.locator('.gv-load .gv-stat'));

/** Settings save in the background after each tap; wait until IndexedDB holds them before reloading. */
async function storedNewPerDay(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('godot-vocabulary');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction('settings').objectStore('settings').get('settings');
          get.onsuccess = () => {
            const families = (get.result?.families ?? {}) as Record<string, { enabled: boolean; newPerDay: number }>;
            open.result.close();
            resolve(Object.entries(families).map(([k, v]) => `${k}:${v.enabled ? v.newPerDay : 'off'}`).join(' '));
          };
        };
      }),
  );
}

test('settings switches and steppers persist; totals, projection and the above-twenty warning', async ({ page }) => {
  await gotoStart(page);
  await open(page, 'Settings');
  // The defaults, 5 + 10 + 5 + 5 = 25 with the Godot editor family (GV-8n), are above twenty already.
  expect(await load(page)).toEqual({ 'New per day': 25, 'Reviews per day': 250 });
  await expect(page.locator('.gv-warning')).toHaveText(WARNING);
  // Retention is not exposed in v1.
  await expect(page.getByText(/retention/i)).toHaveCount(0);

  await family(page, 'Godot editor').getByRole('switch', { name: 'Godot editor' }).click();
  expect(await load(page)).toEqual({ 'New per day': 20, 'Reviews per day': 200 });
  await expect(page.locator('.gv-warning')).toBeEmpty();
  await family(page, 'GitHub').getByRole('switch', { name: 'GitHub' }).click();
  await family(page, 'GDScript').getByRole('button', { name: 'More: New cards per day' }).click();
  expect(await load(page)).toEqual({ 'New per day': 16, 'Reviews per day': 160 });
  await expect.poll(() => storedNewPerDay(page)).toBe('godot-editor:off godot-api:10 gdscript:6 github:off');

  await page.reload();
  await homeReady(page);
  await enterArea(page, 'Godot');
  await open(page, 'Settings');
  await expect(family(page, 'GitHub').getByRole('switch', { name: 'GitHub' })).toHaveAttribute('aria-checked', 'false');
  await expect(family(page, 'GDScript').locator('output')).toHaveText('6');
  expect(await load(page)).toEqual({ 'New per day': 16, 'Reviews per day': 160 });

  // Back on: 10 + 6 + 5 = 21, above twenty → the warning, and the value stays.
  await family(page, 'GitHub').getByRole('switch', { name: 'GitHub' }).click();
  expect(await load(page)).toEqual({ 'New per day': 21, 'Reviews per day': 210 });
  await expect(page.locator('.gv-warning')).toHaveText(WARNING);
  await expect.poll(() => storedNewPerDay(page)).toBe('godot-editor:off godot-api:10 gdscript:6 github:5');
  await page.reload();
  await homeReady(page);
  await enterArea(page, 'Godot');
  await open(page, 'Settings');
  expect(await load(page)).toEqual({ 'New per day': 21, 'Reviews per day': 210 });
  await expect(page.locator('.gv-warning')).toHaveText(WARNING);
});

test('add a card, export, then a fresh install imports it all back with replace', async ({ page, browser }) => {
  await gotoStart(page);
  await startSession(page);
  await answer(page, 0);
  await endSession(page);
  await page.getByRole('button', { name: 'Done' }).click();
  await startReady(page, 'Godot');

  await open(page, 'Add card');
  await page.getByLabel('Family').selectOption('gdscript');
  await page.getByLabel('Question').fill('Runs once when the node and its children have entered the scene tree.');
  await page.getByLabel('Right answer').fill('_ready');
  await page.getByLabel('Wrong answer 1').fill('_init');
  await page.getByLabel('Wrong answer 2').fill('_process');
  await page.getByLabel('Wrong answer 3').fill('_enter_tree');
  await page.getByRole('button', { name: 'Save' }).click();
  await screenReady(page, 'Card saved');
  await expect(page.locator('.gv-custom__answer')).toHaveText(['_ready']);
  await backToStart(page);

  await open(page, 'Settings');
  await family(page, 'Godot API').getByRole('button', { name: 'Fewer: New cards per day' }).click();
  await expect.poll(() => storedNewPerDay(page)).toBe('godot-editor:5 godot-api:9 gdscript:5 github:5');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^godot-vocabulary-\d{4}-\d{2}-\d{2}\.json$/);
  const text = await readFile((await download.path())!, 'utf8');
  const file = JSON.parse(text);
  expect(file.version).toBe(4);
  expect(file.skipped).toEqual([]);
  expect(file.exitTickets).toEqual([]);
  expect(file.progress).toHaveLength(1);
  expect(file.customCards.map((c: { answer: string }) => c.answer)).toEqual(['_ready']);
  expect(file.settings.families['godot-api'].newPerDay).toBe(9);

  // A fresh install: a new context has its own empty IndexedDB.
  const { baseURL, viewport, hasTouch, isMobile, serviceWorkers } = test.info().project.use;
  const fresh = await browser.newContext({ baseURL, viewport, hasTouch, isMobile, serviceWorkers });
  const other = await fresh.newPage();
  await gotoStart(other);
  await open(other, 'Settings');
  await expect(family(other, 'Godot API').locator('output')).toHaveText('10');
  await importOnSettings(other, text, 'replace');
  await expect(other.locator('.gv-result')).toHaveText('Restored 1 card of progress and 1 custom card.');
  await expect(family(other, 'Godot API').locator('output')).toHaveText('9');
  await backToStart(other);
  await open(other, 'Add card');
  await expect(other.locator('.gv-custom__answer')).toHaveText(['_ready']);
  await backToStart(other);

  // Exporting again from the fresh install gives back the same progress, settings and cards.
  await open(other, 'Settings');
  const [second] = await Promise.all([other.waitForEvent('download'), other.getByRole('button', { name: 'Export' }).click()]);
  const restored = JSON.parse(await readFile((await second.path())!, 'utf8'));
  expect(restored.progress).toEqual(file.progress);
  expect(restored.settings).toEqual(file.settings);
  expect(restored.customCards).toEqual(file.customCards);
  await fresh.close();
});

test('a file from a newer version of the app is refused in plain words, and nothing changes', async ({ page }) => {
  await gotoStart(page);
  await open(page, 'Settings');
  const newer = JSON.stringify({ version: 5, exportedAt: new Date().toISOString(), progress: [], settings: {}, customCards: [] });
  await page.locator('input[type="file"]').setInputFiles({ name: 'godot-vocabulary-new.json', mimeType: 'application/json', buffer: Buffer.from(newer) });
  await page.getByRole('button', { name: 'Replace everything on this device' }).click();
  await expect(page.locator('.gv-result')).toHaveText('Nothing was imported. This file was made by a newer version of the app. Update the app, then import it.');
  await expect(family(page, 'Godot API').locator('output')).toHaveText('10');
});
