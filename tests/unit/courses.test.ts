import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkCourse, loadDecks } from '../../scripts/check-lessons.mjs';
import type { Card } from '../../src/cards/types';
import { judgeBlank } from '../../src/courses/blank';
import { COURSES, pretestCards } from '../../src/courses/index';
import { chunkWords, isPlanned, validateCourse, type Course, type CourseLesson } from '../../src/courses/types';

const dir = 'src/data/courses';
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const cards = loadDecks() as Card[];
const lesson0 = COURSES[0]!.lessons[0] as CourseLesson;

describe('course files (decisions 31–42)', () => {
  it.each(files)('%s matches the lesson format', (file) => {
    expect(validateCourse(JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')))).toEqual([]);
  });

  it('course 1 lists six lessons in order; lesson 0 is written', () => {
    const course = COURSES[0]!;
    expect(course.lessons.map((l) => l.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(isPlanned(lesson0)).toBe(false);
  });

  it('every written lesson keeps its explanation between 400 and 1,000 words', () => {
    for (const course of COURSES) {
      for (const lesson of course.lessons) if (!isPlanned(lesson)) expect(chunkWords(lesson)).toBeGreaterThanOrEqual(400);
      for (const lesson of course.lessons) if (!isPlanned(lesson)) expect(chunkWords(lesson)).toBeLessThanOrEqual(1000);
    }
  });

  it('lesson 0 has no code, a drawing, every exercise type and two or three sourced errors', () => {
    expect(JSON.stringify(lesson0)).not.toMatch(/"code":/);
    expect(lesson0.chunks.some((c) => c.drawing)).toBe(true);
    expect(new Set(lesson0.exercises.map((e) => e.type))).toEqual(new Set(['predict', 'blank', 'fix']));
    expect(lesson0.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("the pretest is the lesson's three cards with the best frequency rank", () => {
    const pretest = pretestCards(lesson0, cards);
    expect(pretest).toHaveLength(3);
    const ranks = lesson0.cardIds.map((id) => cards.find((c) => c.id === id)!.rank).sort((a, b) => a - b);
    expect(pretest.map((c) => c.rank)).toEqual(ranks.slice(0, 3));
  });
});

describe('term check (decision 34)', () => {
  it('passes every course on disk', () => {
    for (const course of COURSES) expect(checkCourse(course, cards)).toEqual([]);
  });

  it('fails a lesson that uses an unmet card in code font, naming the lesson and the token', () => {
    const course = structuredClone(COURSES[0]) as Course;
    const lesson = course.lessons[0] as CourseLesson;
    lesson.chunks[0]!.text += ' A `Timer` counts down.';
    const errors = checkCourse(course, cards) as string[];
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/lesson c1-l0/);
    expect(errors[0]).toMatch(/`Timer` in code font .* is not a card the learner has met; add api:class:Timer/);
  });

  it('checks code blocks, member calls and gd keywords, and skips strings, comments and local names', () => {
    const lesson = {
      id: 'x', order: 0, title: 'T', cardIds: ['api:class:Node'],
      chunks: [{ text: 'Plain words: timer, scene.', code: 'func _ready():\n\tvar speed = "Timer"  # Sprite2D\n\tadd_child(Node.new())' }],
    };
    const errors = checkCourse({ id: 'c', title: 'C', lessons: [lesson] }, cards) as string[];
    expect(errors.join('\n')).toMatch(/`func`/);
    expect(errors.join('\n')).toMatch(/`_ready`/);
    expect(errors.join('\n')).toMatch(/`add_child`/);
    expect(errors.join('\n')).not.toMatch(/Timer|Sprite2D|speed|`Node`/);
  });

  it("counts an earlier lesson's cards as met, and fails a class the decks lack", () => {
    const course = {
      id: 'c', title: 'C',
      lessons: [
        { id: 'a', order: 0, title: 'A', cardIds: ['api:class:Timer'], need: '' },
        { id: 'b', order: 1, title: 'B', cardIds: [], need: 'A `Timer` and a `Spatial`.' },
      ],
    };
    const errors = checkCourse(course, cards) as string[];
    expect(errors).toEqual([expect.stringMatching(/lesson b .*`Spatial` .* is not a card in the decks/)]);
  });
});

describe('typed blank (decision 35)', () => {
  it('accepts only the exact word', () => {
    expect(judgeBlank('CharacterBody2D', 'CharacterBody2D', 0)).toEqual({ verdict: 'right', misses: 0 });
    expect(judgeBlank('  CharacterBody2D ', 'CharacterBody2D', 1)).toEqual({ verdict: 'right', misses: 1 });
  });

  it('gives the case hint when only the case differs, and counts it as a miss', () => {
    expect(judgeBlank('characterbody2d', 'CharacterBody2D', 0)).toEqual({ verdict: 'case', misses: 1 });
    expect(judgeBlank('Sprite2D', 'CharacterBody2D', 0)).toEqual({ verdict: 'wrong', misses: 1 });
  });

  it('shows the answer after two misses; an empty field is not a try', () => {
    expect(judgeBlank('', 'CharacterBody2D', 1)).toEqual({ verdict: 'empty', misses: 1 });
    expect(judgeBlank('Sprite2D', 'CharacterBody2D', 1)).toEqual({ verdict: 'shown', misses: 2 });
  });
});
