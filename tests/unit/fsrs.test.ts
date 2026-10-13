import { describe, expect, it } from 'vitest';
import { isDue, isOverdue, newProgress, review, startOfDay, State } from '../../src/scheduler/fsrs';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const t0 = new Date(2026, 9, 13, 9, 0); // 13 Oct 2026, 09:00 local
const days = (from: Date, to: Date) => (to.getTime() - from.getTime()) / DAY;

describe('FSRS adapter (done-criteria 7, 32)', () => {
  it('starts a new card due immediately, in the New state', () => {
    const p = newProgress('gd:keyword:var', 'gdscript', t0);
    expect(p.state).toBe(State.New);
    expect(p.due.getTime()).toBe(t0.getTime());
    expect(p).toMatchObject({ cardId: 'gd:keyword:var', family: 'gdscript', seenAt: t0, reps: 0 });
  });

  it('pushes due later after a correct answer than after a wrong one', () => {
    const p = newProgress('a', 'gdscript', t0);
    expect(review(p, true, t0).due.getTime()).toBeGreaterThan(review(p, false, t0).due.getTime());
    const learned = review(p, true, t0);
    const at = learned.due;
    expect(review(learned, true, at).due.getTime()).toBeGreaterThan(review(learned, false, at).due.getTime());
  });

  it('has no same-day step: a correct first answer is due at least a day later, straight into Review', () => {
    // ts-fsrs 5.4.2 with enable_short_term: false.
    const first = review(newProgress('a', 'gdscript', t0), true, t0);
    expect(first.state).toBe(State.Review);
    expect(days(t0, first.due)).toBeGreaterThanOrEqual(1);
    expect(days(t0, first.due)).toBe(FIRST_GOOD_DAYS);

    const second = review(first, true, first.due);
    expect(days(first.due, second.due)).toBe(SECOND_GOOD_DAYS);
    expect(days(first.due, second.due)).toBeGreaterThan(days(t0, first.due));
  });

  it('a wrong first answer is due again within about a day', () => {
    const wrong = review(newProgress('a', 'gdscript', t0), false, t0);
    expect(days(t0, wrong.due)).toBeLessThan(1.5);
    expect(days(t0, wrong.due)).toBe(FIRST_AGAIN_DAYS);
  });

  it('a wrong answer on a Review card shortens the next interval, counts a lapse, and stays in Review', () => {
    const first = review(newProgress('a', 'gdscript', t0), true, t0);
    const second = review(first, true, first.due);
    const lapsed = review(second, false, second.due);
    expect(lapsed.state).not.toBe(State.Relearning);
    expect(lapsed.lapses).toBe(1);
    expect(days(second.due, lapsed.due)).toBeLessThan(days(first.due, second.due));
    expect(days(second.due, lapsed.due)).toBe(LAPSE_DAYS);
    expect(lapsed.seenAt).toEqual(t0);
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

// The installed library's numbers, read off one run and pinned so an upgrade that changes them shows.
const FIRST_GOOD_DAYS = 3;
const SECOND_GOOD_DAYS = 14;
const FIRST_AGAIN_DAYS = 1;
const LAPSE_DAYS = 2;
