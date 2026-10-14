import { expect, test, type Page } from '@playwright/test';
import { enterArea, gotoHome, homeReady, open, screenReady, startReady, tile } from './helpers';

// Done-criteria 68 / decision 50: area pages titled with the area, All areas, and Back one screen at a
// time, where the on-screen Back and the phone's (here the browser's) Back land on the same screen.

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const themeColor = (page: Page) => page.locator('meta[name="theme-color"]').getAttribute('content');

test('home → Git & GitHub → All areas → home; titles, themes and the status-bar colour follow', async ({ page }) => {
  await gotoHome(page);
  expect(await themeColor(page)).toBe('#110c07');
  await enterArea(page, 'Git & GitHub');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Git & GitHub');
  expect(await page.title()).toBe('Git & GitHub · Godot Vocabulary');
  expect(await themeColor(page)).toBe('#24292e');
  // All areas sits apart from the More links, above the title.
  const allAreas = page.getByRole('navigation', { name: 'Areas' }).getByRole('button', { name: 'All areas' });
  const [a, h] = await Promise.all([allAreas.boundingBox(), page.getByRole('heading', { level: 2 }).boundingBox()]);
  expect(a!.y).toBeLessThan(h!.y);
  await allAreas.click();
  await homeReady(page);
  expect(await page.title()).toBe('Areas · Godot Vocabulary');
  expect(await theme(page)).toBe('home');
  expect(await themeColor(page)).toBe('#110c07');
  // All areas stepped back rather than adding an entry: Back now leaves the app's first screen.
  expect(await page.evaluate(() => (history.state as { index: number }).index)).toBe(0);
});

test('the browser Back from an area lands on the home page', async ({ page }) => {
  await gotoHome(page);
  await enterArea(page, 'Godot');
  await page.goBack();
  await homeReady(page);
  expect(await theme(page)).toBe('home');
});

test('area → Courses → Back lands on the area page, with either Back', async ({ page }) => {
  await gotoHome(page);
  await enterArea(page, 'Godot');
  await open(page, 'Courses');
  await page.goBack();
  await startReady(page, 'Godot');
  await open(page, 'Courses');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await startReady(page, 'Godot');
  // And one more Back of either kind reaches the home page.
  await page.goBack();
  await homeReady(page);
  // Forward again redraws the area page the entry records.
  await page.goForward();
  await startReady(page, 'Godot');
});

test('About returns to whatever opened it, in that screen’s theme', async ({ page }) => {
  await gotoHome(page);
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await screenReady(page, 'About');
  expect(await theme(page)).toBe('home');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await homeReady(page);

  await enterArea(page, 'Godot');
  await open(page, 'About');
  expect(await theme(page)).toBe('godot');
  await page.goBack();
  await startReady(page, 'Godot');
  expect(await theme(page)).toBe('godot');
});

test('a session’s summary Done and the browser Back both return to the area page', async ({ page }) => {
  await gotoHome(page);
  await enterArea(page, 'Godot');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.locator('.gv-choice:not([disabled])').first().waitFor();
  await page.goBack();
  await startReady(page, 'Godot');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'End session' }).click();
  await screenReady(page, 'Session done');
  await page.getByRole('button', { name: 'Done' }).click();
  await startReady(page, 'Godot');
  await page.goBack();
  await homeReady(page);
});

test('a cold start — how the reminder opens the app — lands on the home page, whatever was open before', async ({ page }) => {
  await gotoHome(page);
  await enterArea(page, 'Git & GitHub');
  await open(page, 'Courses');
  await page.reload();
  await homeReady(page);
  expect(await theme(page)).toBe('home');
  await expect(tile(page, 'Git & GitHub')).toHaveAccessibleName(/, Last used$/);
});
