import type { Lesson } from '../session/build';

/** What finishing a lesson reads from the device: enough to say truthfully what it changes. */
export interface FinishInput {
  lesson: Pick<Lesson, 'id' | 'cardIds'>;
  /** The area's lessons (`sessionLessons`), so cards another finished lesson already queued are not counted twice. */
  lessons: readonly Pick<Lesson, 'id' | 'cardIds'>[];
  lessonsDone: readonly string[];
  /** Ids of the cards in the area's decks; a lesson id with no card behind it adds nothing. */
  cardIds: ReadonlySet<string>;
  /** Ids of the cards the learner has been asked at least once (they have a progress record). */
  seen: ReadonlySet<string>;
  skipped: ReadonlySet<string>;
}

/**
 * The lesson's cards that finishing it adds to the deck (decision 69e): those not yet seen, not
 * skipped, and not already queued by another finished lesson. Finishing puts them first among the
 * area's new cards (course mode, `courseFirst` in `src/session/build.ts`); it schedules nothing.
 */
export function cardsToAdd({ lesson, lessons, lessonsDone, cardIds, seen, skipped }: FinishInput): string[] {
  const done = new Set(lessonsDone);
  const queued = new Set(lessons.filter((l) => l.id !== lesson.id && done.has(l.id)).flatMap((l) => l.cardIds));
  return lesson.cardIds.filter((id) => cardIds.has(id) && !seen.has(id) && !skipped.has(id) && !queued.has(id));
}

const cards = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`;

/** The button, named for its outcome: "Finish lesson: add 9 cards", or "Finish lesson" when it adds none. */
export const finishLabel = (added: number, again: boolean): string => (again || added === 0 ? 'Finish lesson' : `Finish lesson: add ${cards(added)}`);

/**
 * The one line that replaces the button (decision 69c), true by what Mark done does: the lesson is
 * recorded, course mode goes on, and the new cards of the area's sessions start with the lesson's
 * unseen cards. No date is promised: the scheduler sets none until a card is first answered.
 */
export function finishedText(order: number, added: number, again: boolean, areaLabel: string, courseEnd?: number): string {
  const what = again
    ? `Lesson ${order} done again. Your cards are unchanged.`
    : added === 0
      ? `Lesson ${order} done. Its cards are already in your deck.`
      : `Lesson ${order} done. ${cards(added)} added; your ${areaLabel} sessions will bring ${added === 1 ? 'it' : 'them'} in before other new cards.`;
  return courseEnd === undefined ? what : `${what} Course ${courseEnd} is finished.`;
}
