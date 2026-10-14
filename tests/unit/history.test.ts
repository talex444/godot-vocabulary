import { describe, expect, it } from 'vitest';
import { readEntry } from '../../src/ui/app';

// Decision 50 and the security note: a history entry is read back from outside the app's control, so
// anything unknown, tampered or left by another page load reads as the home page.

const page = 'p1';

describe('history entries read back', () => {
  it('keep a known screen and area', () => {
    expect(readEntry({ screen: 'courses', area: 'github', index: 2, page }, page)).toEqual({ screen: 'courses', area: 'github', index: 2 });
    expect(readEntry({ screen: 'lesson', area: 'godot', lesson: 'c1-l3', index: 3, page }, page)).toEqual({ screen: 'lesson', area: 'godot', lesson: 'c1-l3', index: 3 });
    // A lesson opened from its home tile keeps that, so its Back is labelled for the area page (decision 66).
    expect(readEntry({ screen: 'lesson', area: 'godot', lesson: 'c1-l0', fromHome: true, index: 2, page }, page)).toEqual({ screen: 'lesson', area: 'godot', lesson: 'c1-l0', fromHome: true, index: 2 });
    expect(readEntry({ screen: 'lesson', area: 'godot', lesson: 'c1-l0', fromHome: 'yes', index: 2, page }, page)).toEqual({ screen: 'lesson', area: 'godot', lesson: 'c1-l0', index: 2 });
    // About opened from the home page has no area and wears the home theme.
    expect(readEntry({ screen: 'about', index: 1, page }, page)).toEqual({ screen: 'about', index: 1 });
  });

  it('read anything unknown as the home page', () => {
    const home = { screen: 'home', index: 0 };
    expect(readEntry(null, page)).toEqual(home);
    expect(readEntry('courses', page)).toEqual(home);
    expect(readEntry({ screen: 'courses', area: 'aseprite', index: 2, page }, page)).toEqual({ ...home, index: 2 });
    expect(readEntry({ screen: '__proto__', area: 'godot', index: 1, page }, page)).toEqual({ ...home, index: 1 });
    expect(readEntry({ screen: 'area', area: 'godot', index: -4, page }, page)).toEqual({ screen: 'area', area: 'godot', index: 0 });
    // An entry from an earlier page load.
    expect(readEntry({ screen: 'area', area: 'godot', index: 1, page: 'p0' }, page)).toEqual(home);
  });

  it('a lesson id that is not a plain id falls back to the area page', () => {
    expect(readEntry({ screen: 'lesson', area: 'godot', lesson: '<img src=x>', index: 3, page }, page)).toEqual({ screen: 'area', area: 'godot', index: 3 });
  });
});
