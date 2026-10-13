import { FAMILIES, type Card, type Family } from '../cards/types';
import { isDue, isOverdue, startOfDay, type Progress } from '../scheduler/fsrs';
import type { Settings } from '../settings/load';

/** Returns a float in [0, 1), like Math.random. */
export type Rng = () => number;

/** Small seeded generator (mulberry32) so a session order can be reproduced in tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SessionInput {
  /** Every card: the three generated families plus the learner's custom cards. */
  cards: readonly Card[];
  progress: ReadonlyMap<string, Progress>;
  settings: Settings;
  now: Date;
}

export interface FamilySummary {
  enabled: boolean;
  /** Reviews due now. */
  due: number;
  /** Of those, due before local midnight today. */
  overdue: number;
  /** New cards that today's session would introduce. */
  newAvailable: number;
}

interface Plan {
  reviews: Card[];
  fresh: Card[];
  overdue: Card[];
}

function plan({ cards, progress, settings, now }: SessionInput): Plan {
  const today = startOfDay(now);
  const enabled = cards.filter((c) => settings.families[c.family]?.enabled);
  const reviews: Card[] = [];
  const overdue: Card[] = [];
  for (const card of enabled) {
    const p = progress.get(card.id);
    if (!p) continue;
    if (isDue(p, now)) reviews.push(card);
    if (isOverdue(p, today)) overdue.push(card);
  }
  // Overdue reviews come first: no new cards until they are cleared (decision 21).
  const fresh = overdue.length > 0 ? [] : FAMILIES.flatMap((family) => newCards(family, enabled, progress, settings, today));
  return { reviews, fresh, overdue };
}

/** The first unseen cards of one family by rank, within what is left of today's budget. */
function newCards(
  family: Family,
  cards: readonly Card[],
  progress: ReadonlyMap<string, Progress>,
  settings: Settings,
  today: Date,
): Card[] {
  const budget = settings.families[family];
  if (!budget?.enabled) return [];
  let introducedToday = 0;
  for (const p of progress.values()) if (p.family === family && p.seenAt.getTime() >= today.getTime()) introducedToday++;
  const left = Math.max(0, budget.newPerDay - introducedToday);
  if (left === 0) return [];
  return cards
    .filter((c) => c.family === family && !progress.has(c.id))
    // A member card waits until its class card has been seen in an earlier session.
    .filter((c) => !c.requires || progress.has(c.requires))
    .sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, left);
}

/** Today's session: due reviews and new cards from every enabled family, shuffled together. */
export function buildSession(input: SessionInput, rng: Rng): string[] {
  const { reviews, fresh } = plan(input);
  return interleave([...reviews, ...fresh], rng).map((c) => c.id);
}

/** Counts per family for the start screen. */
export function sessionSummary(input: SessionInput): Record<Family, FamilySummary> {
  const { reviews, fresh, overdue } = plan(input);
  const count = (list: Card[], family: Family) => list.filter((c) => c.family === family).length;
  const summary = {} as Record<Family, FamilySummary>;
  for (const family of FAMILIES) {
    summary[family] = {
      enabled: input.settings.families[family].enabled,
      due: count(reviews, family),
      overdue: count(overdue, family),
      newAvailable: count(fresh, family),
    };
  }
  return summary;
}

/** The shortest same-family run any order of these items can keep to: ceil(biggest / (rest + 1)). */
export function runLimit(items: readonly { family: Family }[]): number {
  const counts = new Map<Family, number>();
  for (const { family } of items) counts.set(family, (counts.get(family) ?? 0) + 1);
  const biggest = Math.max(0, ...counts.values());
  return Math.max(1, Math.ceil(biggest / (items.length - biggest + 1)));
}

/**
 * Shuffle, then deal the cards out family by family: each step draws a family at random, weighted
 * by how many cards it has left, never extends a run past `runLimit`, and is forced to the biggest
 * family only when leaving it would make a longer run unavoidable later.
 */
export function interleave<T extends { family: Family }>(items: readonly T[], rng: Rng): T[] {
  const limit = runLimit(items);
  const queues = new Map<Family, T[]>();
  for (const item of shuffle(items, rng)) {
    const queue = queues.get(item.family) ?? [];
    queue.push(item);
    queues.set(item.family, queue);
  }
  const out: T[] = [];
  let previous: Family | undefined;
  let run = 0;
  for (let left = items.length; left > 0; left--) {
    const open = [...queues].filter(([, q]) => q.length > 0);
    const allowed = open.filter(([f]) => f !== previous || run < limit);
    const candidates = allowed.length > 0 ? allowed : open;
    const [biggest] = [...candidates].sort((a, b) => b[1].length - a[1].length);
    const pick = biggest![1].length > limit * (left - biggest![1].length) ? biggest![0] : weighted(candidates, rng);
    out.push(queues.get(pick)!.shift()!);
    run = pick === previous ? run + 1 : 1;
    previous = pick;
  }
  return out;
}

function weighted<T>(entries: [Family, T[]][], rng: Rng): Family {
  const total = entries.reduce((sum, [, q]) => sum + q.length, 0);
  let r = rng() * total;
  for (const [family, q] of entries) {
    r -= q.length;
    if (r < 0) return family;
  }
  return entries[entries.length - 1]![0];
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
