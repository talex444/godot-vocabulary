// Copies third-party files the app ships as they are (byte for byte) from data/ to public/, where the
// app loads them: the Octicons it shows, and the MIT licence files of Octicons, Primer and GitHub
// Desktop (like the font licences in public/fonts/). Run by `pnpm generate`, or alone with
// `node scripts/copy-shipped.mjs`; `tests/unit/shipped.test.ts` checks the copies match.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isMain, ROOT } from './lib/io.mjs';

/** [from under data/, to under public/] */
export const SHIPPED = [
  ['theme/github-desktop/octicons/git-branch-24.svg', 'octicons/git-branch-24.svg'],
  ['theme/github-desktop/octicons/arrow-left-24.svg', 'octicons/arrow-left-24.svg'],
  ['theme/github-desktop/LICENSE-octicons.txt', 'licenses/LICENSE-octicons.txt'],
  ['theme/github-desktop/LICENSE-primer-css.txt', 'licenses/LICENSE-primer-css.txt'],
  ['theme/github-desktop/LICENSE-github-desktop.txt', 'licenses/LICENSE-github-desktop.txt'],
];

export function copyShippedFiles() {
  for (const [from, to] of SHIPPED) {
    const target = join(ROOT, 'public', to);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(ROOT, 'data', from), target);
  }
  console.log(`shipped: ${SHIPPED.length} files copied to public/`);
}

if (isMain(import.meta.url)) copyShippedFiles();
