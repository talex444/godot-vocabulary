import { familiesOf, type AreaId } from '../areas/registry';
import type { Card, Family } from '../cards/types';
import { sessionLessons } from '../courses/index';
import type { Course } from '../courses/types';
import { isOverdue, newProgress, review, startOfDay, type Progress } from '../scheduler/fsrs';
import type { Settings } from '../settings/load';
import { planSession, seededRng, type AreaSummary, type FamilySummary, type Lesson, type Rng } from './build';
import { drawChoices, type Draw } from './choices';
import { answerCurrent, appendCards, currentCard, dropCard, isLearned, showingIndex, startLearning, type LearningState } from './learning';

/** What the flow needs from the device; `src/session/deck.ts` wires the real store. */
export interface RunDeps {
  /** The area's generated cards and the learner's own cards in its families. */
  loadCards(area: AreaId): Promise<Card[]>;
  getProgress(): Promise<Map<string, Progress>>;
  getSettings(): Promise<Settings>;
  saveProgress(progress: Progress): Promise<void>;
  setLastSessionDate(date: string): Promise<void>;
  now(): Date;
  /** Skipped card ids (decision 26); none when omitted. */
  getSkipped?(): Promise<Set<string>>;
  skipCard?(cardId: string, reason?: string): Promise<void>;
  /** Finished lesson ids (decision 30); none when omitted. */
  getLessonsDone?(): Promise<string[]>;
  /** The area's courses (course mode reads their lessons); none when omitted. */
  loadCourses?(area: AreaId): Promise<Course[]>;
}

export interface Loaded {
  area: AreaId;
  cards: Card[];
  progress: Map<string, Progress>;
  settings: Settings;
  skipped?: Set<string>;
  lessonsDone?: string[];
  /** The written course lessons, in course order. */
  lessons?: Lesson[];
}

export interface SessionResult {
  seen: number;
  right: number;
  wrong: number;
  /** New cards shown three times with the last answer right (decision 23). */
  learned: number;
  /** New cards answered this session that still needed showings when it ended. */
  continueTomorrow: number;
  /** Cards from the area's enabled families due before the end of tomorrow. */
  dueTomorrow: number;
}

function addDays(day: Date, days: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + days);
}

/** `YYYY-MM-DD` in local time. */
export function localDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export async function load(deps: RunDeps, area: AreaId): Promise<Loaded> {
  const [cards, progress, settings, skipped, lessonsDone, courses] = await Promise.all([
    deps.loadCards(area),
    deps.getProgress(),
    deps.getSettings(),
    deps.getSkipped?.() ?? new Set<string>(),
    deps.getLessonsDone?.() ?? [],
    deps.loadCourses?.(area) ?? [],
  ]);
  return { area, cards, progress, settings, skipped, lessonsDone, lessons: sessionLessons(courses) };
}

/** The summary's entries for the area's families, in the registry's order. */
function entries(summary: AreaSummary, area: AreaId): [Family, FamilySummary][] {
  return familiesOf(area).flatMap((f) => (summary[f] ? [[f, summary[f]] as [Family, FamilySummary]] : []));
}

/** Why Start cannot begin, in plain words; `undefined` when there is something to do. */
export function startBlockedReason(summary: AreaSummary, loaded: Loaded): string | undefined {
  const enabled = entries(summary, loaded.area).filter(([, s]) => s.enabled);
  if (enabled.length === 0) return 'Every card family is switched off. Turn one on in Settings.';
  const due = enabled.reduce((n, [, s]) => n + s.due, 0);
  const fresh = enabled.reduce((n, [, s]) => n + s.newAvailable, 0);
  if (due + fresh > 0) return undefined;
  const unseen = loaded.cards.some((c) => summary[c.family]?.enabled && !loaded.progress.has(c.id) && !loaded.skipped?.has(c.id));
  return unseen
    ? 'Nothing is ready, and today’s new cards are done. Come back tomorrow.'
    : 'Nothing is ready, and you have seen every card in the enabled families.';
}

/**
 * A plain note when new cards wait behind the area's overdue reviews; `undefined` otherwise. It says
 * how many reviews are from before today and that new cards begin after them, never that anything
 * is owed (decision 66; GV-8g, in the words of the "From before today" figure).
 */
export function overdueNote(summary: AreaSummary, area: AreaId): string | undefined {
  const overdue = entries(summary, area).reduce((n, [, s]) => n + (s.enabled ? s.overdue : 0), 0);
  if (overdue === 0) return undefined;
  return overdue === 1
    ? '1 review is from before today. New cards begin after it.'
    : `${overdue} reviews are from before today. New cards begin after them.`;
}

/**
 * One live session in one area. Reviews come first: while any enabled card of the area is overdue the builder yields reviews
 * only, and once the last overdue card is answered the builder runs again and its new cards are
 * appended. Every answer is saved at once. New cards get first-session learning repeats
 * (`learning.ts`); only a card's first answer of the session reaches FSRS.
 */
export class Session {
  private learning: LearningState;
  private readonly byId: Map<string, Card>;
  /** Choice sets already shown per card, so no set of four repeats (`choices.ts`). */
  private readonly shownSets = new Map<string, string[]>();
  private drawn: { cardId: string; showing: number; draw: Draw } | undefined;
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
    this.learning = startLearning(planSession({ ...loaded, now }, rng));
  }

  static async start(deps: RunDeps, area: AreaId, loaded?: Loaded, rng: Rng = seededRng(Date.now())): Promise<Session> {
    return new Session(deps, loaded ?? (await load(deps, area)), rng);
  }

  /** Counted for this session: a family of its area, switched on, the card not skipped. */
  private counts(p: Progress): boolean {
    return familiesOf(this.loaded.area).includes(p.family) && this.loaded.settings.families[p.family]?.enabled === true && !this.loaded.skipped?.has(p.cardId);
  }

  get current(): Card | undefined {
    const id = currentCard(this.learning);
    return id === undefined ? undefined : this.byId.get(id);
  }

  /** Times the current card was already shown this session (0 = first showing). */
  get showing(): number {
    return showingIndex(this.learning);
  }

  /** Answers given so far (repeats included). */
  get done(): number {
    return this.answers;
  }

  get total(): number {
    return this.answers + this.learning.queue.length;
  }

  /** The four choices for the current showing; the same object until the card is answered. */
  draw(): Draw | undefined {
    const card = this.current;
    if (!card) return undefined;
    if (this.drawn?.cardId !== card.id || this.drawn.showing !== this.showing) {
      const draw = drawChoices(card, this.showing, this.rng, this.shownSets.get(card.id) ?? [], this.byId);
      this.shownSets.set(card.id, [...(this.shownSets.get(card.id) ?? []), draw.key]);
      this.drawn = { cardId: card.id, showing: this.showing, draw };
    }
    return this.drawn.draw;
  }

  /**
   * Records the answer to the current card. The first answer of the session is graded and saved
   * before this returns; repeats only move the learning queue. `choice` is the tapped choice's text
   * (a description when the showing is flipped).
   */
  async answer(choice: string): Promise<{ correct: boolean; card: Card }> {
    const card = this.current;
    if (!card) throw new Error('No card to answer.');
    const now = this.deps.now();
    const drawn = this.drawn?.cardId === card.id && this.drawn.showing === this.showing ? this.drawn.draw : undefined;
    const correct = drawn ? drawn.choices.some((c) => c.correct && c.text === choice) : choice === card.answer;
    const { state, grade } = answerCurrent(this.learning, correct);
    this.learning = state;
    this.drawn = undefined;
    this.answers++;
    if (grade !== undefined) {
      const before = this.loaded.progress.get(card.id) ?? newProgress(card.id, card.family, now);
      const after = review(before, grade, now);
      this.loaded.progress.set(card.id, after);
      await this.deps.saveProgress(after);
    }
    if (this.waitingOnOverdue && !this.hasOverdue(now)) {
      this.waitingOnOverdue = false;
      const plan = planSession({ ...this.loaded, now }, this.rng);
      this.learning = appendCards(this.learning, plan.order, plan.newIds);
    }
    return { correct, card };
  }

  /**
   * Skips a card (the current one by default, or one just answered): it leaves this session and,
   * through the store, the deck.
   */
  async skip(reason?: string, cardId: string | undefined = this.current?.id): Promise<void> {
    if (cardId === undefined) return;
    this.loaded.skipped = new Set([...(this.loaded.skipped ?? []), cardId]);
    this.learning = dropCard(this.learning, cardId);
    if (this.drawn?.cardId === cardId) this.drawn = undefined;
    await this.deps.skipCard?.(cardId, reason);
  }

  /** Ends the session (also when the learner stops early) and reports it. */
  async finish(): Promise<SessionResult> {
    const now = this.deps.now();
    if (!this.finished) {
      this.finished = true;
      await this.deps.setLastSessionDate(localDate(now));
    }
    const results = [...this.learning.first.values()];
    const endOfTomorrow = addDays(startOfDay(now), 2).getTime();
    let dueTomorrow = 0;
    for (const p of this.loaded.progress.values()) if (this.counts(p) && p.due.getTime() < endOfTomorrow) dueTomorrow++;
    const answeredNew = [...this.learning.first.keys()].filter((id) => this.learning.newIds.has(id) && !this.loaded.skipped?.has(id));
    const learned = answeredNew.filter((id) => isLearned(this.learning, id)).length;
    return {
      seen: results.length,
      right: results.filter(Boolean).length,
      wrong: results.filter((r) => !r).length,
      learned,
      continueTomorrow: answeredNew.length - learned,
      dueTomorrow,
    };
  }

  private hasOverdue(now: Date): boolean {
    const today = startOfDay(now);
    for (const p of this.loaded.progress.values()) if (this.counts(p) && this.byId.has(p.cardId) && isOverdue(p, today)) return true;
    return false;
  }
}
