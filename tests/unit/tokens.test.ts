import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AREAS } from '../../src/areas/registry';
import { githubTokens } from '../../src/theme/github-desktop';
import { HOME_GREYS, homeTokens } from '../../src/theme/home';
import { applyTokens, godotTokens, type ThemeTokens, type TokenRoot } from '../../src/theme/tokens';

// Done-criteria 61: one flat map per area, applied as one unit.

// Every area's map and the home page's (decision 49), which the app swaps in and out the same way.
const MAPS: [string, ThemeTokens][] = [...AREAS.map((area): [string, ThemeTokens] => [area.id, area.theme]), ['home', homeTokens()]];

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

/** Sass `lighten(c, n%)` (n > 0) / `darken(c, -n%)`: HSL lightness moved by n points, channels rounded. */
function sassLightness(hex: string, points: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d > 0) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const l2 = Math.min(1, Math.max(0, l + points / 100));
  const c = (1 - Math.abs(2 * l2 - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l2 - c / 2;
  const [r1, g1, b1] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return `#${[r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** An element stand-in:inline properties in write order, like `style.cssText`. */
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

  it('GitHub Desktop dark: the anchors from _dark.scss and the Primer palette', () => {
    const gh = githubTokens();
    expect(gh['--base-color']).toBe('#24292e'); // --background-color: $gray-900
    expect(gh['--accent-color']).toBe('#0366d6'); // $blue = $blue-500
    expect(gh['--font-color']).toBe('#f6f8fa'); // --text-color: $gray-100
    expect(gh['--font-secondary-color']).toBe('#959da5'); // --text-secondary-color: $gray-400
    expect(gh['--success-color']).toBe('#28a745'); // --color-new: $green
    expect(gh['--warning-color']).toBe('#dbab09'); // --color-modified: $yellow-700
    expect(gh['--error-color']).toBe('#d73a49'); // --color-deleted: $red
    expect(gh['--corner-radius']).toBe('6px');
    expect(gh['--font-ui']).toMatch(/^system-ui, sans-serif,/);
    expect(gh['--font-code']).toMatch(/^SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace,/);
    expect(gh['color-scheme']).toBe('dark');
  });

  it('GitHub Desktop dark: darken/lighten written as Sass computes them', () => {
    const gh = githubTokens();
    expect(gh['--dark-color-1']).toBe(sassLightness('#24292e', -3)); // --box-background-color
    expect(gh['--dark-color-3']).toBe(sassLightness('#24292e', 3)); // --box-alt-background-color
    expect(gh['--font-disabled-color']).toBe(sassLightness('#6a737d', -10)); // --text-secondary-color-muted
    expect(gh['--contrast-color-1']).toBe(sassLightness('#6a737d', 3)); // --box-border-contrast-color
  });

  it('the home theme: dark, one ramp of ten greys and nothing else, system font, 4 px corners', () => {
    const tokens = homeTokens();
    expect(HOME_GREYS).toHaveLength(10);
    for (const grey of HOME_GREYS) expect(grey).toMatch(/^#([0-9a-f]{2})\1\1$/);
    const colours = Object.entries(tokens).filter(([k]) => k.endsWith('-color')).map(([, v]) => v);
    expect(colours.filter((c) => !HOME_GREYS.includes(c))).toEqual([]);
    expect(tokens['--font-ui']).toBe('system-ui, sans-serif');
    expect(tokens['--corner-radius']).toBe('4px');
    expect(tokens['color-scheme']).toBe('dark');
  });

  it('keeps the Godot look: Inter, JetBrains Mono, dark controls', () => {
    const tokens = godotTokens();
    expect(tokens['--font-ui']).toBe("'Inter', system-ui, sans-serif");
    expect(tokens['--font-code']).toBe("'JetBrains Mono', ui-monospace, monospace");
    expect(tokens['color-scheme']).toBe('dark');
  });
});
