import { expect, test, type Page } from '@playwright/test';
import { gotoHome, homeReady, LESSON0_TITLE, screenReady, startReady, tile } from './helpers';

// Done-criteria 69 / decision 51: the wipe from the tapped tile, after the area has loaded; instant
// under reduced motion; taps ignored while it runs.

const root = (page: Page) =>
  page.evaluate(() => {
    const r = document.documentElement;
    const style = getComputedStyle(r);
    return { theme: r.dataset.theme, switched: r.dataset.switched, base: style.getPropertyValue('--base-color').trim(), scheme: style.colorScheme };
  });

/** Waits for the transition's `finished` promise: the app clears `data-switching` once it resolves. */
const switchFinished = (page: Page) =>
  page.waitForFunction(() => document.documentElement.dataset.switched !== undefined && !('switching' in document.documentElement.dataset));

test('with reduced motion the switch is instant and the title appears', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoHome(page);
  await tile(page, 'Git & GitHub').click();
  await startReady(page, 'Git & GitHub');
  expect(await root(page)).toEqual({ theme: 'github', switched: 'instant', base: '#24292e', scheme: 'dark' });
});

test('without it the area wipes in; when the transition has finished the title and tokens are the area’s', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await gotoHome(page);
  // Nothing ready on a fresh install: the Godot tile opens Lesson 0 through the same wipe (decision 66).
  await tile(page, 'Godot').click();
  await switchFinished(page);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(LESSON0_TITLE);
  expect(await root(page)).toEqual({ theme: 'godot', switched: 'wipe', base: '#242424', scheme: 'dark' });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await startReady(page, 'Godot');
  // Back to the home page wipes too.
  await page.getByRole('button', { name: 'All areas' }).click();
  await homeReady(page);
  await switchFinished(page);
  expect(await root(page)).toMatchObject({ theme: 'home', base: '#110c07' });
});

test('a double tap opens the area once', async ({ page }) => {
  await gotoHome(page);
  await tile(page, 'Git & GitHub').dblclick();
  await startReady(page, 'Git & GitHub');
  await switchFinished(page);
  expect(await page.evaluate(() => (history.state as { index: number }).index)).toBe(1);
  await page.goBack();
  await homeReady(page);
  expect(await page.evaluate(() => (history.state as { index: number }).index)).toBe(0);
});

test('a double tap on a tile that opens a lesson opens it once, over one area page', async ({ page }) => {
  await gotoHome(page);
  await tile(page, 'Godot').dblclick();
  await screenReady(page, LESSON0_TITLE);
  await switchFinished(page);
  expect(await page.evaluate(() => (history.state as { index: number }).index)).toBe(2);
  await page.goBack();
  await startReady(page, 'Godot');
  await page.goBack();
  await homeReady(page);
  expect(await page.evaluate(() => (history.state as { index: number }).index)).toBe(0);
});

// Decision 55's record: time from the tap to the screen's title on each area's first open (headless,
// local preview server, no throttling), to the title in the page and to the wipe's end. On a fresh
// install the Godot tile opens Lesson 0 (decision 66), so its title is the lesson's.
for (const label of ['Godot', 'Git & GitHub'] as const) {
  test(`first open of ${label}: time from tap to title`, async ({ page }) => {
    await gotoHome(page);
    const started = Date.now();
    await tile(page, label).click();
    await page.getByRole('heading', { name: label === 'Godot' ? LESSON0_TITLE : label, exact: true }).waitFor();
    const title = Date.now() - started;
    await switchFinished(page);
    const wiped = Date.now() - started;
    test.info().annotations.push({ type: 'tap-to-title', description: `${label}: title ${title} ms, wipe finished ${wiped} ms` });
    console.log(`tap-to-title ${label}: title ${title} ms, wipe finished ${wiped} ms`);
    expect(title).toBeLessThan(5000);
  });
}

test('on a slow network the tile says "Loading…" at once, and the wipe waits for the load', async ({ page }) => {
  await gotoHome(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 256 * 1024, uploadThroughput: 256 * 1024 });
  const godot = tile(page, 'Godot');
  await godot.click();
  await expect(godot).toContainText('Loading…', { timeout: 100 });
  await expect(godot).toHaveAttribute('aria-busy', 'true');
  // Announced by the home's status line; the tile's name stays the words it showed.
  await expect(page.getByRole('status')).toHaveText('Loading Godot…');
  await expect(godot).toHaveAccessibleName('Godot, Next: Lesson 0, 6 lessons');
  // Still the home page, no wipe begun, while the deck downloads.
  expect(await root(page)).toMatchObject({ theme: 'home' });
  await screenReady(page, LESSON0_TITLE);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
});
