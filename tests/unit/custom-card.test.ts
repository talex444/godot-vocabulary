import { describe, expect, it } from 'vitest';
import { draftToCard, slug, validateDraft, type CustomDraft } from '../../src/cards/custom';
import type { Card } from '../../src/cards/types';
import github from '../../src/data/cards.github.json';
import { buildSession, seededRng } from '../../src/session/build';
import { DEFAULT_SETTINGS } from '../../src/settings/load';

const draft: CustomDraft = {
  family: 'github',
  prompt: 'Replays your commits on top of another branch.',
  answer: 'Rebase',
  wrong: ['merge', 'fork', 'clone'],
  explain: '',
};

describe('custom cards', () => {
  it('accepts a complete draft', () => {
    expect(validateDraft(draft)).toEqual([]);
  });

  it('asks for every field but the explanation, in plain words', () => {
    expect(validateDraft({ ...draft, prompt: ' ', answer: '', wrong: ['merge', '', 'clone'] })).toEqual([
      'Write a question.',
      'Write the right answer.',
      'Write all three wrong answers.',
    ]);
  });

  it('wants four different answers, ignoring case and spaces', () => {
    expect(validateDraft({ ...draft, wrong: ['merge', ' rebase ', 'clone'] })).toEqual(['The four answers must all be different.']);
  });

  it('refuses a question that contains its answer', () => {
    expect(validateDraft({ ...draft, prompt: 'What does git rebase do?' })).toEqual([
      'The question gives the answer away: take the answer out of it.',
    ]);
  });

  it('makes a custom id and ranks the card after the family', () => {
    const deck = github as Card[];
    const card = draftToCard(draft, deck, 'abc123');
    expect(card.id).toBe('custom:github:rebase-abc123');
    expect(card.rank).toBe(Math.max(...deck.map((c) => c.rank)) + 1);
    expect([card.answer, ...card.distractors]).toEqual(['Rebase', 'merge', 'fork', 'clone']);
    expect(slug('  Call down, signal UP!  ')).toBe('call-down-signal-up');
    expect(slug('→')).toBe('card');
  });

  it('is offered as a new card by the session builder', () => {
    const deck = github as Card[];
    const card = draftToCard(draft, deck, 'abc123');
    const settings = { ...DEFAULT_SETTINGS, families: { ...DEFAULT_SETTINGS.families, github: { enabled: true, newPerDay: 1 } } };
    const ids = buildSession({ area: 'github', cards: [card], progress: new Map(), settings, now: new Date(2026, 9, 13, 9) }, seededRng(1));
    expect(ids).toEqual([card.id]);
  });
});
