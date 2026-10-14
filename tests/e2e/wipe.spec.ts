import { expect, test, type Page } from '@playwright/test';
import { gotoHome, homeReady, startReady, tile } from './helpers';

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
  await tile(page, 'Godot').click();
  await switchFinished(page);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Godot');
  expect(await root(page)).toEqual({ theme: 'godot', switched: 'wipe', base: '#242424', scheme: 'dark' });
  // Back to the home page wipes too.
  await page.getByRole('button', { name: 'All areas' }).click();
  await homeReady(page);
  await switchFinished(page);
  expect(await root(page)).toMatchObject({ theme: 'home', base: '#161616' });
});

test('a double tap opens the area once', async ({ page }) => {
  await gotoHome(page);
  await tile(page, 'Godot').dblclick();
  await startReady(page, 'Godot');
  await switchFinished(page);
  expect(await page.evaluate(() => (history.state as { index: number }).index)).toBe(1);
  await page.goBack();
  await homeReady(page);
  expect(await page.evaluate(() => (history.state as { index: number }).index)).toBe(0);
});

test('on a slow network the tile says "Loading…" at once, and the wipe waits for the load', async ({ page }) => {
  await gotoHome(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 256 * 1024, uploadThroughput: 256 * 1024 });
  const godot = tile(page, 'Godot');
  await godot.click();
  await expect(godot).toContainText('Loading…', { timeout: 100 });
  await expect(godot).toHaveAttribute('aria-busy', 'true');
  // Still the home page, no wipe begun, while the deck downloads.
  expect(await root(page)).toMatchObject({ theme: 'home' });
  await startReady(page, 'Godot');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
});
