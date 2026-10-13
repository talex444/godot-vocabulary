// The app's own glyph (not the Godot logo): a rounded card with an accent-colour check mark.
// Colours come from data/theme/godot-4.7-defaults.json. Writes public/app-icon.svg, -192.png, -512.png.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ROOT, isMain } from './lib/io.mjs';

export function iconSvg() {
  const theme = JSON.parse(readFileSync(join(ROOT, 'data/theme/godot-4.7-defaults.json'), 'utf8'));
  const { base_color: base, accent_color: accent } = theme.interface;
  const card = theme.script_editor.completion_background_color;
  const edge = theme.derived.contrast_color_1;
  // Full-bleed background so the icon also works as a maskable icon (content inside the 80% safe zone).
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${base}"/>
  <rect x="136" y="104" width="240" height="304" rx="28" fill="${card}" stroke="${edge}" stroke-width="8"/>
  <path d="M190 262 l50 50 l94 -110" fill="none" stroke="${accent}" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
}

export async function generateIcons() {
  const svg = iconSvg();
  writeFileSync(join(ROOT, 'public/app-icon.svg'), svg);
  for (const size of [192, 512]) {
    await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(join(ROOT, `public/app-icon-${size}.png`));
  }
  console.log('icons: public/app-icon.svg, app-icon-192.png, app-icon-512.png');
}

if (isMain(import.meta.url)) await generateIcons();
