import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import defaults from '../../data/theme/godot-4.7-defaults.json';
import { deriveTheme, parseColor, toHex, type Rgba } from '../../src/theme/derive';

/*
 * Done-criteria 28 / decision 22: Godot's colours win, so no ratio ever fails this test. It measures
 * every pair the kit uses, writes docs/contrast-report.md, and fails only when the committed report
 * differs from what it computed (then it has just rewritten the file: review and commit it).
 */

const REPORT = new URL('../../docs/contrast-report.md', import.meta.url);

const theme = deriveTheme();
const code = (key: keyof typeof defaults.script_editor): Rgba => parseColor(defaults.script_editor[key]);

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

function contrast(fg: Rgba, bg: Rgba, page: Rgba = theme.base_color): number {
  const back = over(bg, page);
  const [hi, lo] = [luminance(over(fg, back)), luminance(back)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

type Need = 4.5 | 3;
interface Pair {
  pair: string;
  fg: [string, Rgba];
  bg: [string, Rgba];
  need: Need;
}

const TEXT = 4.5;
const LARGE = 3; // 1.4.3 large text (20 px bold headings) and 1.4.11 controls and focus.

const t = (key: keyof typeof theme): [string, Rgba] => [key, theme[key]];
const c = (key: keyof typeof defaults.script_editor): [string, Rgba] => [`code_${key}`, code(key)];

const backgrounds = [t('base_color'), t('dark_color_1'), c('background_color')];

const SYNTAX = [
  'text_color', 'line_number_color', 'keyword_color', 'control_flow_keyword_color', 'string_placeholder_color',
  'string_color', 'number_color', 'comment_color', 'doc_comment_color', 'function_color',
  'gdscript_function_definition_color', 'gdscript_global_function_color', 'base_type_color', 'engine_type_color',
  'member_variable_color', 'symbol_color',
] as const;

const PAIRS: Pair[] = [
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
  { pair: 'code text on the blank line', fg: c('text_color'), bg: ['code_current_line_color over code_background_color', over(code('current_line_color'), code('background_color'))], need: TEXT },
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

function report(): { markdown: string; fails: number } {
  const rows = PAIRS.map((p) => {
    const ratio = contrast(p.fg[1], p.bg[1]);
    const pass = ratio >= p.need;
    return { ...p, ratio, pass };
  });
  const fails = rows.filter((r) => !r.pass).length;
  const cell = ([name, rgba]: [string, Rgba]) => `${name} \`${toHex(rgba)}\``;
  const lines = [
    '# Contrast report',
    '',
    'Generated by `tests/unit/contrast.test.ts` from the derived Godot 4.7 dark theme (`src/theme/derive.ts`, `data/theme/godot-4.7-defaults.json`). Do not edit by hand: run `pnpm test`, then commit the rewritten file.',
    '',
    'Godot\'s colours are never altered to pass a ratio (decision 22, Tyler 2026-10-13: "godot wins where they disagree"). The pairs marked **fail** are a known deviation from WCAG 2.2 1.4.3 (text, 4.5:1; large text 3:1) and 1.4.11 (controls, states and focus, 3:1).',
    '',
    'Ratios are WCAG 2.x relative-luminance contrast. Translucent colours are composited onto their background (and translucent backgrounds onto `base_color`) and rounded to 8 bits, as the browser paints them.',
    '',
    `**${fails} of ${rows.length} pairs fall short.**`,
    '',
    '| Pair | Foreground | Background | Ratio | Needs | Result |',
    '|------|------------|------------|------:|------:|--------|',
    ...rows.map((r) => `| ${r.pair} | ${cell(r.fg)} | ${cell(r.bg)} | ${r.ratio.toFixed(2)}:1 | ${r.need}:1 | ${r.pass ? 'pass' : '**fail**'} |`),
    '',
  ];
  return { markdown: lines.join('\n'), fails };
}

describe('contrast report (never fails on a ratio)', () => {
  it('computes WCAG ratios', () => {
    expect(contrast([1, 1, 1, 1], [0, 0, 0, 1])).toBeCloseTo(21, 5);
    expect(contrast([0.5, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 1])).toBe(1);
  });

  it('matches the committed docs/contrast-report.md', () => {
    const { markdown } = report();
    const committed = existsSync(REPORT) ? readFileSync(REPORT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (committed !== markdown) writeFileSync(REPORT, markdown);
    expect(committed, 'docs/contrast-report.md was stale and has been rewritten; review and commit it').toBe(markdown);
  });
});
