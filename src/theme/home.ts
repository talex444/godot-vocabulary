import type { ThemeTokens } from './tokens';

/**
 * The home page's own theme (decisions 49, 64, 67): dark and warm, lit by one pale amber light from
 * the top right, the system font (so the home needs no font file) and a 6 px corner. Unlike the areas,
 * it meets WCAG 2.2 AA in full: `tests/unit/contrast.test.ts` fails the build if any pair it draws
 * falls short.
 *
 * Eleven warm greys, darkest first, in CIELAB LCh (decision 67, variant B2 as Tyler chose it from
 * pictures). The dark end is the page and the tiles: five even steps of about 5 L*, chroma rising
 * from 3 to 7.6 as the value rises and the hue held near 65°, so the tile reads warm where a phone
 * shows it; the page and the tile's light end are B2's own `#130e09` and the artist's `#433830`. The
 * light end is the inks, kept from 1.3.3 (chroma about 3, hue 69°), so every ratio drawn with them
 * only rises. Each value is the 8-bit colour whose measured L*, chroma and hue land closest to the
 * plan; the columns are the measured ones. Every grey token is one of them.
 *
 * | Grey | Hex | L* | C* | h | Role |
 * |------|-----|---:|---:|--:|------|
 * | 0 | #130e09 | 4.3 | 2.9 | 69° | the page (`--base-color`) |
 * | 1 | #1f1a16 | 9.7 | 4.0 | 67° | a pressed tile's dark end; panels (`--dark-color-1`), code background |
 * | 2 | #2d251f | 15.4 | 6.0 | 65° | a tile's dark end at rest; the disabled secondary button |
 * | 3 | #372e27 | 19.7 | 6.6 | 66° | a hovered tile's dark end; a pressed tile's light end; inline code chips |
 * | 4 | #433830 | 24.4 | 7.6 | 64° | a tile's light end, at rest and hovered |
 * | 5 | #77716c | 48.0 | 3.8 | 69° | edges of fields and switches; the secondary button's fill |
 * | 6 | #918b86 | 58.2 | 3.7 | 69° | the focus halo |
 * | 7 | #aca7a3 | 68.8 | 2.9 | 69° | tertiary text (disabled, readonly); the quiet tile lines and the lessons figure |
 * | 8 | #c8c3bf | 79.1 | 2.8 | 69° | secondary text |
 * | 9 | #e5e1de | 89.8 | 2.1 | 67° | primary text; links and the focus ring (in place of an accent); the tile's lit edge |
 * | 10 | #ffffff | 100 | 0 | – | text on the secondary button, field input, hover and pressed text |
 *
 * A tile is a two-step gradient on this ramp (decision 67, the artist's one light): at rest g2 → g4,
 * its light end toward the top-right glow, so the tile stays the lightest dark shape where the light
 * falls and its edge never dissolves into it. Hovered, the dark end lifts a step (g3 → g4); pressed,
 * both ends sink a step (g1 → g3) and the lit edge goes out. Every ink is lighter than every surface,
 * so each tile's light end is its worst case, and the contrast test measures both ends of all three.
 * A tile has no border and no outer shadow: it is a text-labelled button, so WCAG 1.4.11 asks for no
 * boundary; the chevron and the focus ring are its measured non-text marks. The 1 px lit top edge is
 * the primary grey at `--home-tile-edge-strength` over the tile: ambient light, decoration only.
 *
 * Two warm inks, one hue (about 83°), two chromas (decision 67, the design seat's ladder of two):
 * - `--home-action-color` #e3bf7f, LCh 79.1 / 37.3 / 83°, the pale amber: "do this next" and nothing
 *   else, so the "Next: Lesson N" line and the "12 ready" figure. Lowest ratio 6.51:1, on a tile's
 *   light end.
 * - `--home-tan-color` #cdb690, LCh 75.1 / 22.5 / 84°, the muted tan: the structure around the action,
 *   the "Areas" heading, the tools' icons, the chevrons and the today line. Lowest 5.79:1, same place.
 *
 * One static glow at the top right (decisions 65, 67), painted by screens.css from three tokens:
 * - `--home-glow-color` is the pale amber itself: the amber is the app's own light (decision 67).
 * - `--home-glow-strength` 20 %: its alpha at the corner, composited over the page, giving #3d3121,
 *   L* 21.2: above the tile's dark end, below its light end. The glow may rise above a tile (decision
 *   67); the contrast test measures every ink on that peak.
 * - `--home-glow-reach` 48vmax: about 370 px on a 360×780 phone, the top half of the screen.
 */

const G = ['#130e09', '#1f1a16', '#2d251f', '#372e27', '#433830', '#77716c', '#918b86', '#aca7a3', '#c8c3bf', '#e5e1de', '#ffffff'] as const;

/** The greys, darkest first (the contrast test reads them). */
export const HOME_GREYS: readonly string[] = G;

/** The pale amber: "do this next" (decisions 64, 67), and the app's one light. */
export const HOME_ACTION = '#e3bf7f';

/** The muted tan: the heading, icons, chevrons and today line around the action (decision 67). */
export const HOME_TAN = '#cdb690';

const [g0, g1, g2, g3, g4, g5, g6, g7, g8, g9, g10] = G;

/** The three text roles. */
const PRIMARY = g9;
const SECONDARY = g8;
const TERTIARY = g7;

export function homeTokens(): ThemeTokens {
  return {
    '--base-color': g0,
    '--accent-color': PRIMARY,
    '--mono-color': g10,
    '--dark-color-1': g1,
    '--dark-color-2': g1,
    '--dark-color-3': g2,
    '--contrast-color-1': g5,
    '--contrast-color-2': g7,
    '--highlight-color': g6,
    '--highlight-disabled-color': g3,
    '--selection-color': g5,
    '--font-color': PRIMARY,
    '--font-secondary-color': SECONDARY,
    '--font-hover-color': g10,
    '--font-pressed-color': g10,
    '--font-focus-color': g10,
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
    '--code-selection-color': g5,
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
    '--home-tan-color': HOME_TAN,
    '--home-tile-color': g2,
    '--home-tile-light-color': g4,
    '--home-tile-hover-color': g3,
    '--home-tile-hover-light-color': g4,
    '--home-tile-pressed-color': g1,
    '--home-tile-pressed-light-color': g3,
    '--home-tile-edge-strength': '8%',
    '--home-quiet-color': TERTIARY,
    '--home-glow-color': HOME_ACTION,
    '--home-glow-strength': '20%',
    '--home-glow-reach': '48vmax',
    '--corner-radius': '6px',
    '--font-ui': 'system-ui, sans-serif',
    '--font-code': 'ui-monospace, monospace',
    'color-scheme': 'dark',
  };
}
