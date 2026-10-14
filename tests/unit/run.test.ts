import { describe, expect, it } from 'vitest';
import type { Card, Family } from '../../src/cards/types';
import { newProgress, type Progress } from '../../src/scheduler/fsrs';
import { seededRng } from '../../src/session/build';
import { GAP } from '../../src/session/learning';
import { Session, localDate, type RunDeps } from '../../src/session/run';
import { withDefaults } from '../../src/settings/load';

const NOW = new Date(2026, 9, 13, 12, 0, 0);

function card(family: Family, i: number): Card {
  return {
    id: `${family}:${i}`,
    family,
    kind: 'term',
    prompt: `prompt ${i}`,
    answer: 'right',
    distractors: ['w1', 'w2', 'w3'],
    explain: 'because',
    source: { doc: 'test', ref: String(i), version: '1' },
    rank: i,
  };
}

function fakeDeps(cards: Card[], progress: Progress[] = []) {
  const saved: Progress[] = [];
  let clock = NOW.getTime();
  let lastSession: string | undefined;
  const deps: RunDeps = {
    loadCards: async () => cards,
    getProgress: async () => new Map(progress.map((p) => [p.cardId, p])),
    getSettings: async () => withDefaults({ families: { 'godot-api': { enabled: true, newPerDay: 3 }, gdscript: { enabled: true, newPerDay: 3 }, github: { enabled: true, newPerDay: 3 } } }),
    saveProgress: async (p) => {
      saved.push(p);
    },
    setLastSessionDate: async (d) => {
      lastSession = d;
    },
    now: () => new Date((clock += 1000)),
  };
  return { deps, saved, lastSession: () => lastSession };
}

const deck = (['godot-api', 'gdscript', 'github'] as Family[]).flatMap((f) => [0, 1, 2, 3, 4].map((i) => card(f, i)));

describe('live session flow', () => {
  it('saves the first answer at once, repeats a new card GAP places on, and never saves a repeat', async () => {
    const { deps, saved } = fakeDeps(deck);
    // Nine new cards in the Godot area, so a repeat has GAP cards to wait behind.
    deps.getSettings = async () => withDefaults({ families: { 'godot-api': { enabled: true, newPerDay: 5 }, gdscript: { enabled: true, newPerDay: 4 }, github: { enabled: true, newPerDay: 3 } } });
    const session = await Session.start(deps, 'godot', undefined, seededRng(1));
    expect(session.total).toBe(9);
    const first = session.current!;
    await session.answer('right');
    expect(saved).toHaveLength(1);
    expect(saved[0]!.cardId).toBe(first.id);
    // A new card comes back for its second showing, after the eight other cards (GAP = 8).
    expect(session.total).toBe(10);
    const order: string[] = [];
    while (session.current && session.current.id !== first.id) {
      order.push(session.current.id);
      await session.answer('right');
    }
    expect(order).toHaveLength(GAP);
    const savesBefore = saved.length;
    expect(session.showing).toBe(1);
    await session.answer('w1');
    expect(saved).toHaveLength(savesBefore);
  });

  it('counts a repeated card once by its first answer and records the session date', async () => {
    const { deps, lastSession } = fakeDeps([card('github', 0), card('github', 1)]);
    const session = await Session.start(deps, 'github', undefined, seededRng(2));
    const firstId = session.current!.id;
    await session.answer('w1');
    await session.answer('right');
    expect(session.current?.id).toBe(firstId); // the other card sat between: never adjacent
    await session.answer('right');
    const result = await session.finish();
    // Neither card reached three showings with the last one right.
    expect(result).toMatchObject({ seen: 2, right: 1, wrong: 1, learned: 0, continueTomorrow: 2 });
    // Graded by first answers: the wrong one is due tomorrow, the right one in three days.
    expect(result.dueTomorrow).toBe(1);
    expect(lastSession()).toBe(localDate(NOW));
  });

  it('checks a flipped showing against its description and leaves skipped cards out', async () => {
    const cards = [0, 1, 2, 3, 4].map((i) => ({
      ...card('github', i),
      answer: `a${i}`,
      prompt: `description ${i}`,
      distractorPool: [0, 1, 2, 3, 4].filter((j) => j !== i).map((j) => `a${j}`),
      distractorIds: [0, 1, 2, 3, 4].filter((j) => j !== i).map((j) => `github:${j}`),
    }));
    const skipped: string[] = [];
    const { deps } = fakeDeps(cards);
    deps.skipCard = async (id) => void skipped.push(id);
    const session = await Session.start(deps, 'github', undefined, seededRng(4));
    await session.skip('wrong docs');
    expect(skipped).toHaveLength(1);
    const seen = new Set<string>();
    while (session.current) {
      const c = session.current;
      const draw = session.draw()!;
      expect(c.id).not.toBe(skipped[0]);
      if (session.showing === 1) expect(draw.direction).toBe('flipped');
      seen.add(c.id);
      await session.answer(draw.choices.find((x) => x.correct)!.text);
    }
    expect(seen.size).toBe(2); // newPerDay 3, one of them skipped
  });

  it('asks overdue reviews first and appends new cards once they are cleared', async () => {
    const yesterday = new Date(2026, 9, 12, 9, 0, 0);
    const overdue = { ...newProgress('gdscript:0', 'gdscript', new Date(2026, 9, 1)), due: yesterday };
    const { deps } = fakeDeps(deck, [overdue]);
    const session = await Session.start(deps, 'godot', undefined, seededRng(3));
    expect(session.total).toBe(1);
    expect(session.current?.id).toBe('gdscript:0');
    await session.answer('right');
    // The overdue set is clear: the builder ran again and the new cards follow (plus the re-ask).
    const ids: string[] = [];
    while (session.current && ids.length < 40) {
      ids.push(session.current.id);
      await session.answer('right');
    }
    expect(ids).toContain('godot-api:0');
    expect(ids).toContain('gdscript:1');
    expect(ids.some((id) => id.startsWith('github:'))).toBe(false);
  });

  it('a GitHub session is not held back by an overdue Godot review (decision 21, amended)', async () => {
    const overdue = { ...newProgress('gdscript:0', 'gdscript', new Date(2026, 9, 1)), due: new Date(2026, 9, 12, 9, 0, 0) };
    const { deps } = fakeDeps(deck, [overdue]);
    const session = await Session.start(deps, 'github', undefined, seededRng(3));
    expect(session.total).toBe(3);
    expect(session.current?.family).toBe('github');
    const result = await session.finish();
    expect(result.dueTomorrow).toBe(0); // the Godot review is not this area's
  });
});
