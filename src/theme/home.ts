import type { ThemeTokens } from './tokens';

/**
 * The home page's own neutral theme (decision 49): dark, one grey ramp, no accent fills, the system
 * font (so the home needs no font file) and a 4 px corner like Godot's. Unlike the areas, it meets
 * WCAG 2.2 AA in full: `tests/unit/contrast.test.ts` fails the build if any pair it draws falls short.
 *
 * Ten greys, darkest first; every token below is one of them.
 *
 * | Grey | Hex | Role |
 * |------|-----|------|
 * | 0 | #161616 | the page (`--base-color`) |
 * | 1 | #1f1f1f | panels and tiles (`--dark-color-1`), code background |
 * | 2 | #2a2a2a | a hovered tile; the disabled secondary button |
 * | 3 | #3a3a3a | a pressed tile; inline code chips |
 * | 4 | #767676 | edges: tile borders, fields, switches; the secondary button's fill |
 * | 5 | #8c8c8c | the focus halo |
 * | 6 | #a6a6a6 | tertiary text (disabled, readonly) |
 * | 7 | #b8b8b8 | secondary text |
 * | 8 | #e6e6e6 | primary text; headings, links and the focus ring (in place of an accent) |
 * | 9 | #ffffff | text on the secondary button, field input, hover and pressed text |
 */

const G = ['#161616', '#1f1f1f', '#2a2a2a', '#3a3a3a', '#767676', '#8c8c8c', '#a6a6a6', '#b8b8b8', '#e6e6e6', '#ffffff'] as const;

/** The greys, darkest first (the contrast test reads them). */
export const HOME_GREYS: readonly string[] = G;

const [g0, g1, g2, g3, g4, g5, g6, g7, g8, g9] = G;

/** The three text roles. */
const PRIMARY = g8;
const SECONDARY = g7;
const TERTIARY = g6;

export function homeTokens(): ThemeTokens {
  return {
    '--base-color': g0,
    '--accent-color': PRIMARY,
    '--mono-color': g9,
    '--dark-color-1': g1,
    '--dark-color-2': g1,
    '--dark-color-3': g2,
    '--contrast-color-1': g4,
    '--contrast-color-2': g6,
    '--highlight-color': g5,
    '--highlight-disabled-color': g3,
    '--selection-color': g4,
    '--font-color': PRIMARY,
    '--font-secondary-color': SECONDARY,
    '--font-hover-color': g9,
    '--font-pressed-color': g9,
    '--font-focus-color': g9,
    '--font-disabled-color': TERTIARY,
    '--font-readonly-color': TERTIARY,
    '--success-color': PRIMARY,
    '--warning-color': PRIMARY,
    '--error-color': PRIMARY,
    '--code-background-color': g1,
    '--code-completion-background-color': g3,
    '--code-text-color': PRIMARY,
    '--code-line-number-color': SECONDARY,
    '--code-caret-color': PRIMARY,
    '--code-selection-color': g4,
    '--code-current-line-color': g2,
    '--code-code-folding-color': SECONDARY,
    '--code-symbol-color': PRIMARY,
    '--code-keyword-color': PRIMARY,
    '--code-control-flow-keyword-color': PRIMARY,
    '--code-base-type-color': PRIMARY,
    '--code-engine-type-color': PRIMARY,
    '--code-user-type-color': PRIMARY,
    '--code-comment-color': SECONDARY,
    '--code-doc-comment-color': SECONDARY,
    '--code-string-color': PRIMARY,
    '--code-string-placeholder-color': PRIMARY,
    '--code-number-color': PRIMARY,
    '--code-function-color': PRIMARY,
    '--code-member-variable-color': PRIMARY,
    '--code-gdscript-function-definition-color': PRIMARY,
    '--code-gdscript-global-function-color': PRIMARY,
    '--code-bookmark-color': PRIMARY,
    '--code-executing-line-color': PRIMARY,
    '--code-breakpoint-color': PRIMARY,
    '--corner-radius': '4px',
    '--font-ui': 'system-ui, sans-serif',
    '--font-code': 'ui-monospace, monospace',
    'color-scheme': 'dark',
  };
}
