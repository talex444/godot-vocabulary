import { FAMILIES, type Card, type Family } from '../cards/types';
import { isOverdue, newProgress, review, startOfDay, type Progress } from '../scheduler/fsrs';
import type { Settings } from '../settings/load';
import { buildSession, seededRng, type FamilySummary, type Rng } from './build';

/** What the flow needs from the device; `src/session/deck.ts` wires the real store. */
export interface RunDeps {
  loadCards(): Promise<Card[]>;
  getProgress(): Promise<Map<string, Progress>>;
  getSettings(): Promise<Settings>;
  saveProgress(progress: Progress): Promise<void>;
  setLastSessionDate(date: string): Promise<void>;
  now(): Date;
}

export interface Loaded {
  cards: Card[];
  progress: Map<string, Progress>;
  settings: Settings;
}

export interface SessionResult {
  seen: number;
  right: number;
  wrong: number;
  /** Cards from enabled families due before the end of tomorrow. */
  dueTomorrow: number;
}

/** A re-asked card goes back at least this many places later in the queue. */
export const REASK_GAP = 3;

function addDays(day: Date, days: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + days);
}

/** `YYYY-MM-DD` in local time. */
export function localDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export async function load(deps: RunDeps): Promise<Loaded> {
  const [cards, progress, settings] = await Promise.all([deps.loadCards(), deps.getProgress(), deps.getSettings()]);
  return { cards, progress, settings };
}

/** Why Start cannot begin, in plain words; `undefined` when there is something to do. */
export function startBlockedReason(summary: Record<Family, FamilySummary>, loaded: Loaded): string | undefined {
  const enabled = FAMILIES.filter((f) => summary[f].enabled);
  if (enabled.length === 0) return 'Every card family is switched off. Turn one on in Settings.';
  const due = enabled.reduce((n, f) => n + summary[f].due, 0);
  const fresh = enabled.reduce((n, f) => n + summary[f].newAvailable, 0);
  if (due + fresh > 0) return undefined;
  const unseen = loaded.cards.some((c) => summary[c.family].enabled && !loaded.progress.has(c.id));
  return unseen
    ? 'Nothing is due, and today’s new cards are done. Come back tomorrow.'
    : 'Nothing is due, and you have seen every card in the enabled families.';
}

/** A plain note when new cards wait behind overdue reviews; `undefined` otherwise. */
export function overdueNote(summary: Record<Family, FamilySummary>): string | undefined {
  const overdue = FAMILIES.reduce((n, f) => n + (summary[f].enabled ? summary[f].overdue : 0), 0);
  if (overdue === 0) return undefined;
  return `New cards wait until the ${overdue} overdue ${overdue === 1 ? 'review is' : 'reviews are'} done.`;
}

/**
 * One live session. Reviews come first: while any enabled card is overdue the builder yields reviews
 * only, and once the last overdue card is answered the builder runs again and its new cards are
 * appended. Every answer is saved at once. A card whose next due time falls before local midnight
 * goes back into the queue (the short-term FSRS steps, session-notes GV-2a deviation 1).
 */
export class Session {
  private readonly queue: string[];
  private readonly byId: Map<string, Card>;
  private readonly firstResult = new Map<string, boolean>();
  private answers = 0;
  private waitingOnOverdue: boolean;
  private finished = false;

  private constructor(
    private readonly deps: RunDeps,
    private readonly loaded: Loaded,
    private readonly rng: Rng,
  ) {
    this.byId = new Map(loaded.cards.map((c) => [c.id, c]));
    const now = deps.now();
    this.waitingOnOverdue = this.hasOverdue(now);
    this.queue = buildSession({ ...loaded, now }, rng);
  }

  static async start(deps: RunDeps, loaded?: Loaded, rng: Rng = seededRng(Date.now())): Promise<Session> {
    return new Session(deps, loaded ?? (await load(deps)), rng);
  }

  get current(): Card | undefined {
    const id = this.queue[0];
    return id === undefined ? undefined : this.byId.get(id);
  }

  /** Answers given so far (re-asks included). */
  get done(): number {
    return this.answers;
  }

  get total(): number {
    return this.answers + this.queue.length;
  }

  /** Records the answer to the current card and saves its progress before returning. */
  async answer(choice: string): Promise<{ correct: boolean; card: Card }> {
    const card = this.current;
    if (!card) throw new Error('No card to answer.');
    const now = this.deps.now();
    const correct = choice === card.answer;
    const before = this.loaded.progress.get(card.id) ?? newProgress(card.id, card.family, now);
    const after = review(before, correct, now);
    this.loaded.progress.set(card.id, after);
    await this.deps.saveProgress(after);

    this.queue.shift();
    this.answers++;
    if (!this.firstResult.has(card.id)) this.firstResult.set(card.id, correct);
    if (after.due.getTime() < addDays(startOfDay(now), 1).getTime()) {
      this.queue.splice(Math.min(REASK_GAP, this.queue.length), 0, card.id);
    }
    if (this.waitingOnOverdue && !this.hasOverdue(now)) {
      this.waitingOnOverdue = false;
      const queued = new Set(this.queue);
      for (const id of buildSession({ ...this.loaded, now }, this.rng)) if (!queued.has(id)) this.queue.push(id);
    }
    return { correct, card };
  }

  /** Ends the session (also when the learner stops early) and reports it. */
  async finish(): Promise<SessionResult> {
    const now = this.deps.now();
    if (!this.finished) {
      this.finished = true;
      await this.deps.setLastSessionDate(localDate(now));
    }
    const results = [...this.firstResult.values()];
    const endOfTomorrow = addDays(startOfDay(now), 2).getTime();
    let dueTomorrow = 0;
    for (const p of this.loaded.progress.values()) {
      if (this.loaded.settings.families[p.family]?.enabled && p.due.getTime() < endOfTomorrow) dueTomorrow++;
    }
    return {
      seen: results.length,
      right: results.filter(Boolean).length,
      wrong: results.filter((r) => !r).length,
      dueTomorrow,
    };
  }

  private hasOverdue(now: Date): boolean {
    const today = startOfDay(now);
    for (const p of this.loaded.progress.values()) {
      if (this.loaded.settings.families[p.family]?.enabled && this.byId.has(p.cardId) && isOverdue(p, today)) return true;
    }
    return false;
  }
}
