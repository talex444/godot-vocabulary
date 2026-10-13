import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card as FsrsCard } from 'ts-fsrs';
import type { Family } from '../cards/types';

export { State };

/**
 * What the device stores per card: the FSRS card fields plus which card and family it belongs to,
 * and when it was first shown (`seenAt`, used to count today's new cards).
 */
export interface Progress extends FsrsCard {
  cardId: string;
  family: Family;
  seenAt: Date;
}

/**
 * Desired retention 0.9; no fuzz so tests and devices agree on the same intervals. Short-term steps
 * are off (decision 23): every answer schedules in days, there is no Relearning state, and the app's
 * own first-session repeats (`src/session/learning.ts`) replace the library's same-day steps.
 */
const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: false, enable_short_term: false }));

/** Progress for a card shown for the first time at `now`: an empty FSRS card, due immediately. */
export function newProgress(cardId: string, family: Family, now: Date = new Date()): Progress {
  return { ...createEmptyCard(now), cardId, family, seenAt: now };
}

/** Next state after one answer: correct → Good, wrong → Again (never Hard or Easy in v1). */
export function review(progress: Progress, correct: boolean, now: Date): Progress {
  const { card } = scheduler.next(progress, now, correct ? Rating.Good : Rating.Again);
  return { ...card, cardId: progress.cardId, family: progress.family, seenAt: progress.seenAt };
}

export function isDue(progress: Progress, now: Date): boolean {
  return progress.due.getTime() <= now.getTime();
}

/** Overdue = due before local midnight today; pass `startOfDay(now)`. */
export function isOverdue(progress: Progress, startOfToday: Date): boolean {
  return progress.due.getTime() < startOfToday.getTime();
}

/** Local midnight at the start of the day containing `now`. */
export function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
