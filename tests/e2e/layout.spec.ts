import { expect, test, type Page } from '@playwright/test';
import {
  answer,
  backToStart,
  deck,
  endSession,
  enterArea,
  exportFile,
  goNext,
  gotoHome,
  gotoStart,
  importFromStart,
  open,
  openArea,
  overdueProgress,
  screenReady,
  startSession,
  walkScreens,
  type ScreenName,
} from './helpers';

// Done-criteria 25, 29, 31, 66, 70: no horizontal scroll at 360 and 320 CSS px, landscape works, every
// tap target is at least 44×44, body text is at least 16 px, text at 200% and WCAG text spacing lose
// nothing; on the home page, in the Godot area and in the Git & GitHub area's own theme.

const TARGETS = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="switch"]';

interface Layout {
  scrollWidth: number;
  clientWidth: number;
  wide: string[];
  small: string[];
  tinyText: string[];
  clipped: string[];
  overlapping: string[];
}

/** Measures the current screen: overflow, targets under 44×44, text under 16 px, clipped text, overlapping controls. */
function measure(page: Page): Promise<Layout> {
  return page.evaluate((targets) => {
    const describe = (n: Element) => `${n.tagName.toLowerCase()}${n.className ? `.${String(n.className).split(' ').join('.')}` : ''} "${(n.textContent ?? '').trim().slice(0, 30)}"`;
    const shown = (n: Element) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';
    const controls = [...document.querySelectorAll(targets)].filter(shown);
    const rects = controls.map((n) => n.getBoundingClientRect());

    const small = controls.filter((_, i) => rects[i]!.width < 43.5 || rects[i]!.height < 43.5).map((n, i) => `${describe(n)} ${Math.round(rects[i]!.width)}×${Math.round(rects[i]!.height)}`);

    const texts = [...document.querySelectorAll('#screen *')].filter(
      (n) => shown(n) && !n.closest('.gv-visually-hidden') && [...n.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && c.textContent!.trim()),
    );
    const tinyText = texts.filter((n) => Number.parseFloat(getComputedStyle(n).fontSize) < 16).map((n) => `${describe(n)} ${getComputedStyle(n).fontSize}`);

    const clipped = texts
      .filter((n) => {
        const style = getComputedStyle(n);
        const hides = ['hidden', 'clip'].includes(style.overflowX);
        return hides && n.scrollWidth > n.clientWidth + 1;
      })
      .map(describe);

    const overlapping: string[] = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 1 && h > 1 && !controls[i]!.contains(controls[j]!) && !controls[j]!.contains(controls[i]!)) {
          overlapping.push(`${describe(controls[i]!)} / ${describe(controls[j]!)}`);
        }
      }
    }
    const root = document.documentElement;
    const wide = [...document.querySelectorAll('body *')]
      .filter((n) => shown(n) && n.getBoundingClientRect().right > root.clientWidth + 0.5)
      .map((n) => `${describe(n)} right=${Math.round(n.getBoundingClientRect().right)}`);
    return { scrollWidth: Math.max(root.scrollWidth, document.body.scrollWidth), clientWidth: root.clientWidth, wide, small, tinyText, clipped, overlapping };
  }, TARGETS);
}

async function checkEveryScreen(page: Page, options: { targets?: boolean; text?: boolean; afterLoad?: () => Promise<void> } = {}) {
  const seen: ScreenName[] = [];
  await walkScreens(
    page,
    async (name) => {
      seen.push(name);
      const m = await measure(page);
      expect(m.scrollWidth, `${name}: horizontal scroll from ${m.wide.join(', ')}`).toBeLessThanOrEqual(m.clientWidth);
      expect(m.clipped, `${name}: clipped text`).toEqual([]);
      expect(m.overlapping, `${name}: overlapping controls`).toEqual([]);
      if (options.targets !== false) expect(m.small, `${name}: targets under 44×44`).toEqual([]);
      if (options.text !== false) expect(m.tinyText, `${name}: text under 16 px`).toEqual([]);
    },
    options.afterLoad,
  );
  expect(seen).toHaveLength(11);
}

/** Cards vary (class icons, long names, code, inline code): measure twenty, before and after answering. */
async function checkManyCards(page: Page, options: { strict: boolean; afterLoad?: () => Promise<void> }) {
  await gotoStart(page);
  if (options.afterLoad) await options.afterLoad();
  await startSession(page);
  for (let i = 0; i < 20; i++) {
    for (const when of ['before', 'after'] as const) {
      if (when === 'after') await answer(page, i % 4);
      const m = await measure(page);
      const where = `card ${i + 1} ${when}`;
      expect(m.scrollWidth, `${where}: horizontal scroll from ${m.wide.join(', ')}`).toBeLessThanOrEqual(m.clientWidth);
      expect(m.clipped, `${where}: clipped text`).toEqual([]);
      expect(m.overlapping, `${where}: overlapping controls`).toEqual([]);
      if (options.strict) {
        expect(m.small, `${where}: targets under 44×44`).toEqual([]);
        expect(m.tinyText, `${where}: text under 16 px`).toEqual([]);
      }
    }
    await goNext(page);
  }
}

const textAt200 = (page: Page) => async () => {
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => getComputedStyle(document.body).fontSize)).toBe('32px');
};

/** WCAG 1.4.12's values, injected as a style the app must survive. */
const textSpacing = (page: Page) => async () => {
  await page.addStyleTag({
    content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
p { margin-bottom: 2em !important; }`,
  });
};

/**
 * The Git & GitHub area in its own theme (decision 54): its start screen, a card before and after
 * answering, and its course list, measured like every Godot screen.
 */
async function checkGithubArea(page: Page, options: { targets?: boolean; text?: boolean; afterLoad?: () => Promise<void> } = {}) {
  await gotoStart(page);
  if (options.afterLoad) await options.afterLoad();
  await openArea(page, 'Git & GitHub');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('github');
  const check = async (name: string) => {
    const m = await measure(page);
    expect(m.scrollWidth, `${name}: horizontal scroll from ${m.wide.join(', ')}`).toBeLessThanOrEqual(m.clientWidth);
    expect(m.clipped, `${name}: clipped text`).toEqual([]);
    expect(m.overlapping, `${name}: overlapping controls`).toEqual([]);
    if (options.targets !== false) expect(m.small, `${name}: targets under 44×44`).toEqual([]);
    if (options.text !== false) expect(m.tinyText, `${name}: text under 16 px`).toEqual([]);
  };
  await check('github start');
  await startSession(page);
  await check('github card');
  await answer(page, 0);
  await check('github card answered');
  await endSession(page);
  await page.getByRole('button', { name: 'Done' }).click();
  await open(page, 'Courses');
  await check('github courses');
  for (const screen of ['Settings', 'Add card', 'About'] as const) {
    await backToStart(page);
    await open(page, screen);
    await check(`github ${screen.toLowerCase()}`);
  }
}

/** The home page and About opened from it, in the home theme (decisions 49, 54). */
async function checkHome(page: Page, options: { targets?: boolean; text?: boolean; afterLoad?: () => Promise<void> } = {}) {
  await gotoHome(page);
  if (options.afterLoad) await options.afterLoad();
  const check = async (name: string) => {
    expect(await page.evaluate(() => document.documentElement.dataset.theme), name).toBe('home');
    const m = await measure(page);
    expect(m.scrollWidth, `${name}: horizontal scroll from ${m.wide.join(', ')}`).toBeLessThanOrEqual(m.clientWidth);
    expect(m.clipped, `${name}: clipped text`).toEqual([]);
    expect(m.overlapping, `${name}: overlapping controls`).toEqual([]);
    if (options.targets !== false) expect(m.small, `${name}: targets under 44×44`).toEqual([]);
    if (options.text !== false) expect(m.tinyText, `${name}: text under 16 px`).toEqual([]);
  };
  await check('home');
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await screenReady(page, 'About');
  await check('about from the home page');
}

/**
 * The home tile's own layout (decisions 63, 67): the ready figure stays on one line, the tile's parts
 * do not overlap one another, and all of them sit inside the tile. The label may wrap between words,
 * never inside one; the lessons count in the figure's place may wrap too.
 */
/**
 * The home wears the device's font (src/theme/home.ts): CI's system-ui is DejaVu Sans, about a fifth
 * wider than Segoe UI or Roboto. Verdana, about the widest common sans and on Windows too, makes this
 * machine catch what the runner catches. The style holds until the next navigation.
 */
const wideFont = (page: Page) => page.addStyleTag({ content: '.gv-tile, .gv-tile * { font-family: "Verdana", sans-serif; }' });

async function checkTiles(page: Page, where: string) {
  const tiles = await page.locator('.gv-tile').evaluateAll((nodes) =>
    nodes.map((tile) => {
      const box = tile.getBoundingClientRect();
      // With nothing ready a tile has no figure (decision 66), so no one-line check.
      const figure = tile.querySelector('.gv-tile__figure');
      const range = document.createRange();
      if (figure) range.selectNodeContents(figure);
      const label = tile.querySelector('.gv-tile__label')!;
      const labelRange = document.createRange();
      labelRange.selectNodeContents(label);
      const labelLines = new Set([...labelRange.getClientRects()].map((r) => Math.round(r.top))).size;
      const labelWords = label.textContent!.trim().split(/\s+/).length;
      const parts = [...tile.querySelectorAll('.gv-tile__label, .gv-tile__figure, .gv-tile__lessons, .gv-tile__line, .gv-tile__tag, .gv-tile__icon, .gv-tile__chevron')]
        .filter((n) => n.getClientRects().length > 0)
        .map((n) => ({ name: `${n.className} "${n.textContent}"`, r: n.getBoundingClientRect(), spills: n.scrollWidth > n.clientWidth + 1 }));
      const overlapping: string[] = [];
      for (const [i, a] of parts.entries()) {
        for (const b of parts.slice(i + 1)) {
          const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
          const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
          if (w > 0.5 && h > 0.5) overlapping.push(`${a.name} / ${b.name}`);
        }
      }
      const outside = parts.filter(({ r }) => r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5).map((p) => p.name);
      const spilling = parts.filter((p) => p.spills).map((p) => p.name);
      const figureLines = figure ? new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size : 1;
      // Decision 68: the icon shows at every text size, and the count is never larger than the name.
      const icon = tile.querySelector('.gv-tile__icon')!.getBoundingClientRect();
      const size = (n: Element | null) => (n ? Number.parseFloat(getComputedStyle(n).fontSize) : 0);
      const louder = [...tile.querySelectorAll('.gv-tile__figure, .gv-tile__lessons')].filter((n) => size(n) > size(label)).map((n) => `"${n.textContent}" ${size(n)}px`);
      return {
        figure: figure?.textContent ?? '(none)',
        figureLines,
        overlapping,
        outside,
        spilling,
        label: label.textContent,
        labelBroken: labelLines > labelWords,
        iconShown: icon.width > 0 && icon.height > 0,
        louder,
        labelSize: size(label),
      };
    }),
  );
  for (const t of tiles) {
    expect(t.iconShown, `${where}: "${t.label}" shows its icon`).toBe(true);
    expect(t.louder, `${where}: larger than the name (${t.labelSize}px)`).toEqual([]);
    expect(t.labelBroken, `${where}: "${t.label}" broken inside a word`).toBe(false);
    expect(t.spilling, `${where}: text wider than its place in the tile`).toEqual([]);
    expect(t.figureLines, `${where}: "${t.figure}" on one line`).toBe(1);
    expect(t.overlapping, `${where}: tile parts overlapping`).toEqual([]);
    expect(t.outside, `${where}: tile parts outside the tile`).toEqual([]);
  }
}

/** Twelve Godot reviews and three GitHub reviews due, the widest figures the tiles commonly show. */
async function bothDue(page: Page) {
  await enterArea(page, 'Godot');
  const progress = [...deck('godot-api').slice(0, 12), ...deck('github').slice(0, 3)].map((c) => overdueProgress(c));
  await importFromStart(page, exportFile({ progress }));
  await gotoHome(page);
}

test('360×780 portrait, the home page: the same', async ({ page }) => {
  await checkHome(page);
});

/** Lesson 0 done and nothing ready: the widest lessons count, "1 of 7 lessons", in the figure's place. */
async function oneLessonDone(page: Page) {
  await enterArea(page, 'Godot');
  const file = { ...exportFile(), version: 2, skipped: [], lessonsDone: [{ lessonId: 'c1-editor', at: new Date().toISOString() }] };
  await importFromStart(page, file);
  await gotoHome(page);
}

test('the home tiles at 360 and 320 px: the figure on one line, nothing overlapping, nothing outside the tile', async ({ page }) => {
  await gotoHome(page);
  await checkTiles(page, 'fresh, 360');
  await page.setViewportSize({ width: 320, height: 780 });
  await checkTiles(page, 'fresh, 320');
  await wideFont(page);
  await checkTiles(page, 'fresh, 320, wide font');
  await oneLessonDone(page);
  await expect(page.locator('.gv-tile__lessons')).toHaveText('1 of 7 lessons');
  await checkTiles(page, 'one lesson done, 320');
  await page.setViewportSize({ width: 360, height: 780 });
  await checkTiles(page, 'one lesson done, 360');
  await page.setViewportSize({ width: 320, height: 780 });
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  await checkTiles(page, 'one lesson done, 320, 200% text');
  await page.evaluate(() => (document.documentElement.style.fontSize = ''));
  await bothDue(page);
  await checkTiles(page, 'both due, 320');
  await wideFont(page);
  await checkTiles(page, 'both due, 320, wide font');
  await checkHome(page);
  await gotoHome(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await checkTiles(page, 'both due, 360');
  await page.setViewportSize({ width: 320, height: 780 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await checkTiles(page, 'both due, 320, 200% text');
  await wideFont(page);
  await checkTiles(page, 'both due, 320, 200% text, wide font');
  await page.evaluate(() => (document.documentElement.style.fontSize = ''));
  await page.setViewportSize({ width: 360, height: 780 });
  await checkTiles(page, 'both due, 360, wide font');
  await oneLessonDone(page);
  await wideFont(page);
  await checkTiles(page, 'one lesson done, 320, wide font');
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  await checkTiles(page, 'one lesson done, 320, 200% text, wide font');
});

/**
 * Decision 68: Tyler's phone runs at a larger font setting than the default, so the tiles are checked
 * at 130, 150 and 200 % text, at 360 and 320 px, in each common state, in the device font and then in
 * the wide font: the icon shows, the count never out-sizes the name, nothing overlaps or spills.
 */
test('the home tiles at 130, 150 and 200 % text: the icon stays, the count is never larger than the name', async ({ page }) => {
  const states: [string, (page: Page) => Promise<void>][] = [
    ['fresh', gotoHome],
    ['one lesson done', oneLessonDone],
    ['both due', bothDue],
  ];
  for (const [state, arrive] of states) {
    await page.setViewportSize({ width: 360, height: 780 });
    await gotoHome(page);
    await arrive(page);
    for (const font of ['device font', 'wide font']) {
      if (font === 'wide font') await wideFont(page);
      for (const scale of ['130%', '150%', '200%']) {
        await page.evaluate((s) => (document.documentElement.style.fontSize = s), scale);
        for (const width of [360, 320]) {
          await page.setViewportSize({ width, height: 780 });
          await checkTiles(page, `${state}, ${width}, ${scale} text, ${font}`);
        }
      }
      await page.evaluate(() => (document.documentElement.style.fontSize = ''));
    }
  }
});

test('360×780 portrait: no horizontal scroll, every target 44×44, text at least 16 px', async ({ page }) => {
  await checkEveryScreen(page);
});

test('360×780 portrait, Git & GitHub area: the same', async ({ page }) => {
  await checkGithubArea(page);
});

test.describe('320 CSS px wide (WCAG 1.4.10 reflow)', () => {
  test.use({ viewport: { width: 320, height: 780 } });
  test('no horizontal scroll, every target 44×44', async ({ page }) => {
    await checkEveryScreen(page);
  });
  test('Git & GitHub area: no horizontal scroll, every target 44×44', async ({ page }) => {
    await checkGithubArea(page);
  });
  test('Git & GitHub area at 200% text', async ({ page }) => {
    await checkGithubArea(page, { targets: false, text: false, afterLoad: textAt200(page) });
  });
  test('the home page: no horizontal scroll, every target 44×44', async ({ page }) => {
    await checkHome(page);
  });
  test('the home page at 200% text', async ({ page }) => {
    await checkHome(page, { targets: false, text: false, afterLoad: textAt200(page) });
  });
  test('twenty cards fit, with targets and text at size', async ({ page }) => {
    await checkManyCards(page, { strict: true });
  });
  test('twenty cards fit at 200% text', async ({ page }) => {
    await checkManyCards(page, { strict: false, afterLoad: textAt200(page) });
  });
});

test.describe('landscape 780×360 (WCAG 1.3.4)', () => {
  test.use({ viewport: { width: 780, height: 360 } });
  test('every screen works and fits the width', async ({ page }) => {
    await checkEveryScreen(page);
  });
  test('Git & GitHub area works and fits the width', async ({ page }) => {
    await checkGithubArea(page);
  });
  test('the home page works and fits the width', async ({ page }) => {
    await checkHome(page);
  });
});

// WCAG 1.4.12: line height 1.5, paragraph spacing 2 em, letter spacing 0.12 em, word spacing 0.16 em,
// in both areas' themes: nothing clipped, nothing overlapping, no sideways scroll.
test.describe('text spacing (WCAG 1.4.12)', () => {
  test('Godot: every screen', async ({ page }) => {
    await checkEveryScreen(page, { targets: false, text: false, afterLoad: textSpacing(page) });
  });
  test('Git & GitHub area', async ({ page }) => {
    await checkGithubArea(page, { targets: false, text: false, afterLoad: textSpacing(page) });
  });
  test('the home page', async ({ page }) => {
    await checkHome(page, { targets: false, text: false, afterLoad: textSpacing(page) });
  });
});

// Done-criteria 60: the Android package draws edge to edge. A browser reports zero env() insets, so the
// test stands in for the phone by setting the --safe-area-inset-* properties Capacitor injects.
const shellBox = (page: Page) =>
  page.evaluate(() => {
    const style = getComputedStyle(document.getElementById('app')!);
    const name = document.querySelector('.gv-app-name')!.getBoundingClientRect();
    return { nameTop: name.top, nameLeft: name.left, padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft] };
  });

test('safe areas: zero insets keep the shell as it was, injected insets pad every edge', async ({ page }) => {
  await gotoStart(page);
  const before = await shellBox(page);
  expect(before.padding).toEqual(['8px', '16px', '16px', '16px']);
  await page.evaluate(() => {
    const root = document.documentElement.style;
    root.setProperty('--safe-area-inset-top', '48px');
    root.setProperty('--safe-area-inset-right', '24px');
    root.setProperty('--safe-area-inset-bottom', '34px');
    root.setProperty('--safe-area-inset-left', '24px');
  });
  const after = await shellBox(page);
  expect(after.padding).toEqual(['56px', '40px', '50px', '40px']);
  expect(after.nameTop - before.nameTop).toBeCloseTo(48, 0);
  expect(after.nameLeft - before.nameLeft).toBeCloseTo(24, 0);
});

// WCAG 1.4.4 proxy: Playwright cannot set browser zoom or the text-size preference, so the root
// font size is set to 200% in the page. The stylesheet sizes text in rem, so all text doubles; the
// check is that nothing scrolls sideways, no text is clipped, and no controls overlap.
test('text at 200% (root font size proxy): no overflow, nothing clipped or overlapping', async ({ page }) => {
  await checkEveryScreen(page, { targets: false, text: false, afterLoad: textAt200(page) });
});
