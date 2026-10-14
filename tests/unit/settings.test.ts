import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  projectedReviewsPerDay,
  totalNewPerDay,
  warningAboveTwenty,
  withDefaults,
  type Settings,
} from '../../src/settings/load';

function settings(api: number, gd: number, gh: number, enabled = [true, true, true]): Settings {
  return {
    families: {
      'godot-api': { enabled: enabled[0]!, newPerDay: api },
      gdscript: { enabled: enabled[1]!, newPerDay: gd },
      github: { enabled: enabled[2]!, newPerDay: gh },
    },
    retention: 0.9,
    areas: { godot: { newCardMode: 'frequency' }, github: { newCardMode: 'frequency' } },
  };
}

describe('settings maths', () => {
  it('defaults to 10/5/5, all enabled, retention 0.9', () => {
    expect(DEFAULT_SETTINGS).toEqual(settings(10, 5, 5));
    expect(totalNewPerDay(DEFAULT_SETTINGS)).toBe(20);
    expect(projectedReviewsPerDay(DEFAULT_SETTINGS)).toBe(200);
    expect(warningAboveTwenty(DEFAULT_SETTINGS)).toBe(false);
  });

  it('counts only enabled families', () => {
    expect(totalNewPerDay(settings(10, 5, 5, [true, false, true]))).toBe(15);
    expect(projectedReviewsPerDay(settings(10, 5, 5, [false, false, false]))).toBe(0);
  });

  it('warns only above twenty, and still accepts the value', () => {
    expect(warningAboveTwenty(settings(10, 5, 6))).toBe(true);
    expect(totalNewPerDay(settings(10, 5, 6))).toBe(21);
    expect(warningAboveTwenty(settings(30, 5, 5, [false, true, true]))).toBe(false);
  });

  it('fills missing families from the defaults without sharing objects', () => {
    const filled = withDefaults({ families: { gdscript: { enabled: false, newPerDay: 2 } } } as Partial<Settings>);
    expect(filled).toEqual(settings(10, 2, 5, [true, false, true]));
    filled.families['godot-api'].newPerDay = 99;
    expect(DEFAULT_SETTINGS.families['godot-api'].newPerDay).toBe(10);
    filled.areas.godot.newCardMode = 'course';
    expect(DEFAULT_SETTINGS.areas.godot.newCardMode).toBe('frequency');
  });
});

describe('per-area new-card mode (export v4)', () => {
  it('builds every area from the registry, never from the stored keys', () => {
    const filled = withDefaults({ areas: { github: { newCardMode: 'course' }, aseprite: { newCardMode: 'course' } } });
    expect(filled.areas).toEqual({ godot: { newCardMode: 'frequency' }, github: { newCardMode: 'course' } });
  });

  it('carries an older global course mode to the areas that had a course (Godot) only', () => {
    expect(withDefaults({ newCardMode: 'course' }).areas).toEqual({ godot: { newCardMode: 'course' }, github: { newCardMode: 'frequency' } });
    expect(withDefaults({ newCardMode: 'frequency' }).areas.godot.newCardMode).toBe('frequency');
    // Once a file has areas, a stray global flag is ignored.
    expect(withDefaults({ newCardMode: 'course', areas: {} }).areas.godot.newCardMode).toBe('frequency');
  });
});
