import { AREAS, familiesOf, getArea, type AreaId } from '../areas/registry';
import type { Card } from '../cards/types';
import {
  getLessonsDoneIds,
  getProgress,
  getSettings,
  getSkippedIds,
  listCustomCards,
  saveProgress,
  setLastSessionDate,
  skipCard,
} from '../store/db';
import type { RunDeps } from './run';

/**
 * One area's generated decks (loaded on demand through the registry) plus the learner's own cards
 * in its families. An unknown area falls back to Godot.
 */
export async function loadCards(area: AreaId): Promise<Card[]> {
  const known = getArea(area) ?? AREAS[0]!;
  const families = familiesOf(known.id);
  const [{ cards }, custom] = await Promise.all([known.load(), listCustomCards()]);
  return [...cards, ...custom.filter((c) => families.includes(c.family))];
}

/** Every area's cards, for screens that name cards from any area (the skipped list). */
export async function loadAllCards(): Promise<Card[]> {
  return (await Promise.all(AREAS.map((area) => loadCards(area.id)))).flat();
}

/** The live flow on the device's IndexedDB store. */
export const deviceDeps: RunDeps = {
  loadCards,
  getProgress: () => getProgress(),
  getSettings,
  saveProgress,
  setLastSessionDate,
  now: () => new Date(),
  getSkipped: getSkippedIds,
  skipCard: (cardId, reason) => skipCard(cardId, reason),
  getLessonsDone: getLessonsDoneIds,
};
