import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Writes `data` as two-space JSON with a trailing newline, LF line endings, path relative to the repo root. */
export function writeJson(relPath, data) {
  const file = join(ROOT, relPath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

/** True when the module at `url` is the script node was started with. */
export function isMain(url) {
  return Boolean(process.argv[1]) && url === pathToFileURL(resolve(process.argv[1])).href;
}
