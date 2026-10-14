import { HOME_ONLY, type ThemeTokens } from './tokens';

/**
 * The Git & GitHub area: GitHub Desktop's dark theme (decision 47), its colours used as they are
 * (decisions 22, 48). Sources, read by hand and never imported: `data/theme/github-desktop/_dark.scss`
 * (Desktop's `body.theme-dark` variables, MIT), `_variables.scss` (fonts, radius) and
 * `primer-color-system.scss` (primer-support 4.x, the palette Desktop pins; MIT).
 *
 * SCSS `darken(c, n%)` / `lighten(c, n%)` move HSL lightness down / up by n points; each is computed
 * once here and written as hex, with its formula beside it.
 *
 * | Token | GitHub Desktop variable | Primer name | Hex |
 * |-------|-------------------------|-------------|-----|
 * | --base-color | --background-color | $gray-900 | #24292e |
 * | --accent-color | --button-background, --focus-color | $blue (= $blue-500) | #0366d6 |
 * | --mono-color | --button-text-color | $white | #ffffff |
 * | --dark-color-1 | --box-background-color | darken($gray-900, 3%) | #1d2125 |
 * | --dark-color-2 | --toolbar-background-color | darken($gray-900, 3%) | #1d2125 |
 * | --dark-color-3 | --box-alt-background-color | lighten($gray-900, 3%) | #2b3137 |
 * | --contrast-color-1 | --box-border-contrast-color | lighten($gray-500, 3%) | #717b85 |
 * | --contrast-color-2 | --secondary-button-hover-border-color | $gray-300 | #d1d5da |
 * | --highlight-color | --box-hover-background-color | $gray-800 | #2f363d |
 * | --highlight-disabled-color | --box-selected-background-color | $gray-700 | #444d56 |
 * | --selection-color | --box-selected-active-background-color | $blue | #0366d6 |
 * | --font-color | --text-color | $gray-100 | #f6f8fa |
 * | --font-secondary-color | --text-secondary-color | $gray-400 | #959da5 |
 * | --font-hover-color | --toolbar-button-hover-color | $white | #ffffff |
 * | --font-pressed-color | --toolbar-button-active-color (= --text-color) | $gray-100 | #f6f8fa |
 * | --font-focus-color | --button-text-color | $white | #ffffff |
 * | --font-disabled-color | --text-secondary-color-muted | darken($gray-500, 10%) | #535a61 |
 * | --font-readonly-color | --text-secondary-color | $gray-400 | #959da5 |
 * | --success-color | --color-new | $green (= $green-500) | #28a745 |
 * | --warning-color | --color-modified | $yellow-700 | #dbab09 |
 * | --error-color | --color-deleted | $red (= $red-500) | #d73a49 |
 * | --code-background-color | --diff-gutter-background-color | darken($gray-900, 3%) | #1d2125 |
 * | --code-completion-background-color | --path-segment-background ("inline paths and code") | $gray-700 | #444d56 |
 * | --code-text-color | --diff-text-color (= --text-color) | $gray-100 | #f6f8fa |
 * | --code-line-number-color | --diff-line-number-color (= --text-secondary-color) | $gray-400 | #959da5 |
 * | --code-caret-color | --text-color | $gray-100 | #f6f8fa |
 * | --code-selection-color | --diff-selected-background-color | $blue-700 | #044289 |
 * | --code-current-line-color | --box-hover-background-color | $gray-800 | #2f363d |
 * | --code-code-folding-color | --diff-hunk-text-color (= --text-secondary-color) | $gray-400 | #959da5 |
 * | --code-symbol-color | --diff-text-color | $gray-100 | #f6f8fa |
 * | --code-keyword-color | --syntax-keyword-color | $red-300 | #f97583 |
 * | --code-control-flow-keyword-color | --syntax-keyword-color | $red-300 | #f97583 |
 * | --code-base-type-color | --syntax-type-color | $red-300 | #f97583 |
 * | --code-engine-type-color | --syntax-atom-color | $blue-300 | #79b8ff |
 * | --code-user-type-color | --syntax-alt-variable-color | $blue-300 | #79b8ff |
 * | --code-comment-color | --syntax-comment-color | $gray-400 | #959da5 |
 * | --code-doc-comment-color | --syntax-comment-color | $gray-400 | #959da5 |
 * | --code-string-color | --syntax-string-color | $orange-300 | #ffab70 |
 * | --code-string-placeholder-color | --syntax-attribute-color | $purple-300 | #b392f0 |
 * | --code-number-color | --syntax-atom-color | $blue-300 | #79b8ff |
 * | --code-function-color | --syntax-variable-color | $purple-300 | #b392f0 |
 * | --code-member-variable-color | --syntax-alt-variable-color | $blue-300 | #79b8ff |
 * | --code-gdscript-function-definition-color | --syntax-variable-color | $purple-300 | #b392f0 |
 * | --code-gdscript-global-function-color | --syntax-variable-color | $purple-300 | #b392f0 |
 * | --code-bookmark-color | --focus-color | $blue | #0366d6 |
 * | --code-executing-line-color | --color-modified | $yellow-700 | #dbab09 |
 * | --code-breakpoint-color | --color-deleted | $red | #d73a49 |
 * | --corner-radius | --border-radius (`_variables.scss`) | | 6px |
 * | --font-ui | --font-family-sans-serif (`_variables.scss`) | | system-ui, … |
 * | --font-code | --font-family-monospace (`_variables.scss`) | | SFMono-Regular, … |
 * | color-scheme | `body.theme-dark` | | dark |
 *
 * Where one Godot token stands for two Desktop roles, the table names the one the kit draws most:
 * `--contrast-color-1` is the edge of fields and switches (Desktop's 3:1 border colour) and also the
 * secondary button's fill.
 */

// The emoji fallbacks `_variables.scss` appends to both stacks ($emoji_fallback_fonts).
const EMOJI = "'Apple Color Emoji', 'Segoe UI', 'Segoe UI Emoji', 'Segoe UI Symbol'";

export function githubTokens(): ThemeTokens {
  return {
    '--base-color': '#24292e',
    '--accent-color': '#0366d6',
    '--mono-color': '#ffffff',
    '--dark-color-1': '#1d2125', // darken($gray-900, 3%): L 16.08% → 13.08%
    '--dark-color-2': '#1d2125', // darken($gray-900, 3%)
    '--dark-color-3': '#2b3137', // lighten($gray-900, 3%): L 16.08% → 19.08%
    '--contrast-color-1': '#717b85', // lighten($gray-500, 3%): L 45.29% → 48.29%
    '--contrast-color-2': '#d1d5da',
    '--highlight-color': '#2f363d',
    '--highlight-disabled-color': '#444d56',
    '--selection-color': '#0366d6',
    '--font-color': '#f6f8fa',
    '--font-secondary-color': '#959da5',
    '--font-hover-color': '#ffffff',
    '--font-pressed-color': '#f6f8fa',
    '--font-focus-color': '#ffffff',
    '--font-disabled-color': '#535a61', // darken($gray-500, 10%): L 45.29% → 35.29%
    '--font-readonly-color': '#959da5',
    '--success-color': '#28a745',
    '--warning-color': '#dbab09',
    '--error-color': '#d73a49',
    '--code-background-color': '#1d2125', // darken($gray-900, 3%)
    '--code-completion-background-color': '#444d56',
    '--code-text-color': '#f6f8fa',
    '--code-line-number-color': '#959da5',
    '--code-caret-color': '#f6f8fa',
    '--code-selection-color': '#044289',
    '--code-current-line-color': '#2f363d',
    '--code-code-folding-color': '#959da5',
    '--code-symbol-color': '#f6f8fa',
    '--code-keyword-color': '#f97583',
    '--code-control-flow-keyword-color': '#f97583',
    '--code-base-type-color': '#f97583',
    '--code-engine-type-color': '#79b8ff',
    '--code-user-type-color': '#79b8ff',
    '--code-comment-color': '#959da5',
    '--code-doc-comment-color': '#959da5',
    '--code-string-color': '#ffab70',
    '--code-string-placeholder-color': '#b392f0',
    '--code-number-color': '#79b8ff',
    '--code-function-color': '#b392f0',
    '--code-member-variable-color': '#79b8ff',
    '--code-gdscript-function-definition-color': '#b392f0',
    '--code-gdscript-global-function-color': '#b392f0',
    '--code-bookmark-color': '#0366d6',
    '--code-executing-line-color': '#dbab09',
    '--code-breakpoint-color': '#d73a49',
    ...HOME_ONLY,
    '--corner-radius': '6px',
    '--font-ui': `system-ui, sans-serif, ${EMOJI}`,
    '--font-code': `SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace, ${EMOJI}`,
    'color-scheme': 'dark',
  };
}
