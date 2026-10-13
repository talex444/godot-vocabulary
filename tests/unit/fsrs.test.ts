import { describe, expect, it } from 'vitest';
import { isDue, isOverdue, newProgress, review, startOfDay, State } from '../../src/scheduler/fsrs';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const t0 = new Date(2026, 9, 13, 9, 0); // 13 Oct 2026, 09:00 local

describe('FSRS adapter (done-criteria 7)', () => {
  it('starts a new card due immediately, in the New state', () => {
    const p = newProgress('gd:keyword:var', 'gdscript', t0);
    expect(p.state).toBe(State.New);
    expect(p.due.getTime()).toBe(t0.getTime());
    expect(p).toMatchObject({ cardId: 'gd:keyword:var', family: 'gdscript', seenAt: t0, reps: 0 });
  });

  it('pushes due later after a correct answer than after a wrong one', () => {
    const p = newProgress('a', 'gdscript', t0);
    expect(review(p, true, t0).due.getTime()).toBeGreaterThan(review(p, false, t0).due.getTime());
    const learned = review(review(p, true, t0), true, new Date(t0.getTime() + 10 * MINUTE));
    const at = learned.due;
    expect(review(learned, true, at).due.getTime()).toBeGreaterThan(review(learned, false, at).due.getTime());
  });

  it('follows the library numbers: 10-minute step, then 2 days, then 11 days', () => {
    // ts-fsrs defaults: learning steps 1m and 10m, relearning step 10m, short-term scheduling on.
    const first = review(newProgress('a', 'gdscript', t0), true, t0);
    expect(first.state).toBe(State.Learning);
    expect(first.due.getTime() - t0.getTime()).toBe(10 * MINUTE);

    const second = review(first, true, first.due);
    expect(second.state).toBe(State.Review);
    const days = (second.due.getTime() - first.due.getTime()) / DAY;
    expect(days).toBeGreaterThanOrEqual(1);
    expect(days).toBeLessThanOrEqual(10);
    expect(days).toBe(2);

    const third = review(second, true, second.due);
    expect(Math.round((third.due.getTime() - second.due.getTime()) / DAY)).toBe(11);
  });

  it('sends a wrong answer after correct ones to Relearning and counts a lapse', () => {
    const first = review(newProgress('a', 'gdscript', t0), true, t0);
    const second = review(first, true, first.due);
    const lapsed = review(second, false, second.due);
    expect(lapsed.state).toBe(State.Relearning);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.due.getTime() - second.due.getTime()).toBe(10 * MINUTE);
    expect(lapsed.seenAt).toEqual(t0);
  });

  it('wrong on a brand-new card asks again after one minute', () => {
    const wrong = review(newProgress('a', 'gdscript', t0), false, t0);
    expect(wrong.state).toBe(State.Learning);
    expect(wrong.due.getTime() - t0.getTime()).toBe(MINUTE);
  });

  it('isDue compares with now; isOverdue compares with local midnight', () => {
    const p = { ...newProgress('a', 'gdscript', t0), due: new Date(2026, 9, 13, 8, 0) };
    expect(isDue(p, t0)).toBe(true);
    expect(isOverdue(p, startOfDay(t0))).toBe(false);
    const yesterday = { ...p, due: new Date(2026, 9, 12, 23, 59) };
    expect(isOverdue(yesterday, startOfDay(t0))).toBe(true);
    const later = { ...p, due: new Date(2026, 9, 13, 18, 0) };
    expect(isDue(later, t0)).toBe(false);
  });

  it('startOfDay is local midnight', () => {
    expect(startOfDay(new Date(2026, 9, 13, 23, 59, 59))).toEqual(new Date(2026, 9, 13));
  });
});
