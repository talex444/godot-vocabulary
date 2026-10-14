import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { deck, enterArea, exportFile, gotoHome, importFromStart, overdueProgress, tile } from './helpers';

/*
 * Decision 66: the home read as values before colour. The page is desaturated (CSS `grayscale(1)` on
 * the root), a 90 px wide thumbnail is saved under docs/screenshots/ to look at, and the full-size
 * render is sampled for three clear values: the ground, the tiles, the text.
 */

const OUT = 'docs/screenshots';

/** CIE L* of an 8-bit grey. */
const lstar = (v: number) => {
  const c = v / 255;
  const y = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
};

async function values(page: Page, name: string): Promise<{ ground: number; tile: number; text: number }> {
  await page.evaluate(() => (document.documentElement.style.filter = 'grayscale(1)'));
  const shot = await page.screenshot();
  const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => data[(Math.round(y) * info.width + Math.round(x)) * info.channels]!;
  const scale = info.width / page.viewportSize()!.width;
  const box = (await tile(page, 'Godot').boundingBox())!;
  const label = (await tile(page, 'Godot').locator('.gv-tile__label').boundingBox())!;
  let text = 0;
  for (let y = label.y; y < label.y + label.height; y++) for (let x = label.x; x < label.x + label.width; x++) text = Math.max(text, at(x * scale, y * scale));
  // The ground at the bottom-left gutter, away from the glow; the tile in its left padding.
  const ground = at(4 * scale, (page.viewportSize()!.height - 4) * scale);
  const fill = at((box.x + 8) * scale, (box.y + box.height / 2) * scale);

  mkdirSync(OUT, { recursive: true });
  const thumb = await sharp(shot).resize({ width: 90 }).png().toBuffer();
  const path = `${OUT}/home-greyscale-${name}.png`;
  // Rewritten only when the pixels change, so a run that changes nothing leaves the tree clean.
  const same = existsSync(path) && (await sharp(path).raw().toBuffer()).equals(await sharp(thumb).raw().toBuffer());
  if (!same) writeFileSync(path, thumb);
  return { ground: lstar(ground), tile: lstar(fill), text: lstar(text) };
}

const threeValues = (v: { ground: number; tile: number; text: number }) => {
  expect(v.tile - v.ground, `tile L* ${v.tile.toFixed(1)} over ground ${v.ground.toFixed(1)}`).toBeGreaterThanOrEqual(10);
  expect(v.text - v.tile, `text L* ${v.text.toFixed(1)} over tile ${v.tile.toFixed(1)}`).toBeGreaterThanOrEqual(50);
};

test('greyscale: the fresh home shows three clear values (ground, tiles, text)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoHome(page);
  threeValues(await values(page, 'fresh'));
});

test('greyscale: the home with both areas ready shows three clear values', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoHome(page);
  await enterArea(page, 'Godot');
  const progress = [...deck('godot-api').slice(0, 12), ...deck('github').slice(0, 3)].map((c) => overdueProgress(c));
  await importFromStart(page, exportFile({ progress }));
  await gotoHome(page);
  threeValues(await values(page, 'both-ready'));
});
