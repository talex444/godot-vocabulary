import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AREAS } from '../../src/areas/registry';
import { applyTokens, godotTokens, type ThemeTokens, type TokenRoot } from '../../src/theme/tokens';

// Done-criteria 61: one flat map per area, applied as one unit.

const MAPS: [string, ThemeTokens][] = AREAS.map((area) => [area.id, area.theme]);

const SRC = join(import.meta.dirname, '..', '..', 'src');

function* files(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.(css|ts)$/.test(entry.name)) yield path;
  }
}

/** Every `var(--name)` the sources read without a fallback, minus the names a stylesheet declares itself. */
function usedTokens(): Set<string> {
  const used = new Set<string>();
  const declared = new Set<string>();
  for (const file of files(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/var\((--[\w-]+)\s*\)/g)) used.add(m[1]!);
    if (file.endsWith('.css')) for (const m of text.matchAll(/^\s*(--[\w-]+)\s*:/gm)) declared.add(m[1]!);
  }
  return new Set([...used].filter((name) => !declared.has(name)));
}

/** An element stand-in: inline properties in write order, like `style.cssText`. */
function fakeRoot(): TokenRoot & { css: () => string; attrs: Map<string, string> } {
  const props = new Map<string, string>();
  const attrs = new Map<string, string>();
  return {
    style: { setProperty: (name, value) => void props.set(name, value) },
    setAttribute: (name, value) => void attrs.set(name, value),
    attrs,
    css: () => [...props].map(([k, v]) => `${k}: ${v};`).join(' '),
  };
}

describe('theme token maps', () => {
  it('define every custom property the sources read, in every area', () => {
    const used = usedTokens();
    expect(used.size).toBeGreaterThan(20);
    for (const [name, tokens] of MAPS) {
      const missing = [...used].filter((t) => !(t in tokens));
      expect(missing, `${name} is missing`).toEqual([]);
    }
  });

  it('have one identical key set, fonts and color-scheme included', () => {
    const [, first] = MAPS[0]!;
    expect(Object.keys(first)).toEqual(expect.arrayContaining(['--font-ui', '--font-code', 'color-scheme']));
    for (const [name, tokens] of MAPS) expect(Object.keys(tokens).sort(), name).toEqual(Object.keys(first).sort());
  });

  it('applying one map after another leaves exactly the last one', () => {
    const fresh = fakeRoot();
    applyTokens(fresh, godotTokens(), 'godot');
    const root = fakeRoot();
    for (const [name, tokens] of [...MAPS, ...MAPS.slice().reverse(), MAPS[0]!]) applyTokens(root, tokens, name);
    expect(root.css()).toBe(fresh.css());
    expect(root.attrs.get('data-theme')).toBe('godot');
  });

  it('keeps the Godot look: Inter, JetBrains Mono, dark controls', () => {
    const tokens = godotTokens();
    expect(tokens['--font-ui']).toBe("'Inter', system-ui, sans-serif");
    expect(tokens['--font-code']).toBe("'JetBrains Mono', ui-monospace, monospace");
    expect(tokens['color-scheme']).toBe('dark');
  });
});
