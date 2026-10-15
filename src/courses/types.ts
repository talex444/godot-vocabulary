/**
 * The lesson format (decisions 31–42). Course files live in `src/data/courses/` and are hand-written;
 * `scripts/check-lessons.mjs` runs the term check at build time and `tests/unit/courses.test.ts`
 * checks every file against `validateCourse`.
 *
 * Text fields use the card screens' inline rule: `inline code` in JetBrains Mono, `____` as a slot.
 */

import { getArea, type AreaId } from '../areas/registry';

export interface Course {
  id: string;
  /** The area the course belongs to (decision 46); its courses load with the area. */
  area: AreaId;
  title: string;
  lessons: (CourseLesson | PlannedLesson)[];
}

/** The manual page a lesson is written from. */
export interface LessonPage {
  title: string;
  url: string;
}

/** A lesson listed in the course but not written yet ("coming in a later version"). */
export interface PlannedLesson {
  id: string;
  order: number;
  title: string;
  page: LessonPage;
  planned: true;
}

export interface CourseLesson {
  id: string;
  order: number;
  /** The focus question. */
  title: string;
  page: LessonPage;
  /** The cards this lesson teaches (≥ 3); the pretest asks the three with the best frequency rank. */
  cardIds: string[];
  /** A short paragraph that develops the question. */
  need: string;
  agenda: [string, string, string];
  /** The old format (lessons 1–5 until they are rewritten): explanation chunks, each with a check. A lesson has `chunks` or `terms`, never both. */
  chunks?: Chunk[];
  /** The term format (decision 71): one six-part section per card, in `cardIds`' teaching order. */
  terms?: TermTreatment[];
  /** The no-peeking cumulative checks: one after every fourth term and one after the last (`recallAfter`). Only with `terms`. */
  recall?: RecallCheck[];
  compare: Compare;
  exercises: Exercise[];
  errors: LessonError[];
  /** The focus question asked back with a sentence stem (decision 39). */
  exitStem: string;
  /** The course-end tap-to-reveal table (decision 41), shown after the exit ticket and on the course list once done. */
  table?: RevealTable;
}

export interface LessonImage {
  /** File name under `public/courses/img/`, copied from the manual's own `img/` folder. */
  src: string;
  alt: string;
  caption: string;
  /** Pixel size, so the page does not shift while the picture loads. */
  width: number;
  height: number;
}

/** A scene-dock drawing built up one node at a time from the editor icons (one node only in a term's example). */
export interface TreeDrawing {
  caption: string;
  nodes: { name: string; type: string; depth: number }[];
}

/** One explanation chunk (≤ ~300 words) and the check after it. */
export interface Chunk {
  heading: string;
  text: string;
  code?: string;
  image?: LessonImage;
  drawing?: TreeDrawing;
  check: ChoiceCheck;
}

/** One term's treatment (decision 71): six parts, in this order, rendered as its own titled section. */
export interface TermTreatment {
  /** The card this term is; must be one of the lesson's cardIds, and every cardId has exactly one term. */
  cardId: string;
  /** (1) What it is: the manual's own sentences in “quotes” (decision 34), and the page they come from. */
  what: { text: string; page: LessonPage };
  /** (2) When you would reach for it: the need, before the example (Schell ch. 33). */
  when: string;
  /** (3) Where it lives in the editor: a sentence introducing the manual's screenshot of that spot (Docs for Developers ch. 6). */
  where: { text: string; image?: LessonImage };
  /** (4) One worked example: a drawing (lesson 0, no code: decision 38) or code shown line by line (from lesson 3: decision 32), never run. */
  example: { text: string; drawing?: TreeDrawing; code?: string; image?: LessonImage };
  /** (5) Not to be confused with: one contrast or non-example, naming the other thing. */
  contrast: { other: string; text: string };
  /** (6) The check, with the term hidden: its description, and the learner produces the name. */
  check: RecallCheck;
}

/** A check that asks for a term from its description. With `choices`, four names to pick from; without, the name is typed. Never shows the sentence the answer sits in. */
export interface RecallCheck {
  prompt: string;
  /** The term's name as the learner must produce it (a class name, a dock's name). */
  answer: string;
  choices?: [string, string, string, string];
  why: string;
}

/** A four-choice question: predict the output, or which statement is true. */
export interface ChoiceCheck {
  prompt: string;
  code?: string;
  choices: [string, string, string, string];
  /** Index of the right choice. */
  answer: number;
  /** One sentence: why the right answer is right. */
  why: string;
}

export interface Example {
  title: string;
  text: string;
  code?: string;
  image?: LessonImage;
  drawing?: TreeDrawing;
}

/** A second example beside the first: what do they share, how is one different. */
export interface Compare {
  a: Example;
  b: Example;
  question: ChoiceCheck;
}

export type Exercise = PredictExercise | BlankExercise | FixExercise;

export interface PredictExercise extends ChoiceCheck {
  type: 'predict';
}

/** Type the one missing word into the gap (`____`) in `code` or, when there is no code, in `text`. */
export interface BlankExercise {
  type: 'blank';
  prompt: string;
  text?: string;
  code?: string;
  answer: string;
  why: string;
}

/** Which of four lines is the bug; `fixed` is the corrected line. `plain` lines are prose, not code. */
export interface FixExercise {
  type: 'fix';
  prompt: string;
  lines: [string, string, string, string];
  answer: number;
  fixed: string;
  why: string;
  plain?: boolean;
}

/** "What you'll see when it's wrong" (decision 42). */
export interface LessonError {
  what: string;
  fix: string;
  source: string;
}

/** Decision 41's comparison table: every cell is guessed, then revealed. */
export interface RevealTable {
  caption: string;
  columns: string[];
  rows: { head: string; cells: string[] }[];
}

export function isPlanned(lesson: CourseLesson | PlannedLesson): lesson is PlannedLesson {
  return 'planned' in lesson && lesson.planned === true;
}

/** The fewest words a written lesson's explanation may have. */
export const LESSON_WORDS_MIN = 400;

/**
 * The most words a written lesson's explanation may have: one cap for the whole lesson, never one per
 * term (decision 72). PROVISIONAL at 2,400: decision 73 sets the figure from the rewritten lesson 0
 * (its length plus a tenth) after Tyler has read it and said the length is right.
 */
export const LESSON_WORDS_MAX = 2400;

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Words in a lesson's explanation (what the word budget counts): a chunk lesson's chunk texts; a term
 * lesson's five prose parts of every term (what, when, where, example, contrast). Checks are not counted.
 */
export function lessonWords(lesson: CourseLesson): number {
  if (lesson.terms) {
    return lesson.terms.reduce((n, t) => n + [t.what.text, t.when, t.where.text, t.example.text, t.contrast.text].reduce((m, s) => m + words(s), 0), 0);
  }
  return (lesson.chunks ?? []).reduce((n, c) => n + words(c.text), 0);
}

/** How many terms stand above each recall check: after every fourth term, and after the last when the count is not a multiple of four. */
export function recallAfter(termCount: number): number[] {
  return Array.from({ length: Math.ceil(termCount / 4) }, (_, i) => Math.min(4 * (i + 1), termCount));
}

/**
 * Every problem with a course file's shape; empty when it is valid. `nameOf` gives a card's displayed
 * name (`termName` in `src/courses/index.ts`); with it, each term's check must ask for its own card's name.
 */
export function validateCourse(value: unknown, nameOf?: (cardId: string) => string | undefined): string[] {
  const errors: string[] = [];
  const course = value as Partial<Course> | null;
  const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  const need = (ok: boolean, where: string, what: string) => {
    if (!ok) errors.push(`${where}: ${what}`);
  };
  if (!course || typeof course !== 'object') return ['course: not an object'];
  need(str(course.id), 'course', 'id missing');
  need(getArea(course.area) !== undefined, 'course', 'area must be an area in src/areas/registry.ts');
  need(str(course.title), 'course', 'title missing');
  if (!Array.isArray(course.lessons) || course.lessons.length === 0) return [...errors, 'course: no lessons'];

  const page = (p: unknown, at: string) => {
    const v = p as Partial<LessonPage> | undefined;
    need(str(v?.title), at, 'page title missing');
    need(str(v?.url) && /^https:\/\/docs\.godotengine\.org\//.test(v!.url!), at, 'page url must be a docs.godotengine.org link');
  };
  const image = (v: unknown, at: string) => {
    const i = v as Partial<LessonImage>;
    need(str(i?.src) && /^[\w.-]+\.(webp|png|svg|gif)$/.test(i!.src!), at, 'image src must be a file name');
    need(str(i?.alt), at, 'image alt missing');
    need(str(i?.caption), at, 'image caption missing');
    need(Number.isInteger(i?.width) && Number.isInteger(i?.height) && i!.width! > 0 && i!.height! > 0, at, 'image width and height required');
  };
  // A term's example may draw a single node: the tree as it stands when that term adds its root.
  const drawing = (v: unknown, at: string, min: 1 | 2 = 2) => {
    const d = v as Partial<TreeDrawing>;
    need(str(d?.caption), at, 'drawing caption missing');
    const nodes = Array.isArray(d?.nodes) ? d!.nodes! : [];
    need(nodes.length >= min, at, min === 1 ? 'drawing needs at least one node' : 'drawing needs at least two nodes');
    nodes.forEach((n, i) => {
      need(str(n?.name) && str(n?.type) && Number.isInteger(n?.depth) && n.depth >= 0, `${at} node ${i}`, 'name, type and depth required');
      need(i === 0 ? n?.depth === 0 : n?.depth <= nodes[i - 1]!.depth + 1, `${at} node ${i}`, 'depth jumps');
    });
  };
  const check = (v: unknown, at: string) => {
    const c = v as Partial<ChoiceCheck>;
    need(str(c?.prompt), at, 'prompt missing');
    need(Array.isArray(c?.choices) && c!.choices!.length === 4 && c!.choices!.every(str), at, 'four choices required');
    need(new Set(c?.choices ?? []).size === (c?.choices?.length ?? 0), at, 'choices repeat');
    need(Number.isInteger(c?.answer) && c!.answer! >= 0 && c!.answer! < 4, at, 'answer must be 0–3');
    need(str(c?.why), at, 'why missing');
    if (c?.code !== undefined) need(str(c.code), at, 'empty code');
  };
  const example = (v: unknown, at: string) => {
    const e = v as Partial<Example>;
    need(str(e?.title) && str(e?.text), at, 'title and text required');
    if (e?.image) image(e.image, `${at} image`);
    if (e?.drawing) drawing(e.drawing, `${at} drawing`);
  };
  const recallCheck = (v: unknown, at: string) => {
    const c = v as Partial<RecallCheck>;
    need(str(c?.prompt) && str(c?.answer) && str(c?.why), at, 'prompt, answer and why required');
    // The term is hidden: the prompt describes it and never names it.
    if (str(c?.prompt) && str(c?.answer)) need(!new RegExp(`(^|[^\\w.])${c.answer!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`).test(c.prompt!), at, `the prompt names the answer “${c.answer}”; describe it instead`);
    if (c?.choices !== undefined) {
      need(Array.isArray(c.choices) && c.choices.length === 4 && c.choices.every(str), at, 'four choices required');
      need(new Set(c.choices).size === (c.choices?.length ?? 0), at, 'choices repeat');
      need((c.choices ?? []).filter((x) => x === c.answer).length === 1, at, 'the choices must include the answer once');
    }
  };
  const term = (v: unknown, at: string) => {
    const t = v as Partial<TermTreatment>;
    need(str(t?.what?.text), at, '(1) what it is: text missing');
    if (str(t?.what?.text)) need(/“[^”]+”/.test(t!.what!.text), at, '(1) what it is: needs the manual’s own words in “quotes”');
    page(t?.what?.page, `${at} (1) what it is`);
    need(str(t?.when), at, '(2) when you’d reach for it: missing');
    need(str(t?.where?.text), at, '(3) where it lives: text missing');
    if (t?.where?.image) image(t.where.image, `${at} (3) where it lives image`);
    need(str(t?.example?.text), at, '(4) example: text missing');
    if (t?.example?.drawing) drawing(t.example.drawing, `${at} (4) example drawing`, 1);
    if (t?.example?.image) image(t.example.image, `${at} (4) example image`);
    if (t?.example?.code !== undefined) need(str(t.example.code), `${at} (4) example`, 'empty code');
    need(str(t?.contrast?.other), at, '(5) not to be confused with: the other’s name missing');
    need(str(t?.contrast?.text), at, '(5) not to be confused with: text missing');
    recallCheck(t?.check, `${at} (6) check`);
    const name = str(t?.cardId) ? nameOf?.(t!.cardId!) : undefined;
    if (name !== undefined && str(t?.check?.answer)) need(t!.check!.answer === name, `${at} (6) check`, `the answer must be the term’s own name, “${name}”`);
  };
  const gaps = (s: string | undefined) => (s?.match(/_{4,}/g) ?? []).length;

  const ids = new Set<string>();
  course.lessons.forEach((lesson, index) => {
    const at = `lesson ${String((lesson as { id?: unknown })?.id ?? index)}`;
    need(str(lesson?.id), at, 'id missing');
    need(!ids.has(lesson.id), at, 'id repeats');
    ids.add(lesson.id);
    need(lesson.order === index, at, `order must be ${index}`);
    need(str(lesson.title), at, 'title missing');
    page(lesson.page, at);
    if (isPlanned(lesson)) return;
    const l = lesson as Partial<CourseLesson>;
    need(Array.isArray(l.cardIds) && l.cardIds.length >= 3 && l.cardIds.every(str), at, 'at least three cardIds');
    need(new Set(l.cardIds ?? []).size === (l.cardIds?.length ?? 0), at, 'cardIds repeat');
    need(str(l.need), at, 'need missing');
    need(Array.isArray(l.agenda) && l.agenda.length === 3 && l.agenda.every(str), at, 'agenda must be three lines');
    // One format per lesson: chunks (lessons 1–5 until they are rewritten) or terms (decision 71).
    if (l.chunks !== undefined && l.terms !== undefined) errors.push(`${at}: has both chunks and terms; write the lesson in one format`);
    else if (l.chunks === undefined && l.terms === undefined) errors.push(`${at}: no chunks and no terms; a written lesson needs one of them`);
    else if (l.chunks !== undefined) need(Array.isArray(l.chunks) && l.chunks.length > 0, at, 'no chunks');
    else need(Array.isArray(l.terms) && l.terms.length > 0, at, 'no terms');
    if (l.recall !== undefined && l.terms === undefined) errors.push(`${at}: recall checks belong to a term lesson`);
    if (Array.isArray(l.terms)) {
      const cardIds = Array.isArray(l.cardIds) ? l.cardIds : [];
      const taught = new Map<string, number>();
      l.terms.forEach((t, i) => {
        const where = `${at} term ${i} (${String(t?.cardId)})`;
        need(str(t?.cardId), where, 'cardId missing');
        if (str(t?.cardId)) {
          need(cardIds.includes(t.cardId), where, 'cardId is not one of the lesson’s cardIds');
          if (taught.has(t.cardId)) errors.push(`${where}: term ${taught.get(t.cardId)} already teaches this card`);
          else taught.set(t.cardId, i);
        }
        term(t, where);
      });
      for (const id of cardIds) need(taught.has(id), `${at} card ${id}`, 'has no term section; every cardId needs one');
      // Each recall sits after a group of four terms and asks for a term whose section is above it.
      const after = recallAfter(l.terms.length);
      const recall = Array.isArray(l.recall) ? l.recall : [];
      need(recall.length === after.length, at, `recall must hold ${after.length} check${after.length === 1 ? '' : 's'} for ${l.terms.length} terms (one after every fourth term and one after the last)`);
      const nameOfTerm = (t: TermTreatment) => (str(t?.cardId) ? nameOf?.(t.cardId) : undefined) ?? t?.check?.answer;
      recall.forEach((r, i) => {
        const where = `${at} recall ${i}`;
        recallCheck(r, where);
        const above = l.terms!.slice(0, after[i] ?? l.terms!.length).map(nameOfTerm);
        if (str(r?.answer)) need(above.includes(r.answer), where, `“${r.answer}” is not the name of a term above it`);
      });
    }
    (l.chunks ?? []).forEach((c, i) => {
      const where = `${at} chunk ${i}`;
      need(str(c?.heading) && str(c?.text), where, 'heading and text required');
      if (c?.image) image(c.image, `${where} image`);
      if (c?.drawing) drawing(c.drawing, `${where} drawing`);
      check(c?.check, `${where} check`);
    });
    example(l.compare?.a, `${at} compare a`);
    example(l.compare?.b, `${at} compare b`);
    check(l.compare?.question, `${at} compare question`);
    need(Array.isArray(l.exercises) && l.exercises.length > 0, at, 'no exercises');
    (l.exercises ?? []).forEach((e, i) => {
      const where = `${at} exercise ${i}`;
      if (e?.type === 'predict') check(e, where);
      else if (e?.type === 'blank') {
        need(str(e.prompt) && str(e.answer) && str(e.why), where, 'prompt, answer and why required');
        need(gaps(e.text) + gaps(e.code) === 1, where, 'exactly one ____ gap in text or code');
        need(!/\s/.test(e.answer ?? ''), where, 'the answer is one word');
      } else if (e?.type === 'fix') {
        need(str(e.prompt) && str(e.fixed) && str(e.why), where, 'prompt, fixed and why required');
        need(Array.isArray(e.lines) && e.lines.length === 4 && e.lines.every(str), where, 'four lines required');
        need(Number.isInteger(e.answer) && e.answer >= 0 && e.answer < 4, where, 'answer must be 0–3');
        need(e.fixed !== e.lines?.[e.answer], where, 'fixed must differ from the buggy line');
      } else errors.push(`${where}: type must be predict, blank or fix`);
    });
    need(Array.isArray(l.errors) && l.errors.length >= 2 && l.errors.length <= 3, at, 'two or three errors');
    (l.errors ?? []).forEach((e, i) => need(str(e?.what) && str(e?.fix) && str(e?.source), `${at} error ${i}`, 'what, fix and source required'));
    need(str(l.exitStem), at, 'exitStem missing');
    if (l.table) {
      const t = l.table;
      need(str(t.caption) && Array.isArray(t.columns) && t.columns.length > 0, `${at} table`, 'caption and columns required');
      (t.rows ?? []).forEach((r, i) => need(str(r?.head) && r.cells?.length === t.columns.length, `${at} table row ${i}`, 'one cell per column'));
    }
  });
  return errors;
}
