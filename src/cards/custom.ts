import type { Card, Family } from './types';

/** What the Add card form collects. */
export interface CustomDraft {
  family: Family;
  prompt: string;
  answer: string;
  wrong: [string, string, string];
  explain: string;
}

const same = (text: string) => text.trim().toLowerCase();

/** Problems with a draft, in plain words; empty when it can be saved. */
export function validateDraft(draft: CustomDraft): string[] {
  const errors: string[] = [];
  if (!draft.prompt.trim()) errors.push('Write a question.');
  if (!draft.answer.trim()) errors.push('Write the right answer.');
  if (draft.wrong.some((w) => !w.trim())) errors.push('Write all three wrong answers.');
  const choices = [draft.answer, ...draft.wrong].map(same).filter(Boolean);
  if (new Set(choices).size !== choices.length) errors.push('The four answers must all be different.');
  if (draft.answer.trim() && same(draft.prompt).includes(same(draft.answer))) {
    errors.push('The question gives the answer away: take the answer out of it.');
  }
  return errors;
}

/** `Rebase onto main!` → `rebase-onto-main`. */
export function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || 'card'
  );
}

/** Six base-36 characters from the platform's random source. */
export function shortRandom(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => (b % 36).toString(36)).join('');
}

/**
 * A saved draft as a card: id `custom:<family>:<slug>-<random>`, ranked after the family's last
 * card so it enters as the next new card in rank order.
 */
export function draftToCard(draft: CustomDraft, deck: readonly Card[], random: string = shortRandom()): Card {
  const last = deck.filter((c) => c.family === draft.family).reduce((max, c) => Math.max(max, c.rank), -1);
  return {
    id: `custom:${draft.family}:${slug(draft.answer)}-${random}`,
    family: draft.family,
    kind: 'custom',
    prompt: draft.prompt.trim(),
    answer: draft.answer.trim(),
    distractors: draft.wrong.map((w) => w.trim()) as [string, string, string],
    explain: draft.explain.trim(),
    source: { doc: 'custom', ref: 'your card', version: '1' },
    rank: Math.floor(last) + 1,
  };
}
