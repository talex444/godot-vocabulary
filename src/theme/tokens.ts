import { themeProperties } from './derive';

/**
 * One area's look as a flat map: every custom property the stylesheets read (`--base-color`,
 * `--code-…`, `--corner-radius`, `--font-ui`, `--font-code`) plus `color-scheme`. Every area's map
 * has the same key set (`tests/unit/tokens.test.ts`), so applying one map overwrites every entry the
 * previous one wrote and nothing is left behind.
 */
export type ThemeTokens = Readonly<Record<string, string>>;

/** The part of an element `applyTokens` touches (a real `HTMLElement` in the app, a stand-in in tests). */
export interface TokenRoot {
  style: { setProperty(name: string, value: string): void };
  setAttribute(name: string, value: string): void;
}

/**
 * Writes every entry of `tokens` as an inline property on `root` and names the map in `data-theme`.
 * No state is kept here: the element itself says which map it wears, and since every map has the
 * same keys, writing the new map replaces the old one entry for entry.
 */
export function applyTokens(root: TokenRoot, tokens: ThemeTokens, name: string): void {
  for (const [property, value] of Object.entries(tokens)) root.style.setProperty(property, value);
  root.setAttribute('data-theme', name);
}

/**
 * The home page's own roles, which no area draws: an area's map writes them as `unset`, so the key
 * sets stay identical and the home's value never lingers inside an area.
 */
export const HOME_ONLY: ThemeTokens = {
  '--home-action-color': 'unset',
  '--home-tile-color': 'unset',
  '--home-tile-hover-color': 'unset',
  '--home-tile-pressed-color': 'unset',
  '--home-quiet-color': 'unset',
  '--home-glow-color': 'unset',
  '--home-glow-strength': 'unset',
  '--home-glow-reach': 'unset',
};

/** The Godot area: the derived 4.7 dark theme, Inter and JetBrains Mono, dark form controls. */
export function godotTokens(): ThemeTokens {
  return {
    ...themeProperties(),
    ...HOME_ONLY,
    '--font-ui': "'Inter', system-ui, sans-serif",
    '--font-code': "'JetBrains Mono', ui-monospace, monospace",
    'color-scheme': 'dark',
  };
}
