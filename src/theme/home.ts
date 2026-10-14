import type { ThemeTokens } from './tokens';

/**
 * The home page's own theme (decisions 49, 64): dark, one grey ramp with one warm colour, no accent
 * fills, the system font (so the home needs no font file) and a 6 px corner. Unlike the areas, it
 * meets WCAG 2.2 AA in full: `tests/unit/contrast.test.ts` fails the build if any pair it draws falls
 * short.
 *
 * Ten greys, darkest first, in CIELAB LCh with a slight warm tint toward the action colour's hue
 * (chroma 1.6, hue 70°). The four surfaces step evenly by 5.5 L* from L* 7, the six inks by 10.4 L*
 * from L* 48 up to white; the gap between them is where the roles need it (tertiary text holds 4.5:1
 * on the pressed tile, white holds 4.5:1 on the secondary button). Every grey token is one of them.
 *
 * | Grey | Hex | L* | Role |
 * |------|-----|---:|------|
 * | 0 | #171513 | 6.9 | the page (`--base-color`) |
 * | 1 | #22201e | 12.4 | panels and tiles (`--dark-color-1`), code background |
 * | 2 | #2e2c2a | 18.1 | a hovered tile; the disabled secondary button |
 * | 3 | #3a3836 | 23.7 | a pressed tile; inline code chips |
 * | 4 | #74726f | 48.1 | edges of fields and switches; the secondary button's fill |
 * | 5 | #8f8c8a | 58.4 | the focus halo |
 * | 6 | #aaa7a5 | 68.7 | tertiary text (disabled, readonly); tile borders |
 * | 7 | #c6c4c1 | 79.2 | secondary text; the tile icons and chevron |
 * | 8 | #e4e1de | 89.7 | primary text; headings, links and the focus ring (in place of an accent) |
 * | 9 | #ffffff | 100 | text on the secondary button, field input, hover and pressed text |
 *
 * The one colour, `--home-action-color` #d59526 (HSL 38° 70% 49%), means "do this next" and nothing
 * else (decision 64). It is the darkest amber at that hue and saturation that holds 4.5:1 as text on
 * all four surfaces: 7.07:1 on the page, 6.31:1 on a tile, 5.40:1 on a hovered tile, 4.53:1 on a
 * pressed one.
 *
 * Two static corner glows (decision 65), painted by screens.css from three tokens:
 * - `--home-glow-color` #e8e1db: LCh 89.9 / 4.0 / 70.5°, a warm light in the greys' own hue with a
 *   little more chroma than the ramp's 1.6 to 1.9. Never the amber (one colour, one meaning).
 * - `--home-glow-strength` 5 %: the glow's alpha at its corner, composited over the page. The largest
 *   whole percent whose peak stays at or below the tile (g1, L* 12.4), so the tiles remain the lightest
 *   thing on the page: page L* 6.9; 5 % gives #211f1d, L* 11.9 (at or below 12.4); 6 % would give
 *   #24211f, L* 13.0 (above the tile). The bottom-left glow mixes three quarters of it (3.75 %,
 *   #1f1d1a, L* 10.9). `tests/unit/contrast.test.ts` measures every page-level pair on the 5 % peak.
 * - `--home-glow-reach` 30vmax: each glow fades out a quarter to a third of the screen from its
 *   corner (Tyler's bound), about 230 px on a 360×780 phone.
 */

const G = ['#171513', '#22201e', '#2e2c2a', '#3a3836', '#74726f', '#8f8c8a', '#aaa7a5', '#c6c4c1', '#e4e1de', '#ffffff'] as const;

/** The greys, darkest first (the contrast test reads them). */
export const HOME_GREYS: readonly string[] = G;

/** The home's one colour: "do this next" (decision 64). */
export const HOME_ACTION = '#d59526';

/** The corner glows' light (decision 65): the greys' hue, never the amber. */
export const HOME_GLOW = '#e8e1db';

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
    '--home-action-color': HOME_ACTION,
    '--home-glow-color': HOME_GLOW,
    '--home-glow-strength': '5%',
    '--home-glow-reach': '30vmax',
    '--corner-radius': '6px',
    '--font-ui': 'system-ui, sans-serif',
    '--font-code': 'ui-monospace, monospace',
    'color-scheme': 'dark',
  };
}
