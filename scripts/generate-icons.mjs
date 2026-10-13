// The app's own glyph (not the Godot logo): a rounded card with an accent-colour check mark.
// Colours come from data/theme/godot-4.7-defaults.json. Writes public/app-icon.svg, -192.png, -512.png,
// and the Android package's launcher icons (legacy, round and adaptive foreground) at every density.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ROOT, isMain } from './lib/io.mjs';

function colours() {
  const theme = JSON.parse(readFileSync(join(ROOT, 'data/theme/godot-4.7-defaults.json'), 'utf8'));
  const { base_color: base, accent_color: accent } = theme.interface;
  return { base, accent, card: theme.script_editor.completion_background_color, edge: theme.derived.contrast_color_1 };
}

function glyph({ accent, card, edge }) {
  return `<rect x="136" y="104" width="240" height="304" rx="28" fill="${card}" stroke="${edge}" stroke-width="8"/>
  <path d="M190 262 l50 50 l94 -110" fill="none" stroke="${accent}" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export function iconSvg() {
  const c = colours();
  // Full-bleed background so the icon also works as a maskable icon (content inside the 80% safe zone).
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${c.base}"/>
  ${glyph(c)}
</svg>
`;
}

/** The glyph alone on a transparent 108 dp canvas, drawn 72 dp wide so its corners stay inside the 66 dp mask circle. */
function foregroundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-128 -128 768 768">
  ${glyph(colours())}
</svg>
`;
}

function roundSvg() {
  const c = colours();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <circle cx="256" cy="256" r="256" fill="${c.base}"/>
  ${glyph(c)}
</svg>
`;
}

/** Launcher icon size in px per density bucket (48 dp; the adaptive foreground is 108 dp). */
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function png(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
}

export async function generateIcons() {
  const svg = iconSvg();
  writeFileSync(join(ROOT, 'public/app-icon.svg'), svg);
  for (const size of [192, 512]) await png(svg, size, join(ROOT, `public/app-icon-${size}.png`));

  const res = join(ROOT, 'android/app/src/main/res');
  for (const [bucket, scale] of Object.entries(DENSITIES)) {
    const dir = join(res, `mipmap-${bucket}`);
    await png(svg, 48 * scale, join(dir, 'ic_launcher.png'));
    await png(roundSvg(), 48 * scale, join(dir, 'ic_launcher_round.png'));
    await png(foregroundSvg(), 108 * scale, join(dir, 'ic_launcher_foreground.png'));
  }
  writeFileSync(
    join(res, 'values/ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${colours().base.toUpperCase()}</color>\n</resources>\n`,
  );
  console.log('icons: public/app-icon.svg, app-icon-192.png, app-icon-512.png, android launcher icons');
}

if (isMain(import.meta.url)) await generateIcons();
