import type { Card } from '../cards/types';
import type { Rng } from './build';

/**
 * Anti-memorisation draws (decision 24, done-criteria 34, 35). Every showing draws fresh wrong
 * answers from the card's pool, and never repeats a set of four already shown for that card this
 * session. Description cards flip on their second and third showings: the name is shown and the
 * four choices are descriptions (the card's own prompt and three pool siblings' prompts).
 */
export type Direction = 'forward' | 'flipped';

export interface Choice {
  /** A name (forward) or a description (flipped). */
  text: string;
  correct: boolean;
  /** The card this choice names or describes, when it has one. */
  cardId?: string;
}

export interface Draw {
  direction: Direction;
  /** Four choices, shuffled. */
  choices: Choice[];
  /** Identifies this set of four; keep it in `previousSets` for the rest of the session. */
  key: string;
}

/** Language kinds that are descriptions when the card has no `code` (snippet cards never flip). */
const LANGUAGE_DESCRIPTION_KINDS = new Set(['keyword', 'builtin', 'lifecycle', 'concept', 'operator', 'annotation']);
const DESCRIPTION_KINDS = new Set(['class', 'method', 'property', 'signal', 'term']);

/** Whether a card may be shown flipped (a description card, not a snippet or custom card). */
export function canFlip(card: Card): boolean {
  if (card.code) return false;
  return DESCRIPTION_KINDS.has(card.kind) || (card.family === 'gdscript' && LANGUAGE_DESCRIPTION_KINDS.has(card.kind));
}

const keyOf = (texts: readonly string[]) => [...texts].sort().join('\u0001');

/**
 * Four choices for one showing. `showingIndex` counts from 0 (the first showing); showings 1 and 2
 * flip when the card can, three pool entries resolve to description cards in `cardsById`, and a
 * set of four not shown before is left; otherwise the draw is forward.
 */
export function drawChoices(
  card: Card,
  showingIndex: number,
  rng: Rng,
  previousSets: readonly string[],
  cardsById?: ReadonlyMap<string, Card>,
): Draw {
  const pool = card.distractorPool?.length ? card.distractorPool : card.distractors;
  const ids = card.distractorIds ?? [];
  const entries = pool.map((text, i) => ({ text, id: ids[i] }));

  if ((showingIndex === 1 || showingIndex === 2) && canFlip(card) && cardsById) {
    const described = entries
      .map((e) => (e.id === undefined ? undefined : cardsById.get(e.id)))
      .filter((c): c is Card => c !== undefined && !c.code && c.prompt !== card.prompt)
      .map((c) => ({ text: c.prompt, id: c.id }));
    const unique = described.filter((d, i) => described.findIndex((x) => x.text === d.text) === i);
    if (unique.length >= 3) {
      const flipped = draw('flipped', { text: card.prompt, id: card.id }, unique, rng, previousSets);
      // With only three describable siblings the second flip could only repeat the first set.
      if (!previousSets.includes(flipped.key)) return flipped;
    }
  }
  return draw('forward', { text: card.answer, id: card.id }, entries, rng, previousSets);
}

function draw(
  direction: Direction,
  right: { text: string; id?: string },
  wrong: readonly { text: string; id?: string }[],
  rng: Rng,
  previousSets: readonly string[],
): Draw {
  const used = new Set(previousSets);
  // Prefer the wrong answers shown least so far this session, random among equals.
  const shownBefore = new Map<string, number>();
  for (const key of previousSets) for (const t of key.split('\u0001')) shownBefore.set(t, (shownBefore.get(t) ?? 0) + 1);
  const ranked = shuffle(wrong, rng).sort((a, b) => (shownBefore.get(a.text) ?? 0) - (shownBefore.get(b.text) ?? 0));
  let pick = ranked.slice(0, 3);
  if (used.has(keyOf([right.text, ...pick.map((p) => p.text)]))) {
    // Every unused combination, in a random order; the first one wins. A pool of three has only one.
    const fresh = combinations(shuffle(wrong, rng), 3).find((c) => !used.has(keyOf([right.text, ...c.map((p) => p.text)])));
    if (fresh) pick = fresh;
  }
  const choices = shuffle(
    [
      { text: right.text, correct: true, cardId: right.id },
      ...pick.map((p) => ({ text: p.text, correct: false, cardId: p.id })),
    ],
    rng,
  ).map((c) => (c.cardId === undefined ? { text: c.text, correct: c.correct } : c));
  return { direction, choices, key: keyOf(choices.map((c) => c.text)) };
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of combinations(items.slice(i + 1), k - 1)) out.push([item, ...rest]);
  });
  return out;
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
