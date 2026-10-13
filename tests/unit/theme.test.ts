import { describe, expect, it } from 'vitest';
import defaults from '../../data/theme/godot-4.7-defaults.json';
import { deriveTheme, lerp, parseColor, themeProperties, toHex, type DerivedTheme } from '../../src/theme/derive';

// Stock 4.7 dark inputs: base Color(0.14, 0.14, 0.14), accent Color(0.34, 0.62, 1.0), contrast 0.3.
describe('theme derivation (theme_modern.cpp, dark theme)', () => {
  const theme = deriveTheme();

  it('dark_color_1 = base_color.lerp(black, contrast * 1.15).clamp()', () => {
    // t = 0.3 * 1.15 = 0.345. 0.14 + (0 - 0.14) * 0.345 = 0.14 * 0.655 = 0.0917.
    // 0.0917 * 255 = 23.3835 → 23 = 0x17.
    expect(theme.dark_color_1[0]).toBeCloseTo(0.0917, 10);
    expect(toHex(theme.dark_color_1)).toBe('#171717');
  });

  it('contrast_color_2 = base_color.lerp(white, max(contrast, default) * 1.725)', () => {
    // t = 0.3 * 1.725 = 0.5175. 0.14 + (1 - 0.14) * 0.5175 = 0.14 + 0.44505 = 0.58505.
    // 0.58505 * 255 = 149.18 → 149 = 0x95.
    expect(theme.contrast_color_2[0]).toBeCloseTo(0.58505, 10);
    expect(toHex(theme.contrast_color_2)).toBe('#959595');
  });

  it('dark_color_3 dims the HSV value: v = lerp(0.14, 0, contrast * 0.8)', () => {
    // 0.14 * (1 - 0.24) = 0.1064 → 27.13 → 27 = 0x1b; grey keeps saturation 0.
    expect(theme.dark_color_3[0]).toBeCloseTo(0.1064, 10);
    expect(toHex(theme.dark_color_3)).toBe('#1b1b1b');
  });

  it('matches every derived value recorded in the defaults file (within one 8-bit step)', () => {
    // The file rounds some values from already-rounded hex: highlight_disabled_color red is
    // recorded as 44 (87 / 2), while the engine computes 0.34 * 0.5 * 255 = 43.35 → 43.
    for (const [key, text] of Object.entries(defaults.derived)) {
      const ours = theme[key as keyof DerivedTheme];
      expect(ours, key).toBeDefined();
      const recorded = parseColor(text);
      for (let i = 0; i < 4; i++) expect(Math.abs(ours[i]! - recorded[i]!) * 255, `${key}[${i}]`).toBeLessThanOrEqual(1);
    }
  });

  it('lerps alpha too, like Color::lerp', () => {
    expect(lerp([0, 0, 0, 0], [1, 1, 1, 1], 0.5)).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(parseColor('rgba(255,255,255,0.75)')[3]).toBe(0.75);
  });

  it('exposes CSS custom properties', () => {
    const props = themeProperties();
    expect(props['--base-color']).toBe(toHex(parseColor(defaults.interface.base_color)));
    expect(props['--dark-color-1']).toBe('#171717');
    expect(props['--code-keyword-color']).toBe(defaults.script_editor.keyword_color);
  });
});
