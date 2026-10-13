import { describe, expect, it } from 'vitest';
import { seededRng, type Rng } from '../../src/session/build';
import {
  GAP,
  SHOWINGS,
  answerCurrent,
  appendCards,
  currentCard,
  requeueDelay,
  showingIndex,
  startLearning,
  type LearningState,
} from '../../src/session/learning';

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

/** Runs a session to the end; `answer` decides right or wrong per showing. Returns the showing order. */
function run(state: LearningState, answer: (id: string, showing: number) => boolean) {
  const order: string[] = [];
  const grades: [string, boolean][] = [];
  const queueAt: number[] = [];
  while (currentCard(state) !== undefined) {
    const id = currentCard(state)!;
    const result = answerCurrent(state, answer(id, showingIndex(state)));
    queueAt.push(state.queue.length - 1);
    order.push(id);
    if (result.grade !== undefined) grades.push([id, result.grade]);
    state = result.state;
  }
  return { order, grades, queueAt, state };
}

describe('first-session learning queue (done-criteria 33)', () => {
  it('is due again max(8, remaining / 4) showings later', () => {
    expect(requeueDelay(100)).toBe(25);
    expect(requeueDelay(20)).toBe(GAP);
    expect(requeueDelay(5)).toBe(GAP);
    // 40 new cards: after the first answer 39 are left, 39 / 4 = 9, so nine showings in between.
    const newIds = ids('n', 40);
    const { order } = run(startLearning({ order: newIds, newIds }), () => true);
    expect(order.indexOf('n0', 1)).toBe(1 + 9);
    // n1 is due 9 slots on too; n0's repeat takes one of those slots, so ten come in between.
    expect(order.indexOf('n1', 2)).toBe(2 + 10);
  });

  it('shows every new card three times, never adjacent, spread at least min(8, queue/4) apart, over 1,000 seeded sessions', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const rng: Rng = seededRng(seed);
      const newCount = 1 + Math.floor(rng() * 30);
      const reviewCount = Math.floor(rng() * 30);
      const newIds = ids('n', newCount);
      const order = [...newIds, ...ids('r', reviewCount)].sort(() => rng() - 0.5);
      const { order: shown, queueAt } = run(startLearning({ order, newIds }), () => rng() < 0.7);
      const last = new Map<string, number>();
      shown.forEach((id, i) => {
        const before = last.get(id);
        if (before !== undefined) {
          const between = i - before - 1;
          expect(between, `seed ${seed}: ${id} adjacent`).toBeGreaterThanOrEqual(1);
          // queueAt[before] = cards left after that answer; the gap the rule promises from there.
          expect(between, `seed ${seed}: ${id}`).toBeGreaterThanOrEqual(Math.min(GAP, queueAt[before]!));
        }
        last.set(id, i);
      });
      for (const id of order.filter((x) => x.startsWith('r'))) expect(shown.filter((x) => x === id), `seed ${seed}`).toHaveLength(1);
    }
  });

  it('three showings when every answer is right', () => {
    const newIds = ids('n', 10);
    const { order } = run(startLearning({ order: newIds, newIds }), () => true);
    for (const id of newIds) expect(order.filter((x) => x === id)).toHaveLength(SHOWINGS);
    expect(order).toHaveLength(30);
  });

  it('a wrong answer brings the card back until it is answered right', () => {
    const newIds = ids('n', 10);
    // n0 is wrong on its first four showings, right on the fifth.
    const { order, state } = run(startLearning({ order: newIds, newIds }), (id, showing) => id !== 'n0' || showing >= 4);
    expect(order.filter((x) => x === 'n0')).toHaveLength(5);
    expect(state.last.get('n0')).toBe(true);
    // Right three times but wrong on the third showing: a fourth showing.
    const r = run(startLearning({ order: newIds, newIds }), (id, showing) => id !== 'n1' || showing !== 2);
    expect(r.order.filter((x) => x === 'n1')).toHaveLength(4);
  });

  it('passes only the first answer of the session to review()', () => {
    const newIds = ids('n', 10);
    const { grades } = run(startLearning({ order: newIds, newIds }), (id, showing) => showing > 0 || id === 'n3');
    expect(grades).toHaveLength(10);
    expect(new Map(grades)).toEqual(new Map(newIds.map((id) => [id, id === 'n3'])));
  });

  it('shows a review card once, right or wrong', () => {
    const { order } = run(startLearning({ order: ['r0', 'r1', 'n0'], newIds: ['n0'] }), () => false);
    expect(order.filter((x) => x === 'r0')).toHaveLength(1);
    expect(order.filter((x) => x === 'r1')).toHaveLength(1);
  });

  it('appends cards once and makes the new ones learnable', () => {
    let state = startLearning({ order: ['r0'], newIds: [] });
    state = appendCards(state, ['r0', 'n0', 'n1'], ['n0', 'n1']);
    expect(state.queue).toEqual(['r0', 'n0', 'n1']);
    expect(state.newIds.has('n0')).toBe(true);
  });

  it('prints a 10-card session trace', () => {
    const newIds = ids('c', 10);
    const rng = seededRng(42);
    const { order, grades } = run(startLearning({ order: newIds, newIds }), () => rng() < 0.75);
    const first = new Map(grades);
    const trace = order.map((id, i) => `${i + 1}:${id}`).join(' ');
    console.log(`10-card trace (first answers ${[...first].map(([k, v]) => `${k}${v ? '✓' : '✗'}`).join(' ')}):\n${trace}`);
    expect(order.length).toBeGreaterThanOrEqual(30);
  });
});
