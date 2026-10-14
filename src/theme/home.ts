import type { ThemeTokens } from './tokens';

/**
 * The home page's own theme (decisions 49, 64): dark, one grey ramp with one warm colour, no accent
 * fills, the system font (so the home needs no font file) and a 6 px corner. Unlike the areas, it
 * meets WCAG 2.2 AA in full: `tests/unit/contrast.test.ts` fails the build if any pair it draws falls
 * short.
 *
 * Ten greys, darkest first, in CIELAB LCh at hue 70° (decision 66: a tonal plan of three values,
 * the dark page, the tiles as the middle mass, the text and figures as the lights). The warmth is in
 * the greys themselves: chroma about 3 to 5.5 at the dark end, where a phone shows it, falling to 0 at
 * white. The page drops to L* 3.6; the surfaces above it keep 1.3.2's L* (12.2, 18.1, 23.6) and so
 * every ratio drawn on them; the inks keep theirs (48 to 100). Each value is the 8-bit colour whose
 * measured L*, chroma and hue land closest to the plan; the columns are the measured ones. Every grey
 * token is one of them.
 *
 * | Grey | Hex | L* | C* | h | Role |
 * |------|-----|---:|---:|--:|------|
 * | 0 | #110c07 | 3.6 | 2.7 | 69° | the page (`--base-color`) |
 * | 1 | #241f1a | 12.2 | 4.5 | 73° | a pressed or loading tile; panels (`--dark-color-1`), code background |
 * | 2 | #322b25 | 18.1 | 5.5 | 69° | a tile at rest; the disabled secondary button |
 * | 3 | #3e3731 | 23.6 | 5.2 | 69° | a hovered tile; inline code chips |
 * | 4 | #77716c | 48.0 | 3.8 | 69° | edges of fields and switches; the secondary button's fill |
 * | 5 | #918b86 | 58.2 | 3.7 | 69° | the focus halo |
 * | 6 | #aca7a3 | 68.8 | 2.9 | 69° | tertiary text (disabled, readonly); the quiet tile lines |
 * | 7 | #c8c3bf | 79.1 | 2.8 | 69° | secondary text; the tile icons and chevron |
 * | 8 | #e5e1de | 89.8 | 2.1 | 67° | primary text; headings, links and the focus ring (in place of an accent) |
 * | 9 | #ffffff | 100 | 0 | – | text on the secondary button, field input, hover and pressed text |
 *
 * A tile has no border (decision 66): it is a text-labelled button, so WCAG 1.4.11 asks for no
 * boundary, and its fill against the page (1.40:1) is a value step, not an edge. The chevron and the
 * focus ring stay measured as the tile's non-text marks. A pressed tile sinks one step (g1) rather
 * than lifting: the amber needs 4.5:1 on it, which nothing lighter than g3 holds.
 *
 * The one colour, `--home-action-color` #d59526 (HSL 38° 70% 49%), means "do this next" and nothing
 * else (decision 64). It is the darkest amber at that hue and saturation that holds 4.5:1 as text on
 * the 1.3.2 surfaces, and the surfaces kept their L*: 7.56:1 on the page, 5.41:1 on a tile, 4.54:1
 * on a hovered tile, 6.34:1 on a pressed one.
 *
 * One static glow at the top right (decisions 65, 66), painted by screens.css from three tokens:
 * - `--home-glow-color` #e8e1db: LCh 89.9 / 4.0 / 70.5°, a warm light in the greys' own hue. Never
 *   the amber (one colour, one meaning).
 * - `--home-glow-strength` 10 %: the glow's alpha at its corner, composited over the page, giving
 *   #27211c, L* 13.2 (about the pressed tile's value). The ceiling is 14 % (#2f2a25, L* 17.4), the
 *   largest whole percent whose peak stays below the tile (g2, L* 18.1); 15 % would give #312c27,
 *   L* 18.4. At 14 % the corner reached the tile's own value and the Godot tile's top-right edge
 *   dissolved into it: the page looked lit, so it came down (Tyler's taste rule).
 *   `tests/unit/contrast.test.ts` measures every page-level pair on the 10 % peak.
 * - `--home-glow-reach` 30vmax: it fades out a quarter to a third of the screen from the corner
 *   (Tyler's bound), about 230 px on a 360×780 phone, behind the heading and the tiles.
 */

const G = ['#110c07', '#241f1a', '#322b25', '#3e3731', '#77716c', '#918b86', '#aca7a3', '#c8c3bf', '#e5e1de', '#ffffff'] as const;

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
    '--home-tile-color': g2,
    '--home-tile-hover-color': g3,
    '--home-tile-pressed-color': g1,
    '--home-quiet-color': TERTIARY,
    '--home-glow-color': HOME_GLOW,
    '--home-glow-strength': '10%',
    '--home-glow-reach': '30vmax',
    '--corner-radius': '6px',
    '--font-ui': 'system-ui, sans-serif',
    '--font-code': 'ui-monospace, monospace',
    'color-scheme': 'dark',
  };
}
