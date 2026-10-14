import { writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  answer,
  answerShowing,
  backToStart,
  cardPanel,
  COURSE1,
  endSession,
  exportFile,
  goNext,
  gotoStart,
  LESSON0_TITLE,
  open,
  openArea,
  screenReady,
  settings,
  startReady,
  startSession,
} from './helpers';

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
    'The card screens show the first new card of each family (daily budgets set to one each), so the run is repeatable;',
    'the flipped card is the Godot API card’s second look, and the skip field opens on the card after it.',
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

  // The Godot area's session: one API card and one GDScript card.
  await startSession(page);
  const cards: string[] = [];
  for (let i = 0; i < 2; i++) {
    const family = (await page.locator('.gv-card__family').textContent())!;
    cards.push(family);
    await audit(page, `card (${family})`);
    await answer(page, 0);
    await audit(page, `card answered (${family})`);
    if (i < 1) await goNext(page);
  }
  expect(cards.sort()).toEqual(['GDScript', 'Godot API']);

  // Second looks: the API class card comes back flipped (name and icon asked, descriptions to pick).
  for (let i = 0; i < 6; i++) {
    await goNext(page);
    const flipped = (await cardPanel(page).getAttribute('data-direction')) === 'flipped';
    if (flipped && (await page.locator('.gv-card__family').textContent()) === 'Godot API') break;
    await answerShowing(page);
  }
  await expect(cardPanel(page)).toHaveAttribute('data-direction', 'flipped');
  await audit(page, 'flipped card (Godot API)');
  await answerShowing(page);
  await audit(page, 'flipped card answered (Godot API)');
  await goNext(page);
  await page.getByRole('button', { name: 'Skip this card' }).click();
  await audit(page, 'skip this card (reason field)');
  await page.getByLabel('Reason (optional)').fill('Testing the skip list');
  await page.getByRole('button', { name: 'Skip', exact: true }).click();

  await endSession(page);
  await audit(page, 'summary');
  await page.getByRole('button', { name: 'Done' }).click();
  await startReady(page);

  // The Git & GitHub area's session: its one GitHub card.
  await openArea(page, 'Git & GitHub');
  await startSession(page);
  await audit(page, 'card (GitHub)');
  await answer(page, 0);
  await audit(page, 'card answered (GitHub)');
  await endSession(page);
  await page.getByRole('button', { name: 'Done' }).click();
  await startReady(page);
  await openArea(page, 'Godot');

  await open(page, 'Settings');
  await audit(page, 'settings (skipped cards)');
  await backToStart(page);

  await open(page, 'Add card');
  await audit(page, 'add card');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.locator('.gv-errors li').first().waitFor();
  await audit(page, 'add card with errors');
  await backToStart(page);

  await open(page, 'About');
  await screenReady(page, 'About');
  await audit(page, 'about');
  await backToStart(page);

  await open(page, 'Courses');
  await audit(page, 'courses');
  await page.locator('[data-lesson-id="c1-l0"] button').click();
  await screenReady(page, LESSON0_TITLE);
  await audit(page, 'lesson');
  await page.locator('[data-question="pretest-0"] .gv-choice').first().click();
  await page.locator('[data-question="check-0"] .gv-choice').first().click();
  await page.getByRole('button', { name: 'Add the next node' }).click();
  await page.getByRole('textbox', { name: 'Missing word' }).fill('characterbody2d');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await page.locator('[data-kind="fix"] .gv-choice').first().click();
  await page.getByText('Check the case.').waitFor();
  await audit(page, 'lesson answered');

  // Lesson 3's code (a blank inside code, code fix lines) and lesson 5's course table, two cells shown.
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await screenReady(page, 'Courses');
  await page.locator('[data-lesson-id="c1-l3"] button').click();
  await screenReady(page, COURSE1.lessons[3]!.title);
  await page.locator('[data-kind="fix"] .gv-choice').first().click();
  await audit(page, 'lesson with code');
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await screenReady(page, 'Courses');
  await page.locator('[data-lesson-id="c1-l5"] button').click();
  await screenReady(page, COURSE1.lessons[5]!.title);
  await page.locator('.gv-reveal__cover').nth(0).click();
  await page.locator('.gv-reveal__cover').nth(4).click();
  await audit(page, 'lesson with the course table');

  // Fixed order for the report: the card screens by family name.
  const fixed = ['Godot API', 'GDScript', 'GitHub'];
  const cardScreens = screens.filter((s) => s.startsWith('card'));
  const rank = (s: string) => fixed.findIndex((f) => s.endsWith(`(${f})`)) * 2 + (s.startsWith('card answered') ? 1 : 0);
  const sortedCards = [...cardScreens].sort((a, b) => rank(a) - rank(b));
  const firstCard = screens.findIndex((s) => s.startsWith('card'));
  const others = screens.filter((s) => !s.startsWith('card'));
  others.splice(firstCard, 0, ...sortedCards);
  screens.splice(0, screens.length, ...others);
  writeReport();
});
