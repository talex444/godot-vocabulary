import { expect, test, type Page } from '@playwright/test';
import { gotoStart, nextButton, walkScreens } from './helpers';

// Done-criteria 30: keyboard only. Tab follows reading order, Enter and Space activate, focus is
// visible (2.4.7: the outline or box-shadow changes on :focus-visible) and never obscured (2.4.11).

type Ring = { outline: string; shadow: string };
const ring = (page: Page): Promise<Ring> =>
  page.evaluate(() => {
    const s = getComputedStyle(document.activeElement!);
    return { outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, shadow: s.boxShadow };
  });

/** The focused element shows a ring it does not have unfocused, and is fully in view and on top. */
async function expectFocusShown(page: Page, where: string): Promise<void> {
  const focused = page.locator(':focus');
  await focused.scrollIntoViewIfNeeded();
  const state = await page.evaluate(() => {
    const n = document.activeElement as HTMLElement;
    const r = n.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    // Text fields draw the ring on their box (`:focus-within`), like Godot's LineEdit.
    const s = getComputedStyle(n.closest('.gv-field__box') ?? n);
    return {
      visible: n.matches(':focus-visible'),
      ring: (s.outlineStyle !== 'none' && Number.parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none',
      // Half a pixel of slack: a long page can scroll a target to a fractional edge (780.33 of 780).
      inView: r.top >= -0.5 && r.left >= 0 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth,
      onTop: hit !== null && (hit === n || n.contains(hit)),
    };
  });
  expect(state, where).toEqual({ visible: true, ring: true, inView: true, onTop: true });
}

/** Ring styles of an element while not focused, to compare with its focused look. */
async function unfocusedRing(page: Page, selector: string, index: number): Promise<Ring> {
  return page.locator(selector).nth(index).evaluate((n) => {
    const s = getComputedStyle(n);
    return { outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, shadow: s.boxShadow };
  });
}

test('a card by keyboard: Tab reaches the four choices in order, Space answers, Enter goes on', async ({ page }) => {
  await gotoStart(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeFocused();
  await expectFocusShown(page, 'Start');
  await page.keyboard.press('Enter');
  await page.locator('.gv-choice:not([disabled])').first().waitFor();

  const choices = page.locator('.gv-choice');
  for (let i = 0; i < 4; i++) {
    const before = await unfocusedRing(page, '.gv-choice', i);
    await page.keyboard.press('Tab');
    await expect(choices.nth(i)).toBeFocused();
    expect(await ring(page), `choice ${i + 1} ring changes on focus`).not.toEqual(before);
    await expectFocusShown(page, `choice ${i + 1}`);
  }

  // Space activates the focused choice; Next takes focus.
  await page.keyboard.press('Space');
  await expect(nextButton(page)).toBeFocused();
  for (let i = 0; i < 4; i++) await expect(choices.nth(i)).toBeDisabled();
  expect(await choices.nth(3).getAttribute('data-state')).toMatch(/^chosen-(right|wrong)$/);
  await expectFocusShown(page, 'Next');

  // Enter on Next shows the next card; Tab, Enter answers it.
  await page.keyboard.press('Enter');
  await page.locator('.gv-choice:not([disabled])').first().waitFor();
  await page.keyboard.press('Tab');
  await expect(choices.nth(0)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(nextButton(page)).toBeFocused();
  expect(await choices.nth(0).getAttribute('data-state')).toMatch(/^chosen-(right|wrong)$/);
});

test('every stop on every screen: reading order, focus visible and not obscured', async ({ page }) => {
  await walkScreens(page, async (name) => {
    // From the screen's heading (where navigation puts focus), Tab through until it leaves the screen.
    const stops: { top: number; left: number; label: string }[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const inScreen = await page.evaluate(() => !!document.activeElement?.closest('#screen'));
      if (!inScreen) break;
      await expectFocusShown(page, `${name} stop ${i + 1}`);
      stops.push(
        await page.evaluate(() => {
          const n = document.activeElement as HTMLElement;
          const r = n.getBoundingClientRect();
          return { top: r.top + scrollY, left: r.left + scrollX, label: n.getAttribute('aria-label') ?? n.textContent?.trim().slice(0, 30) ?? '' };
        }),
      );
    }
    expect(stops.length, `${name}: reachable stops`).toBeGreaterThan(0);
    // Reading order: each stop is below the last, or on the same line further right.
    for (let i = 1; i < stops.length; i++) {
      const [a, b] = [stops[i - 1]!, stops[i]!];
      const sameLine = Math.abs(b.top - a.top) < 8;
      expect(sameLine ? b.left > a.left : b.top > a.top, `${name}: "${a.label}" then "${b.label}"`).toBe(true);
    }
    // Leave focus where navigation expects it.
    await page.locator('#screen h2').first().focus();
  });
});

test('settings by keyboard: Space flips a switch, Enter steps a number', async ({ page }) => {
  await gotoStart(page);
  await page.getByRole('button', { name: 'Settings' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  const github = page.getByRole('switch', { name: 'GitHub' });
  await github.focus();
  await page.keyboard.press('Space');
  await expect(github).toHaveAttribute('aria-checked', 'false');
  const more = page.getByRole('group', { name: 'GDScript', exact: true }).getByRole('button', { name: 'More: New cards per day' });
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: 'GDScript', exact: true }).locator('output')).toHaveText('6');
});
