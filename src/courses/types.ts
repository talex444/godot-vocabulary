/**
 * The lesson format (decisions 31–42). Course files live in `src/data/courses/` and are hand-written;
 * `scripts/check-lessons.mjs` runs the term check at build time and `tests/unit/courses.test.ts`
 * checks every file against `validateCourse`.
 *
 * Text fields use the card screens' inline rule: `inline code` in JetBrains Mono, `____` as a slot.
 */

export interface Course {
  id: string;
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
  chunks: Chunk[];
  compare: Compare;
  exercises: Exercise[];
  errors: LessonError[];
  /** The focus question asked back with a sentence stem (decision 39). */
  exitStem: string;
  /** The course-end tap-to-reveal table (decision 41); stored, not rendered yet. */
  table?: RevealTable;
}

export interface LessonImage {
  /** File name under `public/courses/img/`, copied from the manual's own `img/` folder. */
  src: string;
  alt: string;
  caption: string;
}

/** A scene-dock drawing built up one node at a time from the editor icons. */
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

/** Words in the explanation chunks (what the 400–1,000 word budget counts). */
export function chunkWords(lesson: CourseLesson): number {
  return lesson.chunks.reduce((n, c) => n + c.text.split(/\s+/).filter(Boolean).length, 0);
}

/** Every problem with a course file's shape; empty when it is valid. */
export function validateCourse(value: unknown): string[] {
  const errors: string[] = [];
  const course = value as Partial<Course> | null;
  const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  const need = (ok: boolean, where: string, what: string) => {
    if (!ok) errors.push(`${where}: ${what}`);
  };
  if (!course || typeof course !== 'object') return ['course: not an object'];
  need(str(course.id), 'course', 'id missing');
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
  };
  const drawing = (v: unknown, at: string) => {
    const d = v as Partial<TreeDrawing>;
    need(str(d?.caption), at, 'drawing caption missing');
    const nodes = Array.isArray(d?.nodes) ? d!.nodes! : [];
    need(nodes.length >= 2, at, 'drawing needs at least two nodes');
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
    need(Array.isArray(l.chunks) && l.chunks.length > 0, at, 'no chunks');
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
