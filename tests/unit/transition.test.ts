import { describe, expect, it } from 'vitest';
import { shouldAnimate } from '../../src/ui/transition';

// Decision 51: the wipe runs only where the View Transitions API exists and motion is not reduced.

describe('the theme switch', () => {
  it('animates only when supported and motion is not reduced', () => {
    expect(shouldAnimate(true, false)).toBe(true);
    expect(shouldAnimate(true, true)).toBe(false);
    expect(shouldAnimate(false, false)).toBe(false);
    expect(shouldAnimate(false, true)).toBe(false);
  });
});
