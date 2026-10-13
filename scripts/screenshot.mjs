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
const want = new Set(['card-api.png', 'card-code.png', 'card-answered.png']);
for (let i = 0; i < 80 && want.size > 0; i++) {
  await page.locator('.gv-choice:not([disabled])').first().waitFor();
  const family = await page.locator('.gv-card__family').textContent();
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
  await page.locator('.gv-choice').nth(i % 4).click();
  const next = page.getByRole('button', { name: /^(Next|See summary)$/ });
  await next.waitFor();
  if (want.has('card-answered.png') && (await page.locator('.gv-feedback__wrong').count()) > 0) {
    await shot('card-answered.png');
    want.delete('card-answered.png');
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
