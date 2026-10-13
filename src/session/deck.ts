import type { Card } from '../cards/types';
import api from '../data/cards.godot-api.json';
import gdscript from '../data/cards.gdscript.json';
import github from '../data/cards.github.json';
import { getProgress, getSettings, listCustomCards, saveProgress, setLastSessionDate } from '../store/db';
import type { RunDeps } from './run';

/** The three generated decks plus the learner's own cards. */
export async function loadCards(): Promise<Card[]> {
  return [...(api as Card[]), ...(gdscript as Card[]), ...(github as Card[]), ...(await listCustomCards())];
}

/** The live flow on the device's IndexedDB store. */
export const deviceDeps: RunDeps = {
  loadCards,
  getProgress: () => getProgress(),
  getSettings,
  saveProgress,
  setLastSessionDate,
  now: () => new Date(),
};
