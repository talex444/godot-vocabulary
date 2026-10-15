import { describe, expect, it } from 'vitest';
import { cardsToAdd, finishedText, finishLabel } from '../../src/courses/finish';

// Decision 69c and 69e: the Finish button is named for what it adds, and the line that replaces it
// says what happened, true by what finishing does (course mode orders new cards; no date promised).

const l0 = { id: 'c1-l0', cardIds: ['a', 'b', 'c', 'd'] };
const l1 = { id: 'c1-l1', cardIds: ['d', 'e', 'f'] };
const base = { lesson: l0, lessons: [l0, l1], lessonsDone: [], cardIds: new Set(['a', 'b', 'c', 'd', 'e', 'f']), seen: new Set<string>(), skipped: new Set<string>() };

describe('finishing a lesson', () => {
  it('adds the lesson’s cards not yet seen, not skipped, not queued by another finished lesson, and in the deck', () => {
    expect(cardsToAdd(base)).toEqual(['a', 'b', 'c', 'd']);
    expect(cardsToAdd({ ...base, seen: new Set(['a']) })).toEqual(['b', 'c', 'd']);
    expect(cardsToAdd({ ...base, skipped: new Set(['b']) })).toEqual(['a', 'c', 'd']);
    expect(cardsToAdd({ ...base, lessonsDone: ['c1-l1'] })).toEqual(['a', 'b', 'c']);
    expect(cardsToAdd({ ...base, cardIds: new Set(['a', 'b']) })).toEqual(['a', 'b']);
    // The lesson's own earlier finish does not hide its cards from the count.
    expect(cardsToAdd({ ...base, lessonsDone: ['c1-l0'] })).toEqual(['a', 'b', 'c', 'd']);
  });

  it('names the button for its outcome: the count, or plain "Finish lesson" when it adds none or the lesson is done again', () => {
    expect(finishLabel(9, false)).toBe('Finish lesson: add 9 cards');
    expect(finishLabel(1, false)).toBe('Finish lesson: add 1 card');
    expect(finishLabel(0, false)).toBe('Finish lesson');
    expect(finishLabel(9, true)).toBe('Finish lesson');
  });

  it('says what happened in one line, and that the course is finished after its last lesson', () => {
    expect(finishedText(0, 9, false, 'Godot')).toBe('Lesson 0 done. 9 cards added; your Godot sessions will bring them in before other new cards.');
    expect(finishedText(2, 1, false, 'Godot')).toBe('Lesson 2 done. 1 card added; your Godot sessions will bring it in before other new cards.');
    expect(finishedText(0, 0, false, 'Godot')).toBe('Lesson 0 done. Its cards are already in your deck.');
    expect(finishedText(0, 9, true, 'Godot')).toBe('Lesson 0 done again. Your cards are unchanged.');
    expect(finishedText(5, 4, false, 'Godot', 1)).toBe('Lesson 5 done. 4 cards added; your Godot sessions will bring them in before other new cards. Course 1 is finished.');
  });
});
