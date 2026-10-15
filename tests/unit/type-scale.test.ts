import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Decision 68: two sizes and nothing else, 19 px titles and 16 px text, before the phone's multiplier.
// Every size in the stylesheets is one of the two tokens (or 1em, inline code at its line's size), so
// no third size can come back.

const read = (path: string) => readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8');
const STYLESHEETS = ['ui/kit.css', 'ui/screens/screens.css'];
const ALLOWED = ['var(--title-size)', 'var(--text-size)', '1em'];

/** Every `font-size` value in a stylesheet, comments left out. */
const fontSizes = (css: string) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/font-size:\s*([^;}]+)/g)].map((m) => m[1]!.trim());

/** Every TypeScript file under src/, for inline styles. */
function sources(dir: URL): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sources(new URL(`${entry.name}/`, dir)) : entry.name.endsWith('.ts') ? [readFileSync(new URL(entry.name, dir), 'utf8')] : [],
  );
}

describe('the type scale (decision 68)', () => {
  it('the two tokens sit on :root next to the gutter: 19 px titles, 16 px text', () => {
    const root = /:root \{([^}]*)\}/.exec(read('ui/kit.css'))![1]!;
    expect(root).toContain('--gutter: 16px;');
    expect(root).toContain('--title-size: 1.1875rem;');
    expect(root).toContain('--text-size: 1rem;');
    expect(1.1875 * 16).toBe(19);
  });

  it.each(STYLESHEETS)('every font-size in %s is a token or 1em', (path) => {
    const sizes = fontSizes(read(path));
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.filter((s) => !ALLOWED.includes(s))).toEqual([]);
  });

  it('no font shorthand carries a size', () => {
    for (const path of STYLESHEETS) {
      const shorthands = [...read(path).matchAll(/(?<![-\w])font:\s*([^;}]+)/g)].map((m) => m[1]!.trim());
      expect(shorthands.filter((s) => s !== 'inherit'), path).toEqual([]);
    }
  });

  it('no script sets a font size inline', () => {
    const scripts = sources(new URL('../../src/', import.meta.url));
    expect(scripts.length).toBeGreaterThan(10);
    expect(scripts.filter((s) => /fontSize|font-size/.test(s))).toEqual([]);
  });

  it('the titles are the title size: app title, tile names, panel, lesson and step headings, the stepper glyphs', () => {
    const css = `${read('ui/kit.css')}\n${read('ui/screens/screens.css')}`;
    for (const selector of ['.gv-app-name', '.gv-tile__label', '.gv-heading', '.gv-step h3', '.gv-stepper .gv-button']) {
      const block = new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`).exec(css);
      expect(block?.[2], selector).toContain('font-size: var(--title-size);');
    }
  });

  it('the tile’s count and figure are text size, never larger than the name', () => {
    const css = read('ui/screens/screens.css');
    for (const selector of ['.gv-tile__figure', '.gv-tile__lessons']) {
      const block = new RegExp(`\\n\\${selector} \\{([^}]*)\\}`).exec(css);
      expect(block?.[1], selector).toContain('font-size: var(--text-size);');
    }
  });
});
