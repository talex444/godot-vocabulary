import { describe, expect, it } from 'vitest';
import type { AreaId } from '../../src/areas/registry';
import type { Card, Family } from '../../src/cards/types';
import api from '../../src/data/cards.godot-api.json';
import gdscript from '../../src/data/cards.gdscript.json';
import github from '../../src/data/cards.github.json';
import { newProgress, review, type Progress } from '../../src/scheduler/fsrs';
import {
  buildSession,
  dueCount,
  interleave,
  planSession,
  runLimit,
  seededRng,
  sessionSummary,
  type Lesson,
  type SessionInput,
} from '../../src/session/build';
import { DEFAULT_SETTINGS, type Settings } from '../../src/settings/load';

const DAY = 24 * 60 * 60_000;
const now = new Date(2026, 9, 13, 9, 0);
const yesterday = new Date(now.getTime() - DAY);

function card(family: Family, n: number, extra: Partial<Card> = {}): Card {
  return {
    id: `${family}:${n}`,
    family,
    kind: 'term',
    prompt: `p${n}`,
    answer: `a${n}`,
    distractors: ['x', 'y', 'z'],
    explain: 'e',
    source: { doc: 'test', ref: 'test', version: '1' },
    rank: n,
    ...extra,
  };
}

const deck: Card[] = (['godot-api', 'gdscript', 'github'] as Family[]).flatMap((f) =>
  Array.from({ length: 30 }, (_, i) => card(f, i)),
);

function settings(change?: (s: Settings) => void): Settings {
  const s = structuredClone(DEFAULT_SETTINGS);
  change?.(s);
  return s;
}

/** A progress record first seen on `seenAt` and due at `due`. */
function seen(id: string, family: Family, seenAt: Date, due: Date): Progress {
  return { ...newProgress(id, family, seenAt), due };
}

function input(progress: Progress[] = [], s = settings(), cards = deck, area: AreaId = 'godot'): SessionInput {
  return { area, cards, progress: new Map(progress.map((p) => [p.cardId, p])), settings: s, now };
}

/** The same input in the Git & GitHub area. */
const inGithub = (i: SessionInput): SessionInput => ({ ...i, area: 'github' });

const familyOf = (id: string) => id.split(':')[0] as Family;

describe('new cards (done-criteria 10)', () => {
  it('introduces the first newPerDay unseen cards of each family, in rank order', () => {
    const ids = [...buildSession(input(), seededRng(1)), ...buildSession(inGithub(input()), seededRng(1))];
    expect(ids).toHaveLength(20);
    const pick = (f: Family) => ids.filter((id) => familyOf(id) === f).sort((a, b) => Number(a.split(':')[1]) - Number(b.split(':')[1]));
    expect(pick('godot-api')).toEqual(Array.from({ length: 10 }, (_, i) => `godot-api:${i}`));
    expect(pick('gdscript')).toEqual(['gdscript:0', 'gdscript:1', 'gdscript:2', 'gdscript:3', 'gdscript:4']);
    expect(pick('github')).toHaveLength(5);
  });

  it('skips seen cards and counts cards first seen today against the budget', () => {
    const progress = [
      seen('gdscript:0', 'gdscript', yesterday, new Date(now.getTime() + DAY)),
      seen('gdscript:1', 'gdscript', new Date(2026, 9, 13, 7, 0), new Date(now.getTime() + DAY)),
      seen('gdscript:2', 'gdscript', new Date(2026, 9, 13, 8, 0), new Date(now.getTime() + DAY)),
    ];
    const ids = buildSession(input(progress), seededRng(1)).filter((id) => familyOf(id) === 'gdscript');
    expect(ids.sort()).toEqual(['gdscript:3', 'gdscript:4', 'gdscript:5']);
  });

  it('holds a member card back until its class card was seen in an earlier session', () => {
    const cards = [card('godot-api', 0), card('godot-api', 1, { requires: 'godot-api:0' }), card('godot-api', 2)];
    const s = settings((x) => (x.families['godot-api'].newPerDay = 3));
    expect(buildSession(input([], s, cards), seededRng(1)).sort()).toEqual(['godot-api:0', 'godot-api:2']);
    const later = [seen('godot-api:0', 'godot-api', yesterday, new Date(now.getTime() + DAY))];
    expect(buildSession(input(later, s, cards), seededRng(1)).sort()).toEqual(['godot-api:1', 'godot-api:2']);
  });

  it('never shows an API member before its class over two weeks of real sessions', () => {
    const cards = [...api, ...gdscript, ...github] as Card[];
    const byId = new Map(cards.map((c) => [c.id, c]));
    const progress = new Map<string, Progress>();
    for (let day = 0; day < 14; day++) {
      const at = new Date(2026, 9, 13 + day, 9, 0);
      const ids = (['godot', 'github'] as const).flatMap((area) => buildSession({ area, cards, progress, settings: settings(), now: at }, seededRng(day)));
      for (const id of ids) {
        const c = byId.get(id)!;
        if (c.requires) expect(progress.has(c.requires), `${id} on day ${day}`).toBe(true);
      }
      for (const id of ids) {
        const c = byId.get(id)!;
        const p = progress.get(id) ?? newProgress(id, c.family, at);
        progress.set(id, review(p, true, at));
      }
    }
    expect([...progress.values()].some((p) => byId.get(p.cardId)!.requires)).toBe(true);
  });

  it('adds custom cards as new cards of their family', () => {
    const mine = card('github', -1, { id: 'custom:1' });
    const ids = buildSession(input([], settings(), [...deck, mine], 'github'), seededRng(1));
    expect(ids).toContain('custom:1');
    expect(buildSession(input([], settings(), [...deck, mine]), seededRng(1))).not.toContain('custom:1');
  });
});

describe('areas (decision 46; done-criteria 63)', () => {
  it('a Godot session never holds a GitHub card, and a GitHub session only GitHub cards', () => {
    const reviews = [seen('github:20', 'github', yesterday, new Date(2026, 9, 13, 8, 0)), seen('godot-api:20', 'godot-api', yesterday, new Date(2026, 9, 13, 8, 0))];
    for (let seed = 0; seed < 20; seed++) {
      expect(buildSession(input(reviews), seededRng(seed)).filter((id) => familyOf(id) === 'github')).toEqual([]);
      expect(new Set(buildSession(inGithub(input(reviews)), seededRng(seed)).map(familyOf))).toEqual(new Set(['github']));
    }
  });

  it('with every family on and nothing overdue, the Godot plan is today’s mixed plan minus its GitHub cards', () => {
    // Today's (pre-area) plan for this input, recorded from the mixed builder: the first ten API
    // cards, the first five GDScript cards, five GitHub cards, and the due review godot-api:20.
    const todays = ['godot-api:20', ...Array.from({ length: 10 }, (_, i) => `godot-api:${i}`), ...Array.from({ length: 5 }, (_, i) => `gdscript:${i}`)];
    const reviews = [seen('godot-api:20', 'godot-api', yesterday, new Date(2026, 9, 13, 8, 0))];
    expect(buildSession(input(reviews), seededRng(5)).sort()).toEqual(todays.sort());
  });

  it('the same holds on the real decks: the area plans split today’s plan between them', () => {
    const cards = [...api, ...gdscript, ...github] as Card[];
    const s = settings();
    const godotPlan = buildSession({ area: 'godot', cards, progress: new Map(), settings: s, now }, seededRng(1));
    const githubPlan = buildSession({ area: 'github', cards, progress: new Map(), settings: s, now }, seededRng(1));
    const byId = new Map(cards.map((c) => [c.id, c]));
    expect(godotPlan).toHaveLength(15);
    expect(githubPlan).toHaveLength(5);
    expect(godotPlan.every((id) => byId.get(id)!.family !== 'github')).toBe(true);
    // Rank order within each family, as the mixed builder chose them.
    const firstByRank = (f: Family, n: number) => cards.filter((c) => c.family === f && !c.requires).sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1)).slice(0, n).map((c) => c.id);
    expect(godotPlan.filter((id) => byId.get(id)!.family === 'gdscript').sort()).toEqual(firstByRank('gdscript', 5).sort());
    expect(githubPlan.sort()).toEqual(firstByRank('github', 5).sort());
  });

  it('Godot offers new cards while only GitHub reviews are overdue (decision 21, amended)', () => {
    const progress = [seen('github:0', 'github', yesterday, new Date(2026, 9, 12, 8, 0))];
    expect(buildSession(input(progress), seededRng(1))).toHaveLength(15);
    expect(sessionSummary(input(progress))['godot-api']).toEqual({ enabled: true, due: 0, overdue: 0, newAvailable: 10 });
    // The GitHub area itself waits behind its overdue review.
    expect(buildSession(inGithub(input(progress)), seededRng(1))).toEqual(['github:0']);
  });

  it('dueCount counts due progress of the given families, skips left out', () => {
    const progress = new Map(
      [
        seen('github:0', 'github', yesterday, new Date(2026, 9, 12, 8, 0)),
        seen('github:1', 'github', yesterday, new Date(2026, 9, 13, 8, 0)),
        seen('github:2', 'github', yesterday, new Date(2026, 9, 14, 8, 0)),
        seen('gdscript:0', 'gdscript', yesterday, new Date(2026, 9, 13, 8, 0)),
      ].map((p) => [p.cardId, p]),
    );
    expect(dueCount(progress, undefined, ['github'], now)).toBe(2);
    expect(dueCount(progress, new Set(['github:0']), ['github'], now)).toBe(1);
    expect(dueCount(progress, undefined, ['godot-api', 'gdscript'], now)).toBe(1);
  });
});

describe('reviews and overdue (done-criteria 11)', () => {
  it('includes every enabled card due now and nothing that is not due yet', () => {
    const progress = [
      seen('github:0', 'github', yesterday, new Date(2026, 9, 13, 8, 0)),
      seen('github:1', 'github', yesterday, new Date(2026, 9, 13, 10, 0)),
    ];
    const ids = buildSession(input(progress, settings(), deck, 'github'), seededRng(1));
    expect(ids).toContain('github:0');
    expect(ids).not.toContain('github:1');
    // Due earlier today is not overdue, so the area's 5 new cards still come.
    expect(ids).toHaveLength(6);
  });

  it('introduces zero new cards in the area while any of its reviews is overdue', () => {
    const progress = [seen('gdscript:0', 'gdscript', yesterday, new Date(2026, 9, 12, 23, 0))];
    const ids = buildSession(input(progress), seededRng(1));
    expect(ids).toEqual(['gdscript:0']);
    const summary = sessionSummary(input(progress));
    expect(summary.gdscript).toEqual({ enabled: true, due: 1, overdue: 1, newAvailable: 0 });
    expect(summary['godot-api']!.newAvailable).toBe(0);
  });

  it('lets new cards back in once the overdue set is cleared', () => {
    const cleared = [seen('gdscript:0', 'gdscript', yesterday, new Date(now.getTime() + 2 * DAY))];
    expect(buildSession(input(cleared), seededRng(1))).toHaveLength(15);
  });

  it('ignores disabled families for reviews, overdue and new cards', () => {
    const s = settings((x) => (x.families.github.enabled = false));
    const progress = [seen('github:0', 'github', yesterday, new Date(2026, 9, 12, 8, 0))];
    expect(buildSession(input(progress, s, deck, 'github'), seededRng(1))).toEqual([]);
    expect(buildSession(input(progress, s), seededRng(1))).toHaveLength(15);
    expect(sessionSummary(input(progress, s, deck, 'github')).github).toEqual({ enabled: false, due: 0, overdue: 0, newAvailable: 0 });
  });
});

describe('interleaving (done-criteria 9)', () => {
  function longestRun(ids: string[]): number {
    let best = 0;
    let run = 0;
    ids.forEach((id, i) => {
      run = i > 0 && familyOf(id) === familyOf(ids[i - 1]!) ? run + 1 : 1;
      best = Math.max(best, run);
    });
    return best;
  }

  it('mixes reviews and new cards from every family of the area, never grouped by family', () => {
    const reviews = [0, 1, 2, 3].map((i) => seen(`gdscript:${20 + i}`, 'gdscript', yesterday, new Date(2026, 9, 13, 8, 0)));
    for (let seed = 0; seed < 200; seed++) {
      const ids = buildSession(input(reviews), seededRng(seed));
      expect(ids).toHaveLength(19);
      expect(new Set(ids.map(familyOf)).size).toBe(2);
      expect(longestRun(ids), `seed ${seed}`).toBeLessThan(ids.length / 2);
      // 10 API cards against 9 GDScript cards: runs of two are the best any order can do.
      expect(longestRun(ids), `seed ${seed}`).toBeLessThanOrEqual(2);
    }
  });

  it('never runs longer than the smallest possible limit, whatever the family sizes', () => {
    const sizes: [number, number, number][] = [[10, 5, 5], [1, 1, 1], [20, 2, 1], [3, 9, 4], [0, 6, 6], [7, 0, 0]];
    for (const [a, g, h] of sizes) {
      const items = [
        ...deck.filter((c) => c.family === 'godot-api').slice(0, a),
        ...deck.filter((c) => c.family === 'gdscript').slice(0, g),
        ...deck.filter((c) => c.family === 'github').slice(0, h),
      ];
      const limit = runLimit(items);
      expect(limit).toBe(Math.max(1, Math.ceil(Math.max(a, g, h) / (a + g + h - Math.max(a, g, h) + 1))));
      for (let seed = 0; seed < 100; seed++) {
        const ids = interleave(items, seededRng(seed)).map((c) => c.id);
        expect(longestRun(ids), `${a}/${g}/${h} seed ${seed}`).toBeLessThanOrEqual(limit);
      }
    }
  });

  it('is reproducible for a seed and differs between seeds', () => {
    expect(buildSession(input(), seededRng(7))).toEqual(buildSession(input(), seededRng(7)));
    expect(buildSession(input(), seededRng(7))).not.toEqual(buildSession(input(), seededRng(8)));
  });

  it('keeps every item exactly once', () => {
    const items = deck.slice(0, 50);
    const out = interleave(items, seededRng(3));
    expect([...out].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...items].sort((a, b) => a.id.localeCompare(b.id)));
  });
});

describe('plan, course mode and skips (done-criteria 33, 37, 39)', () => {
  it('marks the new cards in the plan, not the reviews', () => {
    const progress = [seen('github:0', 'github', yesterday, new Date(2026, 9, 13, 8, 0))];
    const plan = planSession(inGithub(input(progress)), seededRng(1));
    expect(plan.order).toHaveLength(6);
    expect(plan.newIds).toHaveLength(5);
    expect(plan.newIds).not.toContain('github:0');
  });

  it('in course mode puts the unseen cards of finished lessons first, then frequency order', () => {
    const s = settings((x) => (x.areas.godot.newCardMode = 'course'));
    const lessons: Lesson[] = [
      { id: 'l1', title: 'One', topic: 'Signals', cardIds: ['godot-api:20', 'godot-api:25', 'gdscript:9'] },
      { id: 'l2', title: 'Two', topic: 'UI', cardIds: ['godot-api:28'] },
    ];
    const progress = [seen('godot-api:25', 'godot-api', yesterday, new Date(now.getTime() + DAY))];
    const plan = planSession({ ...input(progress, s), lessons, lessonsDone: ['l1'] }, seededRng(1));
    const api = plan.newIds.filter((id) => familyOf(id) === 'godot-api');
    expect(api).toEqual(['godot-api:20', ...Array.from({ length: 9 }, (_, i) => `godot-api:${i}`)]);
    expect(plan.newIds.filter((id) => familyOf(id) === 'gdscript')[0]).toBe('gdscript:9');
    expect(plan.newIds).not.toContain('godot-api:28'); // lesson l2 is not done
    // Frequency mode ignores the lessons.
    const frequency = planSession({ ...input(progress), lessons, lessonsDone: ['l1'] }, seededRng(1));
    expect(frequency.newIds).not.toContain('godot-api:20');
  });

  it('leaves skipped cards out of reviews, new cards and the overdue gate', () => {
    const overdue = [seen('gdscript:0', 'gdscript', yesterday, new Date(2026, 9, 12, 23, 0))];
    const skipped = new Set(['gdscript:0', 'godot-api:0', 'github:3']);
    const plan = planSession({ ...input(overdue), skipped }, seededRng(1));
    expect(plan.order).toHaveLength(15);
    for (const id of skipped) expect(plan.order).not.toContain(id);
    expect(plan.order).toContain('godot-api:10');
    expect(planSession(inGithub({ ...input(overdue), skipped }), seededRng(1)).order).not.toContain('github:3');
    expect(sessionSummary({ ...input(overdue), skipped }).gdscript!.overdue).toBe(0);
  });
});

describe('sessionSummary', () => {
  it('counts due, overdue and new cards per family of the area, and only those', () => {
    const progress = [seen('github:0', 'github', yesterday, new Date(2026, 9, 13, 8, 0))];
    expect(sessionSummary(input(progress))).toEqual({
      'godot-api': { enabled: true, due: 0, overdue: 0, newAvailable: 10 },
      gdscript: { enabled: true, due: 0, overdue: 0, newAvailable: 5 },
    });
    expect(sessionSummary(inGithub(input(progress)))).toEqual({
      github: { enabled: true, due: 1, overdue: 0, newAvailable: 5 },
    });
  });
});
