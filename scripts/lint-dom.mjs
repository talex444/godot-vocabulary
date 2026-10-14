// Fails when code under src/ parses a string as HTML: `innerHTML`, `outerHTML` or
// `insertAdjacentHTML`. Screens build the DOM with `el()` and `textContent` only, so text from a card,
// an imported file or device storage can never become markup. Run by `pnpm lint:css`.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = join(import.meta.dirname, '..');
const src = join(root, 'src');
const pattern = /\b(innerHTML|outerHTML)\s*(\+?=)(?!=)|\binsertAdjacentHTML\s*\(/;

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.(ts|js|mjs)$/.test(entry.name)) yield path;
  }
}

const hits = [];
for (const file of files(src)) {
  readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    const m = pattern.exec(line);
    if (m) hits.push(`${relative(root, file).split(sep).join('/')}:${index + 1}: ${m[0].trim()}`);
  });
}

if (hits.length > 0) {
  console.error(`HTML parsed from strings under src/ (build the DOM with el() and textContent instead):\n${hits.join('\n')}`);
  process.exit(1);
}
console.log('lint:dom: no innerHTML, outerHTML or insertAdjacentHTML under src/');
