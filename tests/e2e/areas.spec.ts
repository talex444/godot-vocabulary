import { expect, test, type Page } from '@playwright/test';
import { deck, enterArea, exportFile, gotoHome, importFromStart, open, openArea, overdueProgress, screenReady, tile } from './helpers';

// Done-criteria 63, 64, 67: the app opens the home page; each tile opens its area, which puts on its look.

const look = (page: Page) =>
  page.evaluate(() => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    return {
      theme: root.dataset.theme,
      base: style.getPropertyValue('--base-color').trim(),
      font: style.getPropertyValue('--font-ui').trim(),
      scheme: style.colorScheme,
      title: document.title,
    };
  });

test('the app opens the home page: a tile per area with its figures, no last-used tag on a fresh install', async ({ page }) => {
  await gotoHome(page);
  expect(await look(page)).toEqual({ theme: 'home', base: '#171513', font: 'system-ui, sans-serif', scheme: 'dark', title: 'Areas · Godot Vocabulary' });
  await expect(page.locator('.gv-tile')).toHaveCount(2);
  await expect(tile(page, 'Godot')).toHaveAccessibleName('Godot, Nothing due, 0 of 6 lessons');
  await expect(tile(page, 'Git & GitHub')).toHaveAccessibleName('Git & GitHub, Nothing due, No courses yet');
  await expect(page.getByText('Last used')).toHaveCount(0);
  await expect(page.getByText('Unofficial; not affiliated with or endorsed by the Godot Foundation or GitHub.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'More' }).getByRole('button')).toHaveText(['About']);
  // The icons are decorative; the label comes first.
  await expect(page.locator('.gv-tile img[aria-hidden="true"]')).toHaveCount(2);
});

test('a tile enters its area in its own look; the area page keeps only the app’s own links', async ({ page }) => {
  await gotoHome(page);
  await enterArea(page, 'Godot');
  expect(await look(page)).toEqual({ theme: 'godot', base: '#242424', font: "'Inter', system-ui, sans-serif", scheme: 'dark', title: 'Godot · Godot Vocabulary' });
  await expect(page.getByText('Unofficial; not affiliated with or endorsed by the Godot Foundation.')).toBeVisible();
  // GV-8a's temporary links to the other area are gone.
  await expect(page.getByRole('navigation', { name: 'More' }).getByRole('button')).toHaveText(['Courses', 'Settings', 'Add card', 'About']);

  await openArea(page, 'Git & GitHub');
  const github = await look(page);
  expect(github).toMatchObject({ theme: 'github', base: '#24292e', scheme: 'dark', title: 'Git & GitHub · Godot Vocabulary' });
  expect(github.font).toMatch(/^system-ui, sans-serif/);
  await expect(page.getByText('Unofficial; not affiliated with or endorsed by GitHub.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'More' }).getByRole('button')).toHaveText(['Courses', 'Settings', 'Add card', 'About']);

  // Courses of the area only: Git & GitHub has none yet.
  await open(page, 'Courses');
  await expect(page.getByText('No courses in this area yet.')).toBeVisible();

  // Home again: the area used last carries the tag.
  await gotoHome(page);
  await expect(tile(page, 'Git & GitHub')).toHaveAccessibleName('Git & GitHub, Nothing due, No courses yet, Last used');
  await expect(tile(page, 'Godot')).toHaveAccessibleName('Godot, Nothing due, 0 of 6 lessons');
  await enterArea(page, 'Godot');
  await open(page, 'Courses');
  await expect(page.getByRole('heading', { name: 'Course 1: Step by step' })).toBeVisible();
  await screenReady(page, 'Courses');
});

test('the tile counts due reviews of the area’s enabled families', async ({ page }) => {
  await gotoHome(page);
  await enterArea(page, 'Godot');
  const [a, b] = deck('godot-api');
  const [g] = deck('github');
  await importFromStart(page, exportFile({ progress: [overdueProgress(a!), overdueProgress(b!), overdueProgress(g!)] }));
  await gotoHome(page);
  await expect(tile(page, 'Godot')).toHaveAccessibleName('Godot, 2 due, 0 of 6 lessons, Last used');
  await expect(tile(page, 'Git & GitHub')).toHaveAccessibleName('Git & GitHub, 1 due, No courses yet');
});
