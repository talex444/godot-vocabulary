import { describe, expect, it } from 'vitest';
import { checkCourse, lessonImages, loadDecks, recallAfter as recallAfterMjs, termName as termNameMjs } from '../../scripts/check-lessons.mjs';
import type { Card } from '../../src/cards/types';
import { termName } from '../../src/courses/index';
import { recallAfter, type Course, type CourseLesson } from '../../src/courses/types';
import { termCourse, TERM_CLASSES } from '../fixtures/term-lesson';

// Decision 71: `pnpm lint:lessons` fails a term lesson that skips a part, and says which lesson, term and part.

const cards = loadDecks() as Card[];
const lessonName = 'term-course lesson tl-0 (“What is a term lesson made of?”)';

/** The fixture course with one change made to its lesson; returns the term check's messages. */
const failures = (change: (lesson: CourseLesson) => void, names?: readonly string[], options?: { imageExists: (src: string) => boolean }) => {
  const course = termCourse(names);
  change(course.lessons[0] as CourseLesson);
  return checkCourse(course, cards, options) as string[];
};

describe('the term check on a term lesson (decision 71)', () => {
  it('passes a term lesson with 5, 8 and 9 terms', () => {
    expect(failures(() => undefined)).toEqual([]);
    expect(failures(() => undefined, TERM_CLASSES.slice(0, 8))).toEqual([]);
    expect(failures(() => undefined, TERM_CLASSES)).toEqual([]);
  });

  it('fails a card with no term', () => {
    expect(failures((l) => l.terms!.splice(1, 1))).toContain(`${lessonName}: cardId api:class:Node2D has no term; a term lesson gives every card its six parts`);
  });

  it('fails a term whose card is not one of the cardIds', () => {
    // Its own name in code font is then an unmet card too.
    expect(failures((l) => l.cardIds.splice(4, 1), TERM_CLASSES)).toEqual([
      `${lessonName}: term 5 of 9 (api:class:Timer) teaches a card that is not in the lesson's cardIds`,
      expect.stringMatching(/`Timer` in code font \(terms\[4\]\.what\.text\) is not a card the learner has met/),
    ]);
  });

  it('fails two terms with one card', () => {
    const errors = failures((l) => (l.terms![3] = { ...l.terms![2]! }));
    expect(errors).toContain(`${lessonName}: term 4 of 5 (api:class:Sprite2D) teaches the same card as term 3; each card has one term`);
    expect(errors).toContain(`${lessonName}: cardId api:class:Camera2D has no term; a term lesson gives every card its six parts`);
  });

  it('fails a term that skips a part, naming the term and the part', () => {
    const parts: [keyof NonNullable<CourseLesson['terms']>[number], string][] = [
      ['what', '(1) What it is'],
      ['when', '(2) When you’d reach for it'],
      ['where', '(3) Where it lives'],
      ['example', '(4) Example'],
      ['contrast', '(5) Not to be confused with'],
      ['check', '(6) Check'],
    ];
    for (const [key, part] of parts) {
      expect(failures((l) => delete (l.terms![1] as Partial<NonNullable<CourseLesson['terms']>[number]>)[key])).toContain(`${lessonName}: term 2 of 5 (api:class:Node2D) skips part ${part}`);
    }
  });

  it('fails a what-it-is without a quotation from the manual', () => {
    expect(failures((l) => (l.terms![0]!.what.text = 'A `Node` is a building block.'))).toEqual([
      `${lessonName}: term 1 of 5 (api:class:Node) part (1) What it is has no “…” quotation from the manual`,
    ]);
  });

  it('fails the wrong number of recall checks', () => {
    expect(failures((l) => l.recall!.pop())).toEqual([`${lessonName}: 1 recall check for 5 terms; it needs 2, after terms 4, 5`]);
    expect(failures((l) => l.recall!.push(l.recall![0]!), TERM_CLASSES.slice(0, 4))).toEqual([`${lessonName}: 2 recall checks for 4 terms; it needs 1, after term 4`]);
  });

  it('fails a recall that asks for a term below it', () => {
    expect(failures((l) => (l.recall![0]!.answer = 'Timer'))).toEqual([
      `${lessonName}: recall 1 (after term 4) asks for “Timer”, which is not a term above it (Node, Node2D, Sprite2D, Camera2D)`,
    ]);
  });

  it('reads a check’s answer and a contrast’s other as one name: an unmet class fails, a phrase with no card passes', () => {
    expect(failures((l) => (l.terms![1]!.contrast.other = 'Label'))).toEqual([
      `${lessonName}: \`Label\` in code font (terms[1].contrast.other) is not a card the learner has met; add api:class:Label to this lesson's or an earlier lesson's cardIds`,
    ]);
    expect(failures((l) => (l.terms![1]!.contrast.other = 'Spatial'))).toEqual([`${lessonName}: \`Spatial\` in code font (terms[1].contrast.other) is not a card in the decks`]);
    expect(failures((l) => (l.terms![1]!.contrast.other = 'Inspector dock'))).toEqual([]);
    expect(failures((l) => (l.terms![0]!.example.code = '$Label'))).toEqual([expect.stringMatching(/`Label` in code font \(terms\[0\]\.example\.code\)/)]);
    expect(failures((l) => (l.terms![0]!.when = 'When a `Label` is not enough.'))).toEqual([expect.stringMatching(/`Label` in code font \(terms\[0\]\.when\)/)]);
  });

  it('finds the pictures in a term’s where and example, and fails one that is missing', () => {
    const course = termCourse();
    const term = (course.lessons[0] as CourseLesson).terms![1]!;
    term.example.image = { src: 'example.webp', alt: 'a', caption: 'c', width: 1, height: 1 };
    expect(lessonImages(course)).toEqual(['key_concepts_character_nodes.webp', 'example.webp']);
    expect(checkCourse(course, cards, { imageExists: (src: string) => src !== 'example.webp' })).toEqual([`${lessonName}: image example.webp is missing from public/courses/img`]);
  });

  it('the script’s termName and recallAfter are the app’s', () => {
    for (const card of cards) expect(termNameMjs(card), card.id).toBe(termName(card));
    expect(cards.map(termName)).toEqual(expect.arrayContaining(['Node', 'Node2D.position']));
    for (let n = 0; n <= 20; n++) expect(recallAfterMjs(n)).toEqual(recallAfter(n));
  });

  it('leaves the chunk lessons alone: course 1 still passes', async () => {
    const course1 = (await import('../../src/data/courses/course-1.json')).default as Course;
    expect(checkCourse(course1, cards)).toEqual([]);
  });
});
