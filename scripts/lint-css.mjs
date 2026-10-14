// Fails when a colour literal appears in src/**/*.{css,ts} outside src/theme/*.ts (done-criteria 23).
// Every colour must come from an area's token map (src/theme/: Godot's derived from
// data/theme/godot-4.7-defaults.json, GitHub Desktop's from data/theme/github-desktop/) through the
// custom properties; stylesheets and screens hold none.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const root = join(import.meta.dirname, '..');
const src = join(root, 'src');
const themeDir = join('src', 'theme');
const allowed = (rel) => dirname(rel) === themeDir && rel.endsWith('.ts');
const patterns = [/#[0-9a-f]{3,8}\b/gi, /\brgba?\(/gi, /\bhsla?\(/gi];

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.(css|ts)$/.test(entry.name)) yield path;
  }
}

const hits = [];
for (const file of files(src)) {
  const rel = relative(root, file);
  if (allowed(rel)) continue;
  readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const m = pattern.exec(line);
      if (m) hits.push(`${rel.split(sep).join('/')}:${index + 1}: ${m[0]}`);
    }
  });
}

if (hits.length > 0) {
  console.error(`Colour literals outside src/theme/*.ts (use the --… properties instead):\n${hits.join('\n')}`);
  process.exit(1);
}
console.log('lint:css: no colour literals outside src/theme/*.ts');
