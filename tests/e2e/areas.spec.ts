import { expect, test, type Page } from '@playwright/test';
import { gotoStart, open, openArea, screenReady } from './helpers';

// Done-criteria 63, 64: the start and courses screens belong to an area, and entering an area puts on its look.

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

test('the app opens Godot; the temporary link enters Git & GitHub with its own title, line and look', async ({ page }) => {
  await gotoStart(page);
  expect(await look(page)).toEqual({ theme: 'godot', base: '#242424', font: "'Inter', system-ui, sans-serif", scheme: 'dark', title: 'Godot · Godot Vocabulary' });
  await expect(page.getByText('Unofficial; not affiliated with or endorsed by the Godot Foundation.')).toBeVisible();

  await openArea(page, 'Git & GitHub');
  const github = await look(page);
  expect(github).toMatchObject({ theme: 'github', base: '#24292e', scheme: 'dark', title: 'Git & GitHub · Godot Vocabulary' });
  expect(github.font).toMatch(/^system-ui, sans-serif/);
  await expect(page.getByText('Unofficial; not affiliated with or endorsed by GitHub.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'More' }).getByRole('button', { name: 'Git & GitHub' })).toHaveCount(0);

  // Courses of the area only: Git & GitHub has none yet.
  await open(page, 'Courses');
  await expect(page.getByText('No courses in this area yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await screenReady(page, 'Git & GitHub');

  await openArea(page, 'Godot');
  expect((await look(page)).theme).toBe('godot');
  expect((await look(page)).base).toBe('#242424');
  await open(page, 'Courses');
  await expect(page.getByRole('heading', { name: 'Course 1: Step by step' })).toBeVisible();
});
