// Captures the session screens at 360×780 (device scale 2, touch) from a running `pnpm preview`.
// Usage: pnpm build, then `pnpm preview --port 4173`, then `node scripts/screenshot.mjs [baseUrl]`.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4173/godot-vocabulary/';
const out = join(import.meta.dirname, '..', 'docs', 'screenshots');
mkdirSync(out, { recursive: true });

// Playwright's own Chromium when installed (`pnpm exec playwright install chromium`), else the system Edge.
const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'msedge' }));
const context = await browser.newContext({
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  serviceWorkers: 'block',
});
const page = await context.newPage();
const shot = (name) => page.screenshot({ path: join(out, name), fullPage: true });

// The app opens on the home page (1.3.0); on a fresh install its Godot tile opens Lesson 0 over the
// area page (1.3.3), and Back steps down to the page. Reduced motion, so no wipe is caught mid-way.
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.goto(base);
await page.getByRole('heading', { name: 'Areas', exact: true }).waitFor();
await shot('home.png');
await page.getByRole('button', { name: /^Godot,/ }).click();
await page.locator('.gv-lesson').waitFor();
await page.getByRole('button', { name: 'Back', exact: true }).click();
await page.getByRole('button', { name: 'Start' }).waitFor();
await page.evaluate(() => document.fonts.ready);
await shot('start.png');

await page.getByRole('button', { name: 'Start' }).click();
const want = new Set(['card-api.png', 'card-code.png', 'card-answered.png', 'card-answered-full.png', 'card-skip.png', 'card-flipped.png']);
for (let i = 0; i < 80 && want.size > 0; i++) {
  await page.locator('.gv-choice:not([disabled])').first().waitFor();
  const panel = page.locator('.gv-card');
  const id = await panel.getAttribute('data-card-id');
  const family = await page.locator('.gv-card__family').textContent();
  const kind = await page.locator('.gv-card .gv-heading').textContent();
  const flipped = (await panel.getAttribute('data-direction')) === 'flipped';
  const icons = await page.locator('.gv-choice img').count();
  const code = await page.locator('.gv-card .gv-code').count();
  if (want.has('card-api.png') && family === 'Godot API' && icons === 4) {
    await shot('card-api.png');
    want.delete('card-api.png');
  }
  if (want.has('card-code.png') && family === 'GDScript' && code > 0) {
    await shot('card-code.png');
    want.delete('card-code.png');
  }
  if (want.has('card-flipped.png') && flipped && family === 'Godot API' && kind === 'Class') {
    await shot('card-flipped.png');
    want.delete('card-flipped.png');
  }
  // The skip field on a GitHub card, then really skipped so Settings has one to list.
  if (want.has('card-skip.png') && family === 'GitHub' && !flipped) {
    await page.getByRole('button', { name: 'Skip this card' }).click();
    await page.getByLabel('Reason (optional)').fill('Two of these choices could both fit');
    await shot('card-skip.png');
    want.delete('card-skip.png');
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    continue;
  }
  // The card in card-api.png is answered right (full description and docs link); the next API card wrong.
  const fullShot = want.has('card-answered-full.png') && family === 'Godot API' && !flipped && !want.has('card-api.png');
  const wrongShot = !fullShot && want.has('card-answered.png') && !flipped && family === 'Godot API';
  const ids = await page.locator('.gv-choice').evaluateAll((nodes) => nodes.map((n) => n.dataset.cardId ?? ''));
  await page.locator('.gv-choice').nth(wrongShot ? ids.findIndex((x) => x !== id) : ids.indexOf(id)).click();
  const next = page.getByRole('button', { name: /^(Next|See summary)$/ });
  await next.waitFor();
  if (wrongShot) {
    await shot('card-answered.png');
    want.delete('card-answered.png');
  }
  if (fullShot) {
    await shot('card-answered-full.png');
    want.delete('card-answered-full.png');
  }
  if ((await next.textContent()) !== 'Next') break;
  await next.click();
}
if (want.size > 0) console.warn(`Not captured: ${[...want].join(', ')}`);

await page.getByRole('button', { name: 'End session' }).click();
await page.getByRole('heading', { name: 'Session done' }).waitFor();
await shot('summary.png');

const ready = async (heading) => {
  await page.getByRole('heading', { name: heading, exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
};
const backToStart = async () => {
  await page.getByRole('button', { name: 'Back', exact: true }).last().click();
  await page.getByRole('button', { name: 'Start' }).waitFor();
};

await page.getByRole('button', { name: 'Done' }).click();
await page.getByRole('button', { name: 'Settings' }).click();
await ready('Settings');
await shot('settings.png');
await page.locator('.gv-skipped').screenshot({ path: join(out, 'settings-skipped.png') });
await page.getByRole('button', { name: 'More: New cards per day' }).first().click();
await page.locator('.gv-warning:not(:empty)').waitFor();
await shot('settings-warning.png');
await page.getByRole('button', { name: 'Fewer: New cards per day' }).first().click();
await backToStart();

await page.getByRole('button', { name: 'Add card' }).click();
await ready('Add card');
await page.getByLabel('Family').selectOption('github');
await page.getByLabel('Question').fill('Replays your commits on top of another branch, one by one.');
await page.getByLabel('Right answer').fill('rebase');
await page.getByLabel('Wrong answer 1').fill('merge');
await page.getByLabel('Wrong answer 2').fill('cherry-pick');
await page.getByLabel('Wrong answer 3').fill('rebase');
await page.getByRole('button', { name: 'Save' }).click();
await page.locator('.gv-errors li').first().waitFor();
await shot('add-card-errors.png');
await page.getByLabel('Wrong answer 3').fill('squash');
await page.getByRole('button', { name: 'Save' }).click();
await page.getByRole('button', { name: 'Add another' }).click();
await ready('Add card');
await shot('add-card.png');
await backToStart();

await page.getByRole('button', { name: 'About' }).click();
await ready('About');
await shot('about.png');
await backToStart();

// Courses: the list, then lesson 0, 3 and 5 in phone-screen views (each page is one long scroll).
const view = (name) => page.screenshot({ path: join(out, name) });
const toTop = (locator) => locator.evaluate((n) => window.scrollTo(0, n.getBoundingClientRect().top + window.scrollY - 8));
await page.getByRole('button', { name: 'Courses' }).click();
await ready('Courses');
await shot('courses.png');
await page.locator('[data-lesson-id="c1-l0"] button').click();
await page.locator('[data-question="pretest-0"]').waitFor();
await page.evaluate(() => document.fonts.ready);
const pretest = page.locator('[data-question="pretest-0"]');
const pretestIds = await pretest.locator('.gv-choice').evaluateAll((nodes) => nodes.map((n) => n.dataset.cardId ?? ''));
await pretest.locator('.gv-choice').nth(pretestIds.indexOf(await pretest.getAttribute('data-card-id'))).click();
await page.evaluate(() => window.scrollTo(0, 0));
await view('lesson-top.png');
for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Add the next node' }).click();
await toTop(page.locator('.gv-drawing'));
await view('lesson-drawing.png');
const blankItem = page.locator('[data-kind="blank"]');
await blankItem.getByRole('textbox', { name: 'Missing word' }).fill('characterbody2d');
await blankItem.getByRole('button', { name: 'Check' }).click();
await toTop(blankItem);
await view('lesson-exercise.png');
await page.getByLabel('When a Godot game runs, it is made of …').fill('a tree of nodes, grouped into scenes and wired with signals.');
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.getByText('Saved on this device.').waitFor();
// The last error and the whole exit-ticket step, the page's bottom edge on the screen's.
await page.locator('[data-step="exit"]').evaluate((n) => window.scrollTo(0, n.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 8));
await view('lesson-end.png');

// Lesson 3: a code block with its chunk's check under it, and the typed blank inside code.
const openLesson = async (id) => {
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await ready('Courses');
  await page.locator(`[data-lesson-id="${id}"] button`).click();
  await page.locator('[data-question="pretest-0"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
};
await openLesson('c1-l3');
const frame = page.locator('[data-step="chunk-2"]');
await frame.locator('[data-question="check-2"] .gv-choice').first().click();
await toTop(frame.locator('pre.gv-code'));
await view('lesson-code.png');
const codeBlank = page.locator('[data-kind="blank"]');
await codeBlank.getByRole('textbox', { name: 'Missing word' }).fill('Rotation');
await codeBlank.getByRole('button', { name: 'Check' }).click();
await toTop(codeBlank);
await view('lesson-blank-code.png');

// Lesson 5's course table with two cells shown.
await openLesson('c1-l5');
const table = page.locator('[data-reveal-table]');
await table.getByRole('button', { name: /draws on screen \(Node3D\)/ }).click();
await table.getByRole('button', { name: /has a position \(Node3D\)/ }).click();
await toTop(table.locator('.gv-reveal__row').nth(1));
await view('course-table.png');

await browser.close();
console.log(`Screenshots written to ${out}`);
