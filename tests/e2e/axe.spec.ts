import { writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { answer, backToStart, endSession, exportFile, goNext, gotoStart, open, screenReady, settings, startReady, startSession } from './helpers';

// Done-criteria 27: axe-core with the WCAG 2.2 AA tags on every screen. Every rule but
// `color-contrast` must pass. Contrast is reported, not failed (decision #22: where a Godot colour
// falls short, Godot wins): its findings go to docs/axe-contrast.md, which this spec rewrites.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

interface Finding {
  screen: string;
  selector: string;
  foreground: string;
  background: string;
  expected: string;
  actual: string;
}

const findings: Finding[] = [];
const screens: string[] = [];

async function audit(page: Page, screen: string): Promise<void> {
  screens.push(screen);
  const strict = await new AxeBuilder({ page }).withTags(TAGS).disableRules(['color-contrast']).analyze();
  const problems = strict.violations.map((v) => `${v.id} (${v.help}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(problems, `${screen}: axe violations`).toEqual([]);

  const full = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const violation of full.violations.filter((v) => v.id === 'color-contrast')) {
    for (const node of violation.nodes) {
      const data = (node.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number; expectedContrastRatio?: string };
      findings.push({
        screen,
        selector: node.target.join(' '),
        foreground: data.fgColor ?? '?',
        background: data.bgColor ?? '?',
        expected: data.expectedContrastRatio ?? '?',
        actual: data.contrastRatio === undefined ? '?' : `${data.contrastRatio}:1`,
      });
    }
  }
}

function writeReport(): void {
  const order = (s: string) => screens.indexOf(s);
  const rows = [...findings].sort((a, b) => order(a.screen) - order(b.screen) || a.selector.localeCompare(b.selector));
  const cell = (s: string) => s.replace(/\|/g, '\\|');
  const lines = [
    '# axe colour-contrast findings',
    '',
    'Written by `tests/e2e/axe.spec.ts` on every `pnpm e2e` run; do not edit by hand.',
    '',
    'axe-core runs with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` on every screen at 360×780.',
    'Every rule except `color-contrast` must pass. The `color-contrast` findings below are reported, not failed:',
    'they come from Godot 4.7’s own editor colours, which the app never alters to pass a ratio',
    '(decision #22, Tyler, 2026-10-13). They are a known deviation from WCAG 1.4.3; see also',
    '[`contrast-report.md`](contrast-report.md), which measures every theme pair directly.',
    '',
    'The card screens show the first new card of each family (daily budgets set to one each), so the run is repeatable.',
    '',
    `Screens audited: ${screens.join(', ')}.`,
    '',
    `Findings: ${rows.length}.`,
    '',
    '| Screen | Selector | Text | Background | Expected | Actual |',
    '|--------|----------|------|------------|----------|--------|',
    ...rows.map((r) => `| ${cell(r.screen)} | \`${cell(r.selector)}\` | ${r.foreground} | ${r.background} | ${r.expected} | ${r.actual} |`),
    '',
  ];
  writeFileSync('docs/axe-contrast.md', lines.join('\n'));
}

test('every screen passes axe (WCAG 2.2 AA) apart from reported contrast', async ({ page }) => {
  test.setTimeout(120_000);
  await gotoStart(page);
  await audit(page, 'start');

  await open(page, 'Settings');
  await audit(page, 'settings');
  await page.getByRole('button', { name: 'More: New cards per day' }).first().click();
  await page.locator('.gv-warning:not(:empty)').waitFor();
  await audit(page, 'settings with the warning');

  // Import, so the cards that follow are the same on every run: one new card per family.
  const file = exportFile({ settings: settings({ 'godot-api': { enabled: true, newPerDay: 1 }, gdscript: { enabled: true, newPerDay: 1 }, github: { enabled: true, newPerDay: 1 } }) });
  await page.locator('input[type="file"]').setInputFiles({ name: 'godot-vocabulary-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.getByRole('button', { name: 'Replace everything on this device' }).waitFor();
  await audit(page, 'settings (import choice)');
  await page.getByRole('button', { name: 'Replace everything on this device' }).click();
  await expect(page.locator('.gv-result')).toHaveText(/^Restored /);
  await backToStart(page);

  await startSession(page);
  const cards: string[] = [];
  for (let i = 0; i < 3; i++) {
    const family = (await page.locator('.gv-card__family').textContent())!;
    cards.push(family);
    await audit(page, `card (${family})`);
    await answer(page, 0);
    await audit(page, `card answered (${family})`);
    if (i < 2) await goNext(page);
  }
  expect(cards.sort()).toEqual(['GDScript', 'GitHub', 'Godot API']);
  await endSession(page);
  await audit(page, 'summary');
  await page.getByRole('button', { name: 'Done' }).click();
  await startReady(page);

  await open(page, 'Add card');
  await audit(page, 'add card');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.locator('.gv-errors li').first().waitFor();
  await audit(page, 'add card with errors');
  await backToStart(page);

  await open(page, 'About');
  await screenReady(page, 'About');
  await audit(page, 'about');

  // Fixed order for the report: the card screens by family name.
  const fixed = ['Godot API', 'GDScript', 'GitHub'];
  const cardScreens = screens.filter((s) => s.startsWith('card'));
  const rank = (s: string) => fixed.findIndex((f) => s.endsWith(`(${f})`)) * 2 + (s.startsWith('card answered') ? 1 : 0);
  const sortedCards = [...cardScreens].sort((a, b) => rank(a) - rank(b));
  const firstCard = screens.findIndex((s) => s.startsWith('card'));
  screens.splice(firstCard, cardScreens.length, ...sortedCards);
  writeReport();
});
