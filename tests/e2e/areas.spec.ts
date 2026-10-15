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
  expect(await look(page)).toEqual({ theme: 'home', base: '#130e09', font: 'system-ui, sans-serif', scheme: 'dark', title: 'Areas · Godot Vocabulary' });
  await expect(page.locator('.gv-tile')).toHaveCount(2);
  await expect(tile(page, 'Godot')).toHaveAccessibleName('Godot, Next: Lesson 0, 6 lessons');
  await expect(tile(page, 'Git & GitHub')).toHaveAccessibleName('Git & GitHub, No courses yet');
  await expect(page.getByText('Last used')).toHaveCount(0);
  await expect(page.getByText('Unofficial; not affiliated with or endorsed by the Godot Foundation or GitHub.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'More' }).getByRole('button')).toHaveText(['About']);
  // The icons and chevrons are decorative; the label comes first.
  await expect(page.locator('.gv-tile [aria-hidden="true"]')).toHaveCount(4);
  await expect(page.locator('.gv-tile .gv-tile__label')).toHaveText(['Godot', 'Git & GitHub']);
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
  await expect(tile(page, 'Git & GitHub')).toHaveAccessibleName('Git & GitHub, No courses yet, Last used');
  await expect(tile(page, 'Godot')).toHaveAccessibleName('Godot, Next: Lesson 0, 6 lessons');
  await enterArea(page, 'Godot');
  await open(page, 'Courses');
  await expect(page.getByRole('heading', { name: 'Course 1: Step by step' })).toBeVisible();
  await screenReady(page, 'Courses');
});

test('the tile counts ready reviews of the area’s enabled families', async ({ page }) => {
  await gotoHome(page);
  await enterArea(page, 'Godot');
  const [a, b] = deck('godot-api');
  const [g] = deck('github');
  await importFromStart(page, exportFile({ progress: [overdueProgress(a!), overdueProgress(b!), overdueProgress(g!)] }));
  await gotoHome(page);
  await expect(tile(page, 'Godot')).toHaveAccessibleName('Godot, 2 ready, 6 lessons, Last used');
  await expect(tile(page, 'Git & GitHub')).toHaveAccessibleName('Git & GitHub, 1 ready, No courses yet');
  // Both ready: the figures carry the one colour, no tile shows a Next line, and no line under the heading repeats them.
  await expect(page.locator('.gv-today')).toHaveCount(0);
  expect(await coloured(page)).toEqual([['2 ready'], ['1 ready']]);
  await expect(page.getByText(/^Next: /)).toHaveCount(0);
  // "Last used" sits under the figure, in the right-hand column.
  await expect(tile(page, 'Godot').locator('.gv-tile__tag')).toHaveText('Last used');
});

const ACTION_RGB = 'rgb(227, 191, 127)'; // --home-action-color #e3bf7f

/** Per tile, the texts drawn in the home's action colour. */
const coloured = (page: Page) =>
  page.locator('.gv-tile').evaluateAll((tiles, action) =>
    tiles.map((t) => [...t.querySelectorAll('.gv-tile__text > *')].filter((n) => getComputedStyle(n).color === action).map((n) => n.textContent)),
  ACTION_RGB);

test('fresh install: no line repeats the tile’s Next; no ready figure; the amber marks only Next; the count stands in the figure’s place', async ({ page }) => {
  await gotoHome(page);
  await expect(tile(page, 'Godot')).toBeVisible();
  await expect(page.locator('.gv-today')).toHaveCount(0);
  // Nothing ready: no ready figure; the lessons count takes its place, quiet, at weight 500 (decision 67).
  await expect(page.locator('.gv-tile__figure')).toHaveCount(0);
  expect(await coloured(page)).toEqual([['Next: Lesson 0'], []]);
  // The Next line keeps its place and weight, in the pale amber: the next thing to do.
  const next = await page.getByText('Next: Lesson 0', { exact: true }).evaluate((n) => getComputedStyle(n).fontWeight);
  expect(next).toBe('400');
  await expect(tile(page, 'Godot').locator('.gv-tile__line')).toHaveText(['Next: Lesson 0']);
  const count = tile(page, 'Godot').locator('.gv-tile__lessons');
  await expect(count).toHaveText('6 lessons');
  const [countBox, labelBox, nextBox] = await Promise.all([count.boundingBox(), tile(page, 'Godot').locator('.gv-tile__label').boundingBox(), tile(page, 'Godot').locator('.gv-tile__line--next').boundingBox()]);
  // On the label's row, to its right; the Next line below them.
  expect(countBox!.x).toBeGreaterThan(labelBox!.x + labelBox!.width);
  expect(nextBox!.y).toBeGreaterThanOrEqual(countBox!.y + countBox!.height - 1);
  expect(await count.evaluate((n) => getComputedStyle(n).fontWeight)).toBe('500');
  // "No courses yet" stays a small line under its label (the generic line style, not the count's).
  await expect(tile(page, 'Git & GitHub').locator('.gv-tile__lessons')).toHaveCount(0);
  await expect(tile(page, 'Git & GitHub').locator('.gv-tile__line')).toHaveText(['No courses yet']);
  // The heading, the unofficial line and About are not the amber.
  const grey = await page.evaluate(
    (action) => ['.gv-heading', '.gv-unofficial', '.gv-links button'].every((s) => getComputedStyle(document.querySelector(s)!).color !== action),
    ACTION_RGB,
  );
  expect(grey).toBe(true);
  // About is underlined in its own grey, and keeps its 44 px target.
  const about = await page.getByRole('navigation', { name: 'More' }).getByRole('button', { name: 'About' }).evaluate((n) => {
    const c = getComputedStyle(n);
    const r = n.getBoundingClientRect();
    return { line: c.textDecorationLine, same: c.textDecorationColor === c.color, big: r.width >= 44 && r.height >= 44 };
  });
  expect(about).toEqual({ line: 'underline', same: true, big: true });
});

/** The home footer's geometry: where it sits, the space around it, its two lines and their colours. */
const footer = (page: Page) =>
  page.evaluate(() => {
    const box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const [foot, tiles, about, line] = [box('.gv-home__footer'), box('.gv-tiles'), box('.gv-home__footer .gv-links button'), box('.gv-home__footer .gv-unofficial')];
    const centre = (r: DOMRect) => r.left + r.width / 2;
    const quiet = getComputedStyle(document.documentElement).getPropertyValue('--home-quiet-color').trim();
    const probe = document.createElement('span');
    probe.style.color = quiet;
    document.body.append(probe);
    const quietRgb = getComputedStyle(probe).color;
    probe.remove();
    const disclaimer = document.querySelector('.gv-home__footer .gv-unofficial')!;
    return {
      gapToViewportBottom: Math.round(window.innerHeight - foot.bottom),
      spaceAbove: Math.round(about.top - tiles.bottom),
      spaceInside: Math.round(line.top - about.bottom),
      aboutFirst: about.bottom <= line.top,
      sameCentre: Math.abs(centre(about) - centre(line)) <= 1 && getComputedStyle(disclaimer).textAlign === 'center',
      quiet: getComputedStyle(disclaimer).color === quietRgb,
      scrolls: document.documentElement.scrollHeight > window.innerHeight,
    };
  });

test('decision 66: the footer is pinned to the bottom, About above the quiet disclaimer, one alignment; on a short screen it follows', async ({ page }) => {
  await gotoHome(page);
  const tall = await footer(page);
  // #app's bottom padding is the 16 px gutter; nothing scrolls on a 780 px screen.
  expect(tall).toMatchObject({ gapToViewportBottom: 16, aboutFirst: true, sameCentre: true, quiet: true, scrolls: false });
  expect(tall.spaceAbove).toBeGreaterThan(tall.spaceInside);
  // Landscape on a phone: the content is taller than the screen, so the footer follows it, never over it.
  await page.setViewportSize({ width: 780, height: 360 });
  const short = await footer(page);
  expect(short.spaceAbove).toBeGreaterThanOrEqual(40);
  expect(short.spaceAbove).toBeGreaterThan(short.spaceInside);
  expect(short.aboutFirst).toBe(true);
});

/** The root's painted background: how many radial gradients it carries, and whether the page scrolls sideways. */
const backdrop = (page: Page) =>
  page.evaluate(() => {
    const root = document.documentElement;
    return {
      glows: getComputedStyle(root).backgroundImage.match(/radial-gradient\(/g)?.length ?? 0,
      sideways: root.scrollWidth > root.clientWidth,
    };
  });

test('one static glow at the top right, on the home only: no sideways scroll at 320 or 360 px, none on About, the same with reduced motion', async ({ page }) => {
  for (const width of [360, 320]) {
    await page.setViewportSize({ width, height: 780 });
    await gotoHome(page);
    expect(await backdrop(page), `${width} px`).toEqual({ glows: 1, sideways: false });
  }
  const painted = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundImage);
  expect(painted).toMatch(/at (100% 0%|right top|top right)/);
  // The tiles have no border and no drop shadow (decisions 66, 67): a gradient fill at 225° and one
  // 1 px lit top edge, drawn inside.
  const edges = await page.locator('.gv-tile').evaluateAll((tiles) =>
    tiles.map((t) => {
      const c = getComputedStyle(t);
      return { border: c.borderTopWidth, shadow: /^\S+\([^)]*\) 0px 1px 0px 0px inset$/.test(c.boxShadow), fill: c.backgroundImage.startsWith('linear-gradient(225deg') };
    }),
  );
  expect(edges).toEqual([{ border: '0px', shadow: true, fill: true }, { border: '0px', shadow: true, fill: true }]);
  // Static: nothing animates or transitions on the root.
  expect(await page.evaluate(() => document.documentElement.getAnimations().length)).toBe(0);

  await page.getByRole('button', { name: 'About', exact: true }).click();
  await screenReady(page, 'About');
  expect(await backdrop(page)).toEqual({ glows: 0, sideways: false });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoHome(page);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundImage)).toBe(painted);
});
