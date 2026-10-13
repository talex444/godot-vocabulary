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

await page.goto(base);
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

await browser.close();
console.log(`Screenshots written to ${out}`);
