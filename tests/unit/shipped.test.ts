import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHIPPED } from '../../scripts/copy-shipped.mjs';

// Decision 48: third-party files ship as they are. Each copy under public/ is its source under data/, byte for byte.

const root = new URL('../../', import.meta.url);

describe('files shipped as they are', () => {
  it.each(SHIPPED as [string, string][])('data/%s → public/%s', (from, to) => {
    expect(readFileSync(new URL(`public/${to}`, root)).equals(readFileSync(new URL(`data/${from}`, root)))).toBe(true);
  });
});
