import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AREAS } from '../../src/areas/registry';
import { parseColor, toHex, type Rgba } from '../../src/theme/derive';
import { homeTokens } from '../../src/theme/home';
import type { ThemeTokens } from '../../src/theme/tokens';

/*
 * Done-criteria 28, 66, 70 / decisions 22, 49, 54: the home page's theme must pass every pair it draws
 * (a hard gate). Inside an area the tool's colours win on every pair, so no area ratio ever fails this
 * test. It measures every pair the kit draws, in every area's token map (text
 * pairs and non-text pairs: control edges, focus and selection), writes docs/contrast-report.md with
 * one section per area, and fails only when the committed report differs from what it computed (then
 * it has just rewritten the file: review and commit it).
 */

const REPORT = new URL('../../docs/contrast-report.md', import.meta.url);

/** `fg` over `bg` (straight alpha, sRGB), rounded to 8 bits as a browser paints it. */
function over(fg: Rgba, bg: Rgba): Rgba {
  const a = fg[3];
  const ch = (i: number) => Math.round((fg[i]! * a + bg[i]! * (1 - a)) * 255) / 255;
  return [ch(0), ch(1), ch(2), 1];
}

/** WCAG 2.x relative luminance. */
function luminance(c: Rgba): number {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
}

function contrast(fg: Rgba, bg: Rgba, page: Rgba): number {
  const back = over(bg, page);
  const [hi, lo] = [luminance(over(fg, back)), luminance(back)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

type Need = 4.5 | 3;
type Colour = [name: string, rgba: Rgba];
interface Pair {
  pair: string;
  fg: Colour;
  bg: Colour;
  need: Need;
}

const TEXT = 4.5;
const LARGE = 3; // 1.4.3 large text (20 px bold headings) and 1.4.11 controls and focus.

const SYNTAX = [
  'text_color', 'line_number_color', 'keyword_color', 'control_flow_keyword_color', 'string_placeholder_color',
  'string_color', 'number_color', 'comment_color', 'doc_comment_color', 'function_color',
  'gdscript_function_definition_color', 'gdscript_global_function_color', 'base_type_color', 'engine_type_color',
  'member_variable_color', 'symbol_color',
] as const;

/** Every pair the kit draws, read from one area's token map (names as in Godot's theme: `font_color`, `code_…`). */
function pairs(tokens: ThemeTokens): { text: Pair[]; nonText: Pair[] } {
  const t = (key: string): Colour => {
    const value = tokens[`--${key.replace(/_/g, '-')}`];
    if (value === undefined) throw new Error(`No token for ${key}`);
    return [key, parseColor(value)];
  };
  const c = (key: string) => t(`code_${key}`);
  const backgrounds = [t('base_color'), t('dark_color_1'), c('background_color')];
  const blankLine: Colour = ['code_current_line_color over code_background_color', over(c('current_line_color')[1], c('background_color')[1])];

  // The pairs measured since 1.0 (decision 22): text, headings and links, plus the first control pairs.
  const text: Pair[] = [
    ...backgrounds.flatMap((bg) => [
      { pair: 'body text', fg: t('font_color'), bg, need: TEXT as Need },
      { pair: 'secondary text', fg: t('font_secondary_color'), bg, need: TEXT as Need },
      { pair: 'disabled text (1.4.3 exempts inactive controls)', fg: t('font_disabled_color'), bg, need: TEXT as Need },
    ]),
    { pair: 'focus text: prompts, values, field input', fg: t('font_focus_color'), bg: t('dark_color_1'), need: TEXT },
    ...[t('base_color'), t('dark_color_1')].flatMap((bg) => [
      { pair: 'accent heading (20 px bold, large)', fg: t('accent_color'), bg, need: LARGE as Need },
      { pair: 'accent link text', fg: t('accent_color'), bg, need: TEXT as Need },
      { pair: 'accent focus ring', fg: t('accent_color'), bg, need: LARGE as Need },
    ]),
    ...[t('dark_color_1'), t('base_color')].flatMap((bg) => [
      { pair: 'success text', fg: t('success_color'), bg, need: TEXT as Need },
      { pair: 'warning text', fg: t('warning_color'), bg, need: TEXT as Need },
      { pair: 'error text', fg: t('error_color'), bg, need: TEXT as Need },
    ]),
    ...SYNTAX.map((key) => ({ pair: 'code syntax colour', fg: c(key), bg: c('background_color'), need: TEXT as Need })),
    { pair: 'code text on the blank line', fg: c('text_color'), bg: blankLine, need: TEXT },
    { pair: 'inline code', fg: t('font_focus_color'), bg: c('completion_background_color'), need: TEXT },
    { pair: 'primary button text', fg: t('font_focus_color'), bg: t('accent_color'), need: TEXT },
    { pair: 'secondary button text', fg: t('font_focus_color'), bg: t('contrast_color_1'), need: TEXT },
    { pair: 'field border', fg: t('contrast_color_1'), bg: t('dark_color_1'), need: LARGE },
    { pair: 'switch track, off', fg: t('contrast_color_1'), bg: t('dark_color_1'), need: LARGE },
    { pair: 'switch track, on', fg: t('accent_color'), bg: t('dark_color_1'), need: LARGE },
    { pair: 'switch thumb on the off track', fg: t('font_focus_color'), bg: t('contrast_color_1'), need: LARGE },
    { pair: 'right-answer ring', fg: t('success_color'), bg: t('base_color'), need: LARGE },
    { pair: 'wrong-answer ring', fg: t('error_color'), bg: t('base_color'), need: LARGE },
    { pair: 'blank slot', fg: t('selection_color'), bg: t('dark_color_1'), need: LARGE },
  ];

  // WCAG 1.4.11 at 3:1: the edges of controls against what surrounds them, focus and selection.
  const nonText: Pair[] = [
    ...[t('base_color'), t('dark_color_1')].map((bg) => ({ pair: 'focus halo around a focused button or choice', fg: t('highlight_color'), bg, need: LARGE as Need })),
    ...[t('dark_color_1'), t('base_color')].map((bg) => ({ pair: 'primary button edge', fg: t('accent_color'), bg, need: LARGE as Need })),
    ...[t('dark_color_1'), t('base_color')].map((bg) => ({ pair: 'secondary button edge', fg: t('contrast_color_1'), bg, need: LARGE as Need })),
    { pair: 'disabled primary button edge (1.4.11 exempts inactive controls)', fg: t('highlight_disabled_color'), bg: t('dark_color_1'), need: LARGE },
    { pair: 'choice row edge', fg: t('base_color'), bg: t('dark_color_1'), need: LARGE },
    { pair: 'switch thumb on the on track', fg: t('font_focus_color'), bg: t('accent_color'), need: LARGE },
    { pair: 'invalid field edge', fg: t('error_color'), bg: t('dark_color_1'), need: LARGE },
    { pair: 'progress bar track', fg: t('dark_color_1'), bg: t('base_color'), need: LARGE },
    { pair: 'progress bar fill', fg: t('accent_color'), bg: t('dark_color_1'), need: LARGE },
    { pair: 'inline code chip edge', fg: c('completion_background_color'), bg: t('dark_color_1'), need: LARGE },
    { pair: 'code selection', fg: c('selection_color'), bg: c('background_color'), need: LARGE },
    { pair: 'warning edge (lesson errors)', fg: t('warning_color'), bg: t('base_color'), need: LARGE },
  ];
  return { text, nonText };
}

/**
 * The home page at its brightest point (decision 65): the top-right glow's colour at its strength,
 * composited over the base as the browser paints it. Every ink is lighter than every surface, so the
 * lightest page point is the worst case for every page-level pair.
 */
function glowPeak(tokens: ThemeTokens): Rgba {
  const [r, g, b] = parseColor(tokens['--home-glow-color']!);
  const strength = parseFloat(tokens['--home-glow-strength']!) / 100;
  return over([r, g, b, strength], parseColor(tokens['--base-color']!));
}

/**
 * Every pair the home page and the screens it opens in its theme (About, the error screen) draw
 * (decisions 49, 54, 64, 65): text in its three roles and the one action colour on every surface,
 * headings, links, the secondary button, the tiles' borders and chevrons at rest, hovered and
 * pressed, and focus; the page-level pairs also on the page at the glow's peak. No accent fills, so
 * no primary button pairs. These must all pass.
 */
function homePairs(tokens: ThemeTokens): { text: Pair[]; nonText: Pair[]; surfaces: Colour[] } {
  const t = (key: string): Colour => {
    const value = tokens[`--${key.replace(/_/g, '-')}`];
    if (value === undefined) throw new Error(`No token for ${key}`);
    return [key, parseColor(value)];
  };
  const peak: Colour = [`page at glow peak (home_glow_color at ${tokens['--home-glow-strength']} over base_color)`, glowPeak(tokens)];
  const surfaces: Colour[] = [
    t('base_color'),
    peak,
    t('dark_color_1'),
    ['dark_color_3 (hovered tile)', t('dark_color_3')[1]],
    ['highlight_disabled_color (pressed or loading tile)', t('highlight_disabled_color')[1]],
  ];
  const text: Pair[] = [
    ...surfaces.flatMap((bg) => [
      { pair: 'primary text', fg: t('font_color'), bg, need: TEXT as Need },
      { pair: 'secondary text', fg: t('font_secondary_color'), bg, need: TEXT as Need },
      { pair: 'tertiary text', fg: t('font_disabled_color'), bg, need: TEXT as Need },
      { pair: 'action text: a due figure above zero (the one colour)', fg: t('home_action_color'), bg, need: TEXT as Need },
    ]),
    ...[t('base_color'), peak, t('dark_color_1')].flatMap((bg) => [
      { pair: 'heading (accent_color is the primary grey)', fg: t('accent_color'), bg, need: TEXT as Need },
      { pair: 'link text', fg: t('accent_color'), bg, need: TEXT as Need },
      { pair: 'hovered or pressed button text', fg: t('font_hover_color'), bg, need: TEXT as Need },
    ]),
    { pair: 'secondary button text (Back)', fg: t('font_focus_color'), bg: t('contrast_color_1'), need: TEXT },
  ];
  const nonText: Pair[] = [
    ...surfaces.flatMap((bg) => [
      { pair: 'tile border', fg: t('contrast_color_2'), bg, need: LARGE as Need },
      { pair: 'tile chevron (secondary grey)', fg: t('font_secondary_color'), bg, need: LARGE as Need },
    ]),
    ...[t('base_color'), peak, t('dark_color_1')].flatMap((bg) => [
      { pair: 'focus ring', fg: t('accent_color'), bg, need: LARGE as Need },
      { pair: 'focus halo', fg: t('highlight_color'), bg, need: LARGE as Need },
      { pair: 'secondary button edge', fg: t('contrast_color_1'), bg, need: LARGE as Need },
    ]),
  ];
  return { text, nonText, surfaces };
}

interface Measured extends Pair {
  ratio: number;
  pass: boolean;
}

function measure(list: Pair[], page: Rgba): Measured[] {
  return list.map((p) => {
    const ratio = contrast(p.fg[1], p.bg[1], page);
    return { ...p, ratio, pass: ratio >= p.need };
  });
}

const SOURCES: Record<string, string> = {
  godot: 'the derived Godot 4.7 dark theme (`src/theme/derive.ts`, `data/theme/godot-4.7-defaults.json`, through `godotTokens()` in `src/theme/tokens.ts`)',
  github: 'GitHub Desktop’s dark theme (`src/theme/github-desktop.ts`, from `data/theme/github-desktop/_dark.scss` and the Primer palette)',
};

function table(rows: Measured[]): string[] {
  const cell = ([name, rgba]: Colour) => `${name} \`${toHex(rgba)}\``;
  return [
    '| Pair | Foreground | Background | Ratio | Needs | Result |',
    '|------|------------|------------|------:|------:|--------|',
    ...rows.map((r) => `| ${r.pair} | ${cell(r.fg)} | ${cell(r.bg)} | ${r.ratio.toFixed(2)}:1 | ${r.need}:1 | ${r.pass ? 'pass' : '**fail**'} |`),
  ];
}

function report(): { markdown: string; short: Record<string, { text: number; nonText: number }> } {
  const short: Record<string, { text: number; nonText: number }> = {};
  const lines = [
    '# Contrast report',
    '',
    'Generated by `tests/unit/contrast.test.ts` from every area’s token map. Do not edit by hand: run `pnpm test`, then commit the rewritten file.',
    '',
    'Inside an area the tool’s colours are never altered to pass a ratio (decisions 22 and 54; Tyler 2026-10-13: "godot wins where they disagree"; 2026-10-14: "keep it exact the way the tool is"). The pairs marked **fail** are a known deviation from WCAG 2.2 1.4.3 (text, 4.5:1; large text 3:1) and 1.4.11 (controls, states and focus, 3:1).',
    '',
    'Ratios are WCAG 2.x relative-luminance contrast. Translucent colours are composited onto their background (and translucent backgrounds onto the area’s `base_color`) and rounded to 8 bits, as the browser paints them.',
  ];
  // The home page's own theme comes first, and here no pair may fall short (decisions 49 and 54).
  const home = homeTokens();
  const homePage = parseColor(home['--base-color']!);
  const homeText = measure(homePairs(home).text, homePage);
  const homeNonText = measure(homePairs(home).nonText, homePage);
  short.home = { text: homeText.filter((r) => !r.pass).length, nonText: homeNonText.filter((r) => !r.pass).length };
  lines.push(
    '',
    '## Home',
    '',
    'From the home page’s own theme (`src/theme/home.ts`: ten warm greys and one action colour): the home page, and About and the error screen when opened from it. Unlike the areas, it meets WCAG 2.2 AA in full: `pnpm test` fails if any pair below falls short.',
    '',
    `The home’s two corner glows (decision 65) lighten the page toward its corners; the page-level pairs are measured again on the page at the brighter glow’s peak, \`${toHex(glowPeak(home))}\` (\`--home-glow-color\` at \`--home-glow-strength\` over \`--base-color\`). Every ink is lighter than every surface, so that peak is the worst case, and it stays at or below the tile surface in lightness.`,
    '',
    '### Text',
    '',
    `**${short.home.text} of ${homeText.length} pairs fall short.**`,
    '',
    ...table(homeText),
    '',
    '### Non-text: tile borders and chevrons (at rest, hovered, pressed), focus and the secondary button (WCAG 1.4.11, 3:1)',
    '',
    `**${short.home.nonText} of ${homeNonText.length} pairs fall short.**`,
    '',
    ...table(homeNonText),
  );
  for (const area of AREAS) {
    const tokens = area.theme;
    const page = parseColor(tokens['--base-color']!);
    const { text, nonText } = pairs(tokens);
    const textRows = measure(text, page);
    const nonTextRows = measure(nonText, page);
    const s = { text: textRows.filter((r) => !r.pass).length, nonText: nonTextRows.filter((r) => !r.pass).length };
    short[area.id] = s;
    lines.push(
      '',
      `## ${area.label}`,
      '',
      `From ${SOURCES[area.id] ?? `the ${area.label} token map`}.`,
      '',
      '### Text, and the control pairs measured since 1.0',
      '',
      `**${s.text} of ${textRows.length} pairs fall short.**`,
      '',
      ...table(textRows),
      '',
      '### Non-text: control edges, focus and selection (WCAG 1.4.11, 3:1)',
      '',
      `**${s.nonText} of ${nonTextRows.length} pairs fall short.**`,
      '',
      ...table(nonTextRows),
    );
  }
  lines.push('');
  return { markdown: lines.join('\n'), short };
}

describe('contrast report (never fails on an area’s ratio; fails on any home ratio)', () => {
  it('computes WCAG ratios', () => {
    const black: Rgba = [0, 0, 0, 1];
    expect(contrast([1, 1, 1, 1], black, black)).toBeCloseTo(21, 5);
    expect(contrast([0.5, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 1], black)).toBe(1);
  });

  it('keeps the Godot text section as it was (5 of 49 short) and lists GitHub’s accent on the base as short', () => {
    const { short } = report();
    expect(short.godot!.text).toBe(5);
    const github = AREAS.find((a) => a.id === 'github')!.theme;
    const page = parseColor(github['--base-color']!);
    const accentOnBase = measure(pairs(github).text, page).find((r) => r.pair === 'accent link text' && r.bg[0] === 'base_color')!;
    expect(accentOnBase.ratio).toBeCloseTo(2.7, 1);
    expect(accentOnBase.pass).toBe(false);
  });

  it('the home page: zero pairs short, text and non-text (a hard gate, unlike the areas)', () => {
    const { short } = report();
    expect(short.home).toEqual({ text: 0, nonText: 0 });
  });

  it('the glow peak: every home ink is lighter than every surface, and the peak is no lighter than a tile', () => {
    const home = homeTokens();
    const { text, nonText, surfaces } = homePairs(home);
    // Every colour drawn on the five surfaces (the page, its glow peak, a tile at rest, hovered, pressed).
    const surfaceHexes = new Set(surfaces.map(([, c]) => toHex(c)));
    const onSurface = [...text, ...nonText].filter((p) => surfaceHexes.has(toHex(p.bg[1])));
    const darkestInk = Math.min(...onSurface.map((p) => luminance(p.fg[1])));
    const lightestSurface = Math.max(...surfaces.map(([, c]) => luminance(c)));
    expect(onSurface.length).toBeGreaterThan(0);
    expect(darkestInk).toBeGreaterThan(lightestSurface);
    // Luminance is monotonic in L*, so this is the peak's L* at or below g1's (decision 65).
    expect(luminance(glowPeak(home))).toBeLessThanOrEqual(luminance(parseColor(home['--dark-color-1']!)));
    expect(toHex(glowPeak(home))).toBe('#211f1d');
  });

  it('matches the committed docs/contrast-report.md', () => {
    const { markdown } = report();
    const committed = existsSync(REPORT) ? readFileSync(REPORT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (committed !== markdown) writeFileSync(REPORT, markdown);
    expect(committed, 'docs/contrast-report.md was stale and has been rewritten; review and commit it').toBe(markdown);
  });
});
