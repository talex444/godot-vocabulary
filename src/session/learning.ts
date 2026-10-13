import type { SessionPlan } from './build';

/**
 * First-session learning (decision 23, done-criteria 33). A pure state machine over the session
 * queue: every function returns a new state and leaves its argument untouched.
 *
 * - A new card is shown until it has been shown at least `SHOWINGS` times AND its last answer was
 *   right, or the session ends.
 * - Every queued showing has a due slot (slot = the number of answers given before it). First
 *   showings are due at their place in the plan. A card that is not done is due again
 *   `max(GAP, remaining / 4)` slots after the answer (rounded down; `remaining` = showings still
 *   queued), and the queue is served in due order, ties in the order they were queued. So the card
 *   comes back after that many showings, or at the end when fewer are left, and cards waiting for
 *   their first showing keep their place instead of being pushed back by repeats.
 * - Never adjacent: a repeat always has at least min(GAP, showings left) others before it; with no
 *   other card left it is not asked again this session.
 * - A card that had progress before the session (Review state) is shown once.
 * - Only the first answer of the session grades the card (`grade` in the result); repeats reinforce
 *   and never change the FSRS state.
 */
export const SHOWINGS = 3;
export const GAP = 8;

export interface LearningState {
  /** Showings still to come, in due order; the first is the current card. */
  readonly queue: readonly string[];
  /** Due slot of each queued card. */
  readonly due: ReadonlyMap<string, number>;
  /** Answers given so far (the slot of the current showing). */
  readonly step: number;
  /** Cards that get learning repeats. */
  readonly newIds: ReadonlySet<string>;
  /** Times each card has been answered this session. */
  readonly shown: ReadonlyMap<string, number>;
  /** The first answer of the session per card (the one that graded it). */
  readonly first: ReadonlyMap<string, boolean>;
  /** The latest answer per card. */
  readonly last: ReadonlyMap<string, boolean>;
}

export interface AnswerResult {
  state: LearningState;
  /** The grade to pass to `review()`: only on a card's first answer this session, else undefined. */
  grade: boolean | undefined;
  /** Where the card went back into the queue (index after this answer), or undefined when done. */
  requeuedAt: number | undefined;
}

export function startLearning(plan: SessionPlan): LearningState {
  return {
    queue: [...plan.order],
    due: new Map(plan.order.map((id, i) => [id, i])),
    step: 0,
    newIds: new Set(plan.newIds),
    shown: new Map(),
    first: new Map(),
    last: new Map(),
  };
}

export function currentCard(state: LearningState): string | undefined {
  return state.queue[0];
}

/** How many times a card (the current one by default) was shown before (0 = first showing). */
export function showingIndex(state: LearningState, id: string | undefined = currentCard(state)): number {
  return id === undefined ? 0 : (state.shown.get(id) ?? 0);
}

/** True once a card needs no more showings this session. */
export function isLearned(state: LearningState, id: string): boolean {
  if (!state.newIds.has(id)) return (state.shown.get(id) ?? 0) >= 1;
  return (state.shown.get(id) ?? 0) >= SHOWINGS && state.last.get(id) === true;
}

/** How many slots after an answer a card that is not done is due again: `max(GAP, remaining / 4)`. */
export function requeueDelay(remaining: number): number {
  return Math.max(GAP, Math.floor(remaining / 4));
}

/** Records an answer to the current card and moves the queue on. */
export function answerCurrent(state: LearningState, correct: boolean): AnswerResult {
  const id = currentCard(state);
  if (id === undefined) throw new Error('No card to answer.');
  const grade = state.first.has(id) ? undefined : correct;
  const shown = new Map(state.shown).set(id, (state.shown.get(id) ?? 0) + 1);
  const first = grade === undefined ? state.first : new Map(state.first).set(id, correct);
  const last = new Map(state.last).set(id, correct);
  const queue = state.queue.slice(1);
  const due = new Map(state.due);
  due.delete(id);
  const next: LearningState = { ...state, queue, due, step: state.step + 1, shown, first, last };
  let requeuedAt: number | undefined;
  if (!isLearned(next, id) && queue.length > 0) {
    // Due `delay` slots on, behind everything due by then: `delay` showings in between.
    const slot = state.step + requeueDelay(queue.length);
    const later = queue.findIndex((q) => due.get(q)! > slot);
    // At least GAP showings in between (or every one left), whatever the due slots say.
    requeuedAt = Math.max(Math.min(GAP, queue.length), later < 0 ? queue.length : later);
    queue.splice(requeuedAt, 0, id);
    due.set(id, slot);
  }
  return { state: next, grade, requeuedAt };
}

/** Adds cards to the end (new cards let in once the overdue reviews are cleared). */
export function appendCards(state: LearningState, ids: readonly string[], newIds: readonly string[]): LearningState {
  const add = ids.filter((id) => !state.due.has(id) && !state.shown.has(id));
  const start = Math.max(state.step, ...state.due.values()) + 1;
  return {
    ...state,
    queue: [...state.queue, ...add],
    due: new Map([...state.due, ...add.map((id, i) => [id, start + i] as const)]),
    newIds: new Set([...state.newIds, ...newIds.filter((id) => add.includes(id))]),
  };
}

/** Removes every remaining showing of a card (the learner skipped it). */
export function dropCard(state: LearningState, id: string): LearningState {
  const due = new Map(state.due);
  due.delete(id);
  return { ...state, queue: state.queue.filter((q) => q !== id), due };
}
