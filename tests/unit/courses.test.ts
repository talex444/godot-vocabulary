import { readdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { checkCourse, loadDecks } from '../../scripts/check-lessons.mjs';
import type { Card } from '../../src/cards/types';
import { judgeBlank } from '../../src/courses/blank';
import { coursesFor, findLesson, pretestCards, termName } from '../../src/courses/index';
import course1 from '../../src/data/courses/course-1.json';
import { allShown, coveredTable, isShown, reveal, shownCount } from '../../src/courses/reveal';
import {
  isPlanned,
  LESSON_WORDS_MAX,
  LESSON_WORDS_MIN,
  lessonWords,
  recallAfter,
  validateCourse,
  type Course,
  type CourseLesson,
  type LessonImage,
} from '../../src/courses/types';
import { termCourse, termLesson, TERM_CLASSES } from '../fixtures/term-lesson';

const dir = 'src/data/courses';
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const cards = loadDecks() as Card[];
const byId = new Map(cards.map((c) => [c.id, c]));
const nameOf = (id: string) => {
  const card = byId.get(id);
  return card ? termName(card) : undefined;
};
const COURSES: readonly Course[] = [course1 as Course];
const lesson0 = COURSES[0]!.lessons[0] as CourseLesson;

describe('courses per area (decision 46; done-criteria 64)', () => {
  it('course 1 belongs to the Godot area; Git & GitHub has none yet', async () => {
    expect(COURSES[0]!.area).toBe('godot');
    expect((await coursesFor('godot')).map((c) => c.id)).toEqual(['course-1']);
    expect(await coursesFor('github')).toEqual([]);
  });

  it('finds a lesson among the courses it is given', async () => {
    expect(findLesson('c1-l0', await coursesFor('godot'))?.lesson.id).toBe('c1-l0');
    expect(findLesson('c1-l0', await coursesFor('github'))).toBeUndefined();
  });

  it('rejects a course whose area is not registered', () => {
    expect(validateCourse({ ...structuredClone(course1), area: 'aseprite' })).toContain('course: area must be an area in src/areas/registry.ts');
  });
});

describe('course files (decisions 31–42)', () => {
  it.each(files)('%s matches the lesson format', (file) => {
    expect(validateCourse(JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')), nameOf)).toEqual([]);
  });

  it('course 1 lists six lessons in order, all written, one per manual page', () => {
    const course = COURSES[0]!;
    expect(course.lessons.map((l) => l.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(course.lessons.filter(isPlanned)).toEqual([]);
    expect(course.lessons.map((l) => l.page.title)).toEqual([
      "Overview of Godot's key concepts",
      'Nodes and Scenes',
      'Creating instances',
      'Creating your first script',
      'Listening to player input',
      'Using signals',
    ]);
  });

  it('lessons 1–5 each have a predict, a typed blank, a fix and two or three sourced errors', () => {
    for (const lesson of COURSES[0]!.lessons.slice(1) as CourseLesson[]) {
      const types = lesson.exercises.map((e) => e.type);
      expect(types, lesson.id).toEqual(expect.arrayContaining(['predict', 'blank', 'fix']));
      expect(lesson.cardIds.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(lesson.errors.length, lesson.id).toBeGreaterThanOrEqual(2);
      expect(lesson.errors.length, lesson.id).toBeLessThanOrEqual(3);
      for (const e of lesson.errors) expect(e.source, lesson.id).toMatch(/^(Godot manual, |Sorva 2012, Table A\.1, row \d+)/);
    }
    // Lesson 3 is the first with code: a typed blank inside code and a code fix.
    const lesson3 = COURSES[0]!.lessons[3] as CourseLesson;
    expect(lesson3.exercises.some((e) => e.type === 'blank' && e.code)).toBe(true);
    expect(lesson3.exercises.some((e) => e.type === 'fix' && !e.plain)).toBe(true);
  });

  it("every picture exists in public/courses/img at the size the lesson states", async () => {
    const images: LessonImage[] = [];
    const collect = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === 'object') {
        if ('src' in v && 'alt' in v) images.push(v as LessonImage);
        Object.values(v).forEach(collect);
      }
    };
    COURSES.forEach(collect);
    expect(images.length).toBeGreaterThan(20);
    for (const image of images) {
      const meta = await sharp(`public/courses/img/${image.src}`).metadata();
      expect([meta.width, meta.height], image.src).toEqual([image.width, image.height]);
    }
  });

  it('every written lesson keeps its explanation between LESSON_WORDS_MIN and LESSON_WORDS_MAX words (decision 72; the cap is provisional, decision 73)', () => {
    expect([LESSON_WORDS_MIN, LESSON_WORDS_MAX]).toEqual([400, 2400]);
    for (const course of COURSES) {
      for (const lesson of course.lessons) {
        if (isPlanned(lesson)) continue;
        expect(lessonWords(lesson), lesson.id).toBeGreaterThanOrEqual(LESSON_WORDS_MIN);
        expect(lessonWords(lesson), lesson.id).toBeLessThanOrEqual(LESSON_WORDS_MAX);
      }
    }
  });

  it('lesson 0 has no code, a drawing, every exercise type and two or three sourced errors', () => {
    expect(JSON.stringify(lesson0)).not.toMatch(/"code":/);
    expect(lesson0.chunks!.some((c) => c.drawing)).toBe(true);
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

describe('the term format (decision 71)', () => {
  /** The fixture course with one change made to its lesson; returns validateCourse's errors. */
  const errorsAfter = (change: (lesson: CourseLesson) => void, names?: readonly string[]) => {
    const course = termCourse(names);
    change(course.lessons[0] as CourseLesson);
    return validateCourse(course, nameOf);
  };
  const at = 'lesson tl-0';

  it('a term lesson validates, with and without the card names; 5, 8 and 9 terms', () => {
    expect(validateCourse(termCourse(), nameOf)).toEqual([]);
    expect(validateCourse(termCourse())).toEqual([]);
    expect(validateCourse(termCourse(TERM_CLASSES.slice(0, 8)), nameOf)).toEqual([]);
    expect(validateCourse(termCourse(TERM_CLASSES), nameOf)).toEqual([]);
  });

  it('the recall checks sit after every fourth term and after the last', () => {
    expect([1, 3, 4, 5, 8, 9, 12, 15].map(recallAfter)).toEqual([[1], [3], [4], [4, 5], [4, 8], [4, 8, 9], [4, 8, 12], [4, 8, 12, 15]]);
  });

  it('a lesson has chunks or terms: never both, never neither', () => {
    expect(errorsAfter((l) => (l.chunks = structuredClone(lesson0.chunks)))).toContain(`${at}: has both chunks and terms; write the lesson in one format`);
    expect(errorsAfter((l) => { delete l.terms; delete l.recall; })).toContain(`${at}: no chunks and no terms; a written lesson needs one of them`);
    expect(errorsAfter((l) => (l.terms = []))).toContain(`${at}: no terms`);
    expect(errorsAfter((l) => { delete l.terms; l.chunks = structuredClone(lesson0.chunks); })).toContain(`${at}: recall checks belong to a term lesson`);
  });

  it('every cardId has exactly one term, and every term is one of the cardIds', () => {
    expect(errorsAfter((l) => l.terms!.pop())).toEqual(expect.arrayContaining([`${at} card api:class:Timer: has no term section; every cardId needs one`]));
    expect(errorsAfter((l) => (l.terms![1]!.cardId = 'api:class:Label'))).toEqual(
      expect.arrayContaining([`${at} term 1 (api:class:Label): cardId is not one of the lesson’s cardIds`, `${at} card api:class:Node2D: has no term section; every cardId needs one`]),
    );
    expect(errorsAfter((l) => (l.terms![2]!.cardId = 'api:class:Node'))).toContain(`${at} term 2 (api:class:Node): term 0 already teaches this card`);
  });

  it('every part is there: a part left out fails, naming the term and the part', () => {
    const t = `${at} term 1 (api:class:Node2D)`;
    const cases: [(term: Record<string, unknown>) => void, string][] = [
      [(x) => delete x.what, `${t}: (1) what it is: text missing`],
      [(x) => delete x.when, `${t}: (2) when you’d reach for it: missing`],
      [(x) => delete x.where, `${t}: (3) where it lives: text missing`],
      [(x) => delete x.example, `${t}: (4) example: text missing`],
      [(x) => ((x.contrast as { other: string }).other = ' '), `${t}: (5) not to be confused with: the other’s name missing`],
      [(x) => ((x.contrast as { text: string }).text = ''), `${t}: (5) not to be confused with: text missing`],
      [(x) => delete x.check, `${t} (6) check: prompt, answer and why required`],
    ];
    for (const [change, message] of cases) expect(errorsAfter((l) => change(l.terms![1] as unknown as Record<string, unknown>))).toContain(message);
  });

  it('what it is quotes the manual and cites its page', () => {
    const t = `${at} term 0 (api:class:Node)`;
    expect(errorsAfter((l) => (l.terms![0]!.what.text = 'A Node is a building block.'))).toEqual([`${t}: (1) what it is: needs the manual’s own words in “quotes”`]);
    expect(errorsAfter((l) => (l.terms![0]!.what.page = { title: 'x', url: 'https://example.com/' }))).toEqual([`${t} (1) what it is: page url must be a docs.godotengine.org link`]);
  });

  it('pictures and drawings in where and example are validated as today', () => {
    const t = `${at} term 0 (api:class:Node)`;
    expect(errorsAfter((l) => (l.terms![0]!.where.image!.alt = ''))).toEqual([`${t} (3) where it lives image: image alt missing`]);
    expect(errorsAfter((l) => (l.terms![0]!.example.image = { src: 'a b.jpg', alt: 'a', caption: 'c', width: 1, height: 1 }))).toEqual([`${t} (4) example image: image src must be a file name`]);
    expect(errorsAfter((l) => l.terms![0]!.example.drawing!.nodes.pop())).toEqual([`${t} (4) example drawing: drawing needs at least two nodes`]);
    expect(errorsAfter((l) => (l.terms![0]!.example.code = ''))).toEqual([`${t} (4) example: empty code`]);
  });

  it("the check asks for the term's own name, with the term hidden; its choices hold the answer once", () => {
    const t = `${at} term 0 (api:class:Node) (6) check`;
    expect(errorsAfter((l) => (l.terms![0]!.check.answer = 'Node2D'))).toContain(`${t}: the answer must be the term’s own name, “Node”`);
    expect(errorsAfter((l) => (l.terms![0]!.check.prompt = 'Which class is the Node?'))).toEqual([`${t}: the prompt names the answer “Node”; describe it instead`]);
    // A longer name that only starts with the answer does not give it away.
    expect(errorsAfter((l) => (l.terms![0]!.check.prompt = 'Which class does Node2D extend?'))).toEqual([]);
    expect(errorsAfter((l) => (l.terms![0]!.check.choices = ['Node2D', 'Sprite2D', 'Camera2D', 'Timer']))).toEqual([`${t}: the choices must include the answer once`]);
    expect(errorsAfter((l) => (l.terms![0]!.check.choices = ['Node', 'Node', 'Camera2D', 'Timer']))).toEqual([`${t}: choices repeat`, `${t}: the choices must include the answer once`]);
    expect(errorsAfter((l) => ((l.terms![0]!.check as { choices: string[] }).choices = ['Node', 'Timer']))).toEqual([`${t}: four choices required`]);
  });

  it('one recall per four terms, each asking for a term above it', () => {
    expect(errorsAfter((l) => l.recall!.pop())).toEqual([`${at}: recall must hold 2 checks for 5 terms (one after every fourth term and one after the last)`]);
    expect(errorsAfter((l) => delete l.recall)).toEqual([`${at}: recall must hold 2 checks for 5 terms (one after every fourth term and one after the last)`]);
    // The first recall sits after term 4 (Camera2D); Timer is term 5, below it.
    expect(errorsAfter((l) => (l.recall![0]!.answer = 'Timer'))).toEqual([`${at} recall 0: “Timer” is not the name of a term above it`]);
    expect(errorsAfter((l) => (l.recall![1]!.answer = 'Node'))).toEqual([]);
    expect(errorsAfter((l) => (l.recall![1]!.prompt = 'Which class was the Timer?'))).toEqual([`${at} recall 1: the prompt names the answer “Timer”; describe it instead`]);
  });

  it('counts a term lesson’s words in its five prose parts, a chunk lesson’s in its chunks', () => {
    const lesson = termLesson(['Node', 'Node2D', 'Sprite2D']);
    const t = lesson.terms![0]!;
    const per = [t.what.text, t.when, t.where.text, t.example.text, t.contrast.text].join(' ').split(/\s+/).length;
    expect(lessonWords(lesson)).toBe(3 * per);
    lesson.terms![0]!.check.why = 'many more words that are never counted at all';
    expect(lessonWords(lesson)).toBe(3 * per);
    expect(lessonWords(lesson0)).toBe(lesson0.chunks!.reduce((n, c) => n + c.text.split(/\s+/).filter(Boolean).length, 0));
  });
});

describe('term check (decision 34)', () => {
  it('passes every course on disk', () => {
    for (const course of COURSES) expect(checkCourse(course, cards)).toEqual([]);
  });

  it('fails a lesson that uses an unmet card in code font, naming the lesson and the token', () => {
    const course = structuredClone(COURSES[0]) as Course;
    const lesson = course.lessons[0] as CourseLesson;
    lesson.chunks![0]!.text += ' A `Timer` counts down.';
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

describe('course-end table (decision 41)', () => {
  const lesson5 = COURSES[0]!.lessons[5] as CourseLesson;

  it('ends course 1: Node2D, Control and Node3D against the three questions, every cell filled', () => {
    expect(lesson5.table!.rows.map((r) => r.head)).toEqual(['Node2D', 'Control', 'Node3D']);
    expect(lesson5.table!.columns).toEqual(['draws on screen', 'has a position', 'lives in which tree']);
    for (const row of lesson5.table!.rows) for (const cell of row.cells) expect(cell.trim().length, row.head).toBeGreaterThan(10);
    expect(COURSES[0]!.lessons.filter((l) => !isPlanned(l) && l.table)).toEqual([lesson5]);
  });

  it('starts every cell covered and uncovers one cell per tap, for good', () => {
    let state = coveredTable(lesson5.table!);
    expect(shownCount(state)).toBe(0);
    state = reveal(state, 0, 1);
    expect(isShown(state, 0, 1)).toBe(true);
    expect(isShown(state, 1, 0)).toBe(false);
    expect(reveal(state, 0, 1)).toBe(state);
    expect(reveal(state, 3, 0)).toBe(state);
    expect(reveal(state, 0, -1)).toBe(state);
    expect(shownCount(state)).toBe(1);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) state = reveal(state, r, c);
    expect(shownCount(state)).toBe(9);
    expect(allShown(state)).toBe(true);
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
