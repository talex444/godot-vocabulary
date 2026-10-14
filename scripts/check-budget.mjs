// The first-load budget (decision 55): what a first visit downloads before the home page shows, in
// raw bytes on disk, must stay at or under 1,000,000 bytes, and no deck or course may be part of it
// (each area's deck and courses load when the area opens). Run by `pnpm build` after `vite build`.
//
// Counted: index.html, every local file it references (the entry script and style, the service
// worker's registration, the web manifest, the favicon), and the entry's static-import closure from
// Vite's build manifest (`imports` and `css`, followed recursively; `dynamicImports` are left out:
// they load on demand). `--limit <bytes>` overrides the limit (to see the check fail).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/io.mjs';

const DIST = join(ROOT, 'dist');
const LIMIT = 1_000_000;
const CONTENT = /(^|\/)src\/data\/(cards\.[\w-]+\.json|courses\/course-[\w-]+\.json)$/;

const at = process.argv.indexOf('--limit');
const limit = at > 0 ? Number(process.argv[at + 1]) : LIMIT;

const manifestPath = join(DIST, '.vite', 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('check-budget: dist/.vite/manifest.json is missing; run vite build with build.manifest on.');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const files = new Map(); // dist path → why it is counted
const problems = [];

// index.html and the local files it names (src/href that are not external and not the page itself).
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
files.set('index.html', 'the page');
for (const [, url] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  if (/^[a-z]+:/i.test(url)) continue;
  // The web build's base is /godot-vocabulary/; the Android build's is ./.
  const path = url.replace(/^(\/godot-vocabulary\/|\.\/|\/)/, '');
  if (existsSync(join(DIST, path))) files.set(path, 'named by index.html');
}

// The entry's static closure.
const entries = Object.entries(manifest).filter(([, chunk]) => chunk.isEntry);
const seen = new Set();
const visit = (key) => {
  if (seen.has(key)) return;
  seen.add(key);
  const chunk = manifest[key];
  if (!chunk) return;
  if (CONTENT.test(chunk.src ?? key)) problems.push(`${chunk.src ?? key} (${chunk.file}) is in the first load: decks and courses must load with their area`);
  files.set(chunk.file, `static import of ${chunk.src ?? key}`);
  for (const css of chunk.css ?? []) files.set(css, `style of ${chunk.src ?? key}`);
  for (const next of chunk.imports ?? []) visit(next);
};
for (const [key] of entries) visit(key);

let total = 0;
const rows = [...files].map(([path, why]) => {
  const bytes = statSync(join(DIST, path)).size;
  total += bytes;
  return { path, bytes, why };
});
rows.sort((a, b) => b.bytes - a.bytes);
const width = Math.max(...rows.map((r) => r.path.length));
console.log('check-budget: the first load (raw bytes on disk)');
for (const r of rows) console.log(`  ${r.path.padEnd(width)}  ${String(r.bytes).padStart(9)}  ${r.why}`);
console.log(`  ${'total'.padEnd(width)}  ${String(total).padStart(9)}  limit ${limit.toLocaleString('en')}`);

if (total > limit) problems.push(`the first load is ${total.toLocaleString('en')} bytes, over the ${limit.toLocaleString('en')}-byte budget`);
if (problems.length > 0) {
  for (const p of problems) console.error(`check-budget: FAIL: ${p}`);
  process.exit(1);
}
console.log(`check-budget: ok, ${total.toLocaleString('en')} of ${limit.toLocaleString('en')} bytes`);
