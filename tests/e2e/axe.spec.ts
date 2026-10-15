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
  enterArea,
  exportFile,
  goNext,
  gotoHome,
  homeReady,
  LESSON0,
  LESSON0_TITLE,
  LESSON1,
  open,
  openArea,
  screenReady,
  type AreaLabel,
  settings,
  startReady,
  startSession,
} from './helpers';

// Done-criteria 27, 66, 70: axe-core with the WCAG 2.2 AA tags on every screen, in each area's theme
// and the home page's. On the home page every rule passes, contrast included. Inside an area every
// rule but `color-contrast` must pass; contrast is reported, not failed (decisions 22 and 54: the
// tool's colours win): findings go to docs/axe-contrast.md, one section per theme, which this spec rewrites.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

interface Finding {
  screen: string;
  selector: string;
  foreground: string;
  background: string;
  expected: string;
  actual: string;
}

type Theme = 'Home' | AreaLabel;

/** Screens and findings per theme, in the order audited. */
const runs: Record<Theme, { screens: string[]; findings: Finding[] }> = {
  Home: { screens: [], findings: [] },
  Godot: { screens: [], findings: [] },
  'Git & GitHub': { screens: [], findings: [] },
};
/** The theme the page wears now. */
let area: Theme = 'Home';

async function enter(page: Page, label: AreaLabel): Promise<void> {
  await openArea(page, label);
  area = label;
}

/**
 * Every WCAG 2.2 AA rule must pass. In an area `color-contrast` is reported, not failed (the tool's
 * colours win); on the home page and the screens it opens in its theme it fails like every other rule.
 */
async function audit(page: Page, screen: string): Promise<void> {
  const { screens, findings } = runs[area];
  screens.push(screen);
  const builder = new AxeBuilder({ page }).withTags(TAGS);
  if (area !== 'Home') builder.disableRules(['color-contrast']);
  const strict = await builder.analyze();
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
  const cell = (s: string) => s.replace(/\|/g, '\\|');
  const lines = [
    '# axe colour-contrast findings',
    '',
    'Written by `tests/e2e/axe.spec.ts` on every `pnpm e2e` run; do not edit by hand.',
    '',
    'axe-core runs with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` on every screen at 360×780,',
    'in the theme of the area the screen belongs to. On the home page (and About opened from it, in the home',
    'theme) every rule must pass, `color-contrast` included, so the Home section below must stay empty. Inside an',
    'area every rule except `color-contrast` must pass; its findings are reported, not failed: they come from the',
    'tool’s own colours (Godot 4.7’s editor theme in the Godot area, GitHub Desktop’s dark theme in Git & GitHub),',
    'which the app never alters to pass a ratio (decisions 22 and 54). They are a known deviation from WCAG 1.4.3;',
    'see also [`contrast-report.md`](contrast-report.md), which measures every theme pair directly.',
    '',
    'The card screens show the first new card of each family (daily budgets set to one each), so the run is repeatable;',
    'the flipped card is the Godot API card’s second look, and the skip field opens on the card after it. The',
    'GitHub card is answered right, so its feedback is the same on every run.',
  ];
  for (const label of Object.keys(runs) as Theme[]) {
    const { screens, findings } = runs[label];
    const order = (s: string) => screens.indexOf(s);
    const rows = [...findings].sort((a, b) => order(a.screen) - order(b.screen) || a.selector.localeCompare(b.selector));
    lines.push(
      '',
      `## ${label}`,
      '',
      `Screens audited: ${screens.join(', ')}.`,
      '',
      `Findings: ${rows.length}.`,
      '',
      '| Screen | Selector | Text | Background | Expected | Actual |',
      '|--------|----------|------|------------|----------|--------|',
      ...rows.map((r) => `| ${cell(r.screen)} | \`${cell(r.selector)}\` | ${r.foreground} | ${r.background} | ${r.expected} | ${r.actual} |`),
    );
  }
  lines.push('');
  writeFileSync('docs/axe-contrast.md', lines.join('\n'));
}

test('every screen passes axe (WCAG 2.2 AA) apart from reported contrast inside the areas', async ({ page }) => {
  test.setTimeout(120_000);
  // The home page and About opened from it: every rule, contrast included.
  await gotoHome(page);
  await audit(page, 'home');
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await screenReady(page, 'About');
  await audit(page, 'about');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await homeReady(page);
  await enterArea(page, 'Godot');
  area = 'Godot';
  await audit(page, 'start');

  await open(page, 'Settings');
  await audit(page, 'settings');
  await page.getByRole('button', { name: 'More: New cards per day' }).first().click();
  await page.locator('.gv-warning:not(:empty)').waitFor();
  await audit(page, 'settings with the warning');

  // Import, so the cards that follow are the same on every run: one new card per family.
  const one = { enabled: true, newPerDay: 1 };
  const file = exportFile({ settings: settings({ 'godot-editor': one, 'godot-api': one, gdscript: one, github: one }) });
  await page.locator('input[type="file"]').setInputFiles({ name: 'godot-vocabulary-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.getByRole('button', { name: 'Replace everything on this device' }).waitFor();
  await audit(page, 'settings (import choice)');
  await page.getByRole('button', { name: 'Replace everything on this device' }).click();
  await expect(page.locator('.gv-result')).toHaveText(/^Restored /);
  await backToStart(page);

  // The Godot area's session: one editor card, one API card and one GDScript card.
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
  expect(cards.sort()).toEqual(['GDScript', 'Godot API', 'Godot editor']);

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

  // The Git & GitHub area in its own theme: start, its one GitHub card (answered right), summary, courses.
  await enter(page, 'Git & GitHub');
  await audit(page, 'start');
  await startSession(page);
  await audit(page, 'card (GitHub)');
  await answerShowing(page);
  await audit(page, 'card answered (GitHub)');
  await endSession(page);
  await audit(page, 'summary');
  await page.getByRole('button', { name: 'Done' }).click();
  await startReady(page, 'Git & GitHub');
  await open(page, 'Courses');
  await audit(page, 'courses');
  await backToStart(page);
  await open(page, 'Settings');
  await audit(page, 'settings');
  await backToStart(page);
  await open(page, 'Add card');
  await audit(page, 'add card');
  await backToStart(page);
  await open(page, 'About');
  await audit(page, 'about');
  await backToStart(page);
  await enter(page, 'Godot');

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
  // Lesson 0, the term lesson: a typed check missed once, a picked check, a recall, the blank and the fix.
  await page.locator(`[data-lesson-id="${LESSON0.id}"] button`).click();
  await screenReady(page, LESSON0_TITLE);
  await audit(page, 'lesson');
  await page.locator('[data-question="pretest-0"] .gv-choice').first().click();
  const typed = page.locator('[data-question="term-0"]');
  await typed.getByRole('textbox', { name: 'Name' }).fill('scene view');
  await typed.getByRole('button', { name: 'Check', exact: true }).click();
  await page.locator('[data-question="term-1"] .gv-choice').first().click();
  await page.locator('[data-question="recall-0"] .gv-choice').first().click();
  await page.getByRole('textbox', { name: 'Missing word' }).fill('Inspektor');
  await page.locator('[data-kind="blank"]').getByRole('button', { name: 'Check', exact: true }).click();
  await page.locator('[data-kind="fix"] .gv-choice').first().click();
  await typed.getByText('Not that name. One more try.').waitFor();
  await audit(page, 'lesson answered');
  // Finished: the status line and its two buttons in the Finish button's place (decision 69c).
  await page.getByRole('button', { name: /^Finish lesson/ }).click();
  await page.locator('.gv-finish__status:not(:empty)').waitFor();
  await audit(page, 'lesson finished');

  // Lesson 1, the key concepts as terms: class names with their icons picked, a typed class name with the
  // case hint, the one-node drawing and a drawing part built, the typed blank, the fix.
  await page.getByRole('button', { name: 'Next: Lesson 1' }).click();
  await screenReady(page, LESSON1.title);
  await audit(page, 'lesson 1');
  await page.locator('[data-question="term-4"] .gv-choice').first().click();
  const typedClass = page.locator('[data-question="term-1"]');
  await typedClass.getByRole('textbox', { name: 'Name' }).fill('scenetree');
  await typedClass.getByRole('button', { name: 'Check', exact: true }).click();
  await page.locator('[data-step="term-5"]').getByRole('button', { name: 'Add the next node' }).click();
  await page.locator('[data-question="recall-2"] .gv-choice').first().click();
  await page.locator('[data-kind="blank"]').getByRole('textbox', { name: 'Missing word' }).fill('characterbody2d');
  await page.locator('[data-kind="blank"]').getByRole('button', { name: 'Check', exact: true }).click();
  await page.locator('[data-kind="fix"] .gv-choice').first().click();
  await typedClass.getByText('Check the case.').waitFor();
  await audit(page, 'lesson 1 answered');

  // Lesson 4's code (a blank inside code, code fix lines) and lesson 6's course table, two cells shown.
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await screenReady(page, 'Courses');
  await page.locator('[data-lesson-id="c1-l3"] button').click();
  await screenReady(page, COURSE1.lessons[4]!.title);
  await page.locator('[data-kind="fix"] .gv-choice').first().click();
  await audit(page, 'lesson with code');
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await screenReady(page, 'Courses');
  await page.locator('[data-lesson-id="c1-l5"] button').click();
  await screenReady(page, COURSE1.lessons[6]!.title);
  await page.locator('.gv-reveal__cover').nth(0).click();
  await page.locator('.gv-reveal__cover').nth(4).click();
  await audit(page, 'lesson with the course table');

  // Fixed order for the report: the Godot card screens by family name.
  const { screens } = runs.Godot;
  const fixed = ['Godot editor', 'Godot API', 'GDScript'];
  const cardScreens = screens.filter((s) => s.startsWith('card'));
  const rank = (s: string) => fixed.findIndex((f) => s.endsWith(`(${f})`)) * 2 + (s.startsWith('card answered') ? 1 : 0);
  const sortedCards = [...cardScreens].sort((a, b) => rank(a) - rank(b));
  const firstCard = screens.findIndex((s) => s.startsWith('card'));
  const others = screens.filter((s) => !s.startsWith('card'));
  others.splice(firstCard, 0, ...sortedCards);
  screens.splice(0, screens.length, ...others);
  writeReport();
  // Done-criteria 70: the home theme's section of the report is empty.
  expect(runs.Home.screens).toEqual(['home', 'about']);
  expect(runs.Home.findings).toEqual([]);
});
