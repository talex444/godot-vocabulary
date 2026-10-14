import { expect, test, type Page } from '@playwright/test';
import { answer, goNext, gotoStart, startSession, walkScreens, type ScreenName } from './helpers';

// Done-criteria 25, 29, 31: no horizontal scroll at 360 and 320 CSS px, landscape works, every tap
// target is at least 44×44, body text is at least 16 px, and text at 200% loses nothing.

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
  expect(seen).toHaveLength(10);
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

test('360×780 portrait: no horizontal scroll, every target 44×44, text at least 16 px', async ({ page }) => {
  await checkEveryScreen(page);
});

test.describe('320 CSS px wide (WCAG 1.4.10 reflow)', () => {
  test.use({ viewport: { width: 320, height: 780 } });
  test('no horizontal scroll, every target 44×44', async ({ page }) => {
    await checkEveryScreen(page);
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
