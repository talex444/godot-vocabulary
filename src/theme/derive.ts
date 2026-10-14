import defaults from '../../data/theme/godot-4.7-defaults.json';

/** Godot's `Color`: four floats in 0..1. */
export type Rgba = readonly [number, number, number, number];

// Formula constants from the engine: `Color(0, 0, 0, 1)` and `Color(1, 1, 1)`.
const BLACK: Rgba = [0, 0, 0, 1];
const WHITE: Rgba = [1, 1, 1, 1];

/** Parses `#rrggbb`, `#rrggbbaa` or `rgba(r,g,b,a)` as written in the defaults file. */
export function parseColor(text: string): Rgba {
  const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(text);
  if (hex) {
    const n = (i: number) => parseInt(hex[1]!.slice(i, i + 2), 16) / 255;
    return [n(0), n(2), n(4), hex[2] ? parseInt(hex[2], 16) / 255 : 1];
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(text);
  if (fn) {
    const [r = 0, g = 0, b = 0, a = 1] = fn[1]!.split(',').map(Number);
    return [r / 255, g / 255, b / 255, a];
  }
  throw new Error(`Unreadable colour: ${text}`);
}

const rgb = (c: readonly number[], a = 1): Rgba => [c[0]!, c[1]!, c[2]!, a];
const map = (f: (i: number) => number): Rgba => [f(0), f(1), f(2), f(3)];

/** `Color::lerp`: every channel, alpha included, `a + (b - a) * t`. */
export function lerp(a: Rgba, b: Rgba, t: number): Rgba {
  return map((i) => a[i]! + (b[i]! - a[i]!) * t);
}

/** `Color * Color`: channel-wise product. */
export function mul(a: Rgba, b: Rgba): Rgba {
  return map((i) => a[i]! * b[i]!);
}

/** `Color::clamp()`: every channel into 0..1. */
export function clamp(c: Rgba): Rgba {
  return map((i) => Math.min(1, Math.max(0, c[i]!)));
}

const withAlpha = (c: Rgba, alpha: number): Rgba => [c[0], c[1], c[2], alpha];

/** `Color::get_h/get_s/get_v`. */
function toHsv(c: Rgba): [number, number, number] {
  const [r, g, b] = c;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (r === max) h = (g - b) / delta;
    else if (g === max) h = 2 + (b - r) / delta;
    else h = 4 + (r - g) / delta;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max === 0 ? 0 : delta / max, max];
}

/** `Color::set_hsv`. */
function fromHsv(h: number, s: number, v: number, a: number): Rgba {
  if (s === 0) return [v, v, v, a];
  const sector = Math.floor(h * 6) % 6;
  const f = h * 6 - Math.floor(h * 6);
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  const table: [number, number, number][] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]];
  return rgb(table[sector]!, a);
}

/** `_get_base_color` in theme_modern.cpp: dims the HSV value by contrast and scales saturation. */
function baseColorDimmed(base: Rgba, contrast: number, dimnessOfs: number, saturationMult: number): Rgba {
  const finalContrast = dimnessOfs < 0 ? Math.min(0.5, Math.max(-0.1, contrast)) : contrast;
  const [h, s, v] = toHsv(base);
  const v2 = Math.min(1, Math.max(0, v + (0 - v) * finalContrast * dimnessOfs));
  const withV = fromHsv(h, s, v2, base[3]);
  const [h2, s2, v3] = toHsv(withV);
  return fromHsv(h2, s2 * saturationMult, v3, base[3]);
}

/** `Color::to_html`-style text: `#rrggbb`, or `#rrggbbaa` when not opaque. */
export function toHex(c: Rgba): string {
  const byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  const hex = `#${byte(c[0])}${byte(c[1])}${byte(c[2])}`;
  return c[3] >= 1 ? hex : hex + byte(c[3]);
}

export interface ThemeInputs {
  /** The engine's float channels (`Color(0.14, 0.14, 0.14)`), not the rounded hex. */
  base_color_rgb: readonly number[];
  accent_color_rgb: readonly number[];
  contrast: number;
  default_contrast: number;
}

export type DerivedTheme = Record<
  | 'base_color' | 'accent_color' | 'mono_color'
  | 'dark_color_1' | 'dark_color_2' | 'dark_color_3' | 'contrast_color_1' | 'contrast_color_2'
  | 'highlight_color' | 'highlight_disabled_color' | 'selection_color'
  | 'font_color' | 'font_secondary_color' | 'font_hover_color' | 'font_pressed_color' | 'font_focus_color'
  | 'font_disabled_color' | 'font_readonly_color'
  | 'success_color' | 'warning_color' | 'error_color',
  Rgba
>;

/**
 * `ThemeModern::populate_shared_styles` (godot 4.7-stable, editor/themes/theme_modern.cpp lines 62-130)
 * for the stock dark theme: `dark_theme` and `dark_icon_and_font` are true, so `mono_color` and
 * `mono_color_font` are white. Success/warning/error are engine constants, read from the defaults file.
 */
export function deriveTheme(inputs: ThemeInputs = defaults.inputs): DerivedTheme {
  const base = rgb(inputs.base_color_rgb);
  const accent = rgb(inputs.accent_color_rgb);
  const { contrast, default_contrast: defaultContrast } = inputs;
  const mono = WHITE;
  const monoFont = WHITE;
  const highlight = withAlpha(accent, 0.275);
  return {
    base_color: base,
    accent_color: accent,
    mono_color: mono,
    dark_color_1: clamp(lerp(base, BLACK, contrast * 1.15)),
    dark_color_2: withAlpha(BLACK, 0.3),
    dark_color_3: baseColorDimmed(base, contrast, 0.8, 0.9),
    contrast_color_1: lerp(base, mono, Math.max(contrast * 1.15, defaultContrast * 1.15)),
    contrast_color_2: lerp(base, mono, Math.max(contrast * 1.725, defaultContrast * 1.725)),
    highlight_color: highlight,
    highlight_disabled_color: lerp(highlight, rgb(BLACK, 1), 0.5),
    selection_color: mul(accent, withAlpha(WHITE, 0.4)),
    font_color: mul(monoFont, withAlpha(WHITE, 0.75)),
    font_secondary_color: mul(monoFont, withAlpha(WHITE, 0.55)),
    font_hover_color: mul(monoFont, withAlpha(WHITE, 0.85)),
    font_pressed_color: mul(monoFont, withAlpha(WHITE, 0.85)),
    font_focus_color: monoFont,
    font_disabled_color: mul(monoFont, withAlpha(WHITE, 0.35)),
    font_readonly_color: withAlpha(monoFont, 0.65),
    success_color: parseColor(defaults.derived.success_color),
    warning_color: parseColor(defaults.derived.warning_color),
    error_color: parseColor(defaults.derived.error_color),
  };
}

const cssName = (key: string) => `--${key.replace(/_/g, '-')}`;

/** Every derived colour plus the script editor colours (`--code-…`), as CSS custom properties. */
export function themeProperties(theme: DerivedTheme = deriveTheme()): Record<string, string> {
  const props: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme)) props[cssName(key)] = toHex(value);
  for (const [key, value] of Object.entries(defaults.script_editor)) props[cssName(`code_${key}`)] = toHex(parseColor(value));
  props['--corner-radius'] = `${defaults.interface.corner_radius}px`;
  return props;
}
