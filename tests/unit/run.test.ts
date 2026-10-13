import { describe, expect, it } from 'vitest';
import type { Card, Family } from '../../src/cards/types';
import { newProgress, type Progress } from '../../src/scheduler/fsrs';
import { seededRng } from '../../src/session/build';
import { REASK_GAP, Session, localDate, type RunDeps } from '../../src/session/run';
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
  it('saves every answer at once and re-asks a card due again today', async () => {
    const { deps, saved } = fakeDeps(deck);
    const session = await Session.start(deps, undefined, seededRng(1));
    expect(session.total).toBe(9);
    const first = session.current!;
    await session.answer('right');
    expect(saved).toHaveLength(1);
    expect(saved[0]!.cardId).toBe(first.id);
    // Correct on a new card → Learning, due in 10 minutes → back in the queue, REASK_GAP places on.
    expect(saved[0]!.due.getTime()).toBeLessThan(new Date(2026, 9, 14).getTime());
    expect(session.total).toBe(10);
    const order: string[] = [];
    for (let i = 0; i <= REASK_GAP; i++) {
      order.push(session.current!.id);
      await session.answer('w1');
    }
    expect(order.indexOf(first.id)).toBe(REASK_GAP);
  });

  it('counts a re-asked card once and records the session date', async () => {
    const { deps, lastSession } = fakeDeps([card('github', 0)]);
    const session = await Session.start(deps, undefined, seededRng(2));
    await session.answer('w1'); // wrong → due in a minute → asked again
    expect(session.current?.id).toBe('github:0');
    await session.answer('right');
    const result = await session.finish();
    expect(result).toMatchObject({ seen: 1, right: 0, wrong: 1 });
    expect(result.dueTomorrow).toBe(1);
    expect(lastSession()).toBe(localDate(NOW));
  });

  it('asks overdue reviews first and appends new cards once they are cleared', async () => {
    const yesterday = new Date(2026, 9, 12, 9, 0, 0);
    const overdue = { ...newProgress('gdscript:0', 'gdscript', new Date(2026, 9, 1)), due: yesterday };
    const { deps } = fakeDeps(deck, [overdue]);
    const session = await Session.start(deps, undefined, seededRng(3));
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
    expect(ids).toContain('github:0');
    expect(ids).toContain('gdscript:1');
  });
});
