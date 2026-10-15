import type { Card } from '../../cards/types';
import { judgeBlank, judgeRecall, type BlankVerdict } from '../../courses/blank';
import { familyTraits, getArea, type AreaId } from '../../areas/registry';
import { cardsToAdd, finishedText, finishLabel } from '../../courses/finish';
import { coursesFor, findLesson, pretestCards, sessionLessons, termName } from '../../courses/index';
import { TERM_PARTS, termPage, type TermPageItem } from '../../courses/terms';
import {
  isPlanned,
  type BlankExercise,
  type ChoiceCheck,
  type CourseLesson,
  type Example,
  type FixExercise,
  type LessonImage,
  type LessonPage,
  type RecallCheck,
  type TreeDrawing,
} from '../../courses/types';
import { drawChoices } from '../../session/choices';
import { loadCards } from '../../session/deck';
import { getExitTicket, getLessonsDoneIds, getProgress, getSkippedIds, markDoneSettings, markLessonDone, saveExitTicket } from '../../store/db';
import type { Nav } from '../app';
import { asset, button, choiceRow, codeBlock, el, gapField, heading, icon, inlineRich, panel, setChoiceState, textField } from '../kit';
import { revealTable } from './reveal-table';

/**
 * One lesson as one scrolling page (decision 37): question, pretest, the need, agenda, explanation
 * chunks each with a check (or, in a term lesson, the term list, the six-part term sections and the
 * recall steps: decision 71), compare, exercises, "what you'll see when it's wrong", exit ticket, the
 * Finish button. Nothing here touches the scheduler (decision 36); finishing records the lesson and
 * turns course mode on, then says so in place, with the next lesson and the course list (decision 69c).
 */
export async function lessonScreen(nav: Nav, lessonId: string, area: AreaId): Promise<HTMLElement> {
  const courses = await coursesFor(area);
  const found = findLesson(lessonId, courses);
  if (!found) throw new Error(`No lesson ${lessonId}.`);
  const { course, lesson } = found;
  const [cards, ticket, seen, skipped, lessonsDone] = await Promise.all([
    loadCards(course.area),
    getExitTicket(lessonId),
    getProgress(lesson.cardIds).then((p) => new Set(p.keys())),
    getSkippedIds(),
    getLessonsDoneIds(),
  ]);
  const cardsById = new Map(cards.map((c) => [c.id, c]));
  const courseNumber = courses.indexOf(course) + 1;

  const exercisesHeading = stepHeading('Exercises');
  exercisesHeading.id = 'lesson-exercises';
  const skipLink = button('Skip to the exercises', {
    variant: 'flat',
    onClick: () => {
      exercisesHeading.scrollIntoView({ block: 'start' });
      exercisesHeading.focus({ preventScroll: true });
    },
  });
  skipLink.classList.add('gv-link');
  skipLink.hidden = true;

  const pretest = pretestCards(lesson, cards);
  let pretestRight = 0;
  let pretestAnswered = 0;
  const pretestItems = pretest.map((card, i) =>
    pretestItem(card, i, cardsById, (correct) => {
      pretestAnswered++;
      if (correct) pretestRight++;
      // A perfect pretest offers the skip (decision 40); the explanation stays on the page.
      if (pretestAnswered === pretest.length && pretestRight === pretest.length) skipLink.hidden = false;
    }),
  );

  const ticketField = textField({ label: lesson.exitStem, multiline: true, value: ticket?.text });
  const ticketStatus = el('p', { class: 'gv-result', attrs: { role: 'status' } });
  const saveTicket = button('Save', {
    variant: 'secondary',
    onClick: async () => {
      await saveExitTicket(lesson.id, ticketField.input.value);
      ticketStatus.textContent = ticketField.input.value.trim() ? 'Saved on this device.' : 'Cleared.';
    },
  });

  // The button says what finishing does (decision 69e); the count is read before the tap, so the line after it matches.
  const again = lessonsDone.includes(lesson.id);
  const added = cardsToAdd({
    lesson,
    lessons: sessionLessons(courses),
    lessonsDone,
    cardIds: new Set(cardsById.keys()),
    seen,
    skipped,
  }).length;
  const nextLesson = course.lessons
    .filter((l): l is CourseLesson => !isPlanned(l))
    .sort((a, b) => a.order - b.order)
    .find((l) => l.order > lesson.order);
  // A live region from the start, so the line is announced when it fills.
  const finished = el('p', { class: 'gv-finish__status', attrs: { 'aria-live': 'polite' } });
  const backNav = el('nav', { class: 'gv-links', attrs: { 'aria-label': 'Back' } }, [button('Back to courses', { variant: 'secondary', onClick: () => nav.back() })]);
  const markDone = button(finishLabel(added, again), {
    variant: 'primary',
    onClick: async () => {
      markDone.disabled = true;
      await markLessonDone(lesson.id);
      // The first finished lesson switches course mode on for its course's area (decision 36).
      await markDoneSettings(course.area);
      // No automatic navigation: the button gives way to what happened and the two ways on.
      finished.textContent = finishedText(lesson.order, added, again, getArea(course.area)?.label ?? 'Godot', nextLesson ? undefined : courseNumber);
      const next = nextLesson ? button(`Next: Lesson ${nextLesson.order}`, { variant: 'primary', onClick: () => nav.lesson(nextLesson.id, true) }) : null;
      const back = button('Back to courses', { variant: 'secondary', onClick: () => nav.back() });
      for (const b of [next, back]) b?.classList.add('gv-wide');
      markDone.replaceWith(el('div', { class: 'gv-stack gv-finish' }, [next, back]));
      // The page's own Back to courses would now say the same thing twice.
      backNav.remove();
      (next ?? back).focus();
    },
  });
  markDone.classList.add('gv-wide');

  const pageLink = manualLink(lesson.page);

  const root = el('div', { class: 'gv-screen gv-lesson', attrs: { 'data-lesson-id': lesson.id } }, [
    panel(
      [
        el('p', { class: 'gv-card__family', text: `Course ${courseNumber} · Lesson ${lesson.order}` }),
        heading(lesson.title),
        pageLink,
        ticket
          ? el('div', { class: 'gv-ticket', attrs: { role: 'group', 'aria-label': 'Your exit ticket' } }, [
              el('p', { class: 'gv-label', text: 'Your exit ticket' }),
              el('p', { class: 'gv-ticket__text' }, [el('span', { class: 'gv-note', text: `${lesson.exitStem} ` }), ticket.text]),
            ])
          : null,
      ],
      { class: 'gv-stack' },
    ),
    step('pretest', [
      stepHeading('Before you start'),
      el('p', { class: 'gv-note', text: 'Three cards from this lesson, asked before it teaches them. Guess if you must; nothing here is scored.' }),
      ...pretestItems,
      skipLink,
    ]),
    step('need', [
      stepHeading('Why it matters'),
      ...paragraphs(lesson.need),
      el('p', { class: 'gv-label', text: 'In this lesson' }),
      el('ol', { class: 'gv-agenda' }, lesson.agenda.map((line) => el('li', {}, inlineRich(line)))),
    ]),
    // A term lesson (decision 71) has its term list and sections here; a chunk lesson its chunks.
    ...(lesson.terms
      ? termSteps(lesson, cardsById)
      : (lesson.chunks ?? []).map((chunk, i) =>
          step(`chunk-${i}`, [
            stepHeading(chunk.heading),
            ...paragraphs(chunk.text),
            chunk.code ? codeBlock(chunk.code) : null,
            chunk.drawing ? treeDrawing(chunk.drawing) : null,
            chunk.image ? figure(chunk.image) : null,
            choiceCheck(chunk.check, `check-${i}`),
          ]),
        )),
    step('compare', [
      stepHeading('Compare'),
      el('div', { class: 'gv-compare' }, [example(lesson.compare.a), example(lesson.compare.b)]),
      choiceCheck(lesson.compare.question, 'compare'),
    ]),
    step('exercises', [
      exercisesHeading,
      ...lesson.exercises.map((exercise, i) =>
        exercise.type === 'blank'
          ? blankExercise(exercise, i, [...cardsById.values()].some((c) => familyTraits(c.family).plainNames && termName(c) === exercise.answer))
          : exercise.type === 'fix'
            ? fixExercise(exercise, i)
            : choiceCheck(exercise, `exercise-${i}`, 'predict'),
      ),
    ]),
    step('errors', [
      stepHeading('What you’ll see when it’s wrong'),
      el(
        'ul',
        { class: 'gv-errors-list' },
        lesson.errors.map((e) =>
          el('li', { class: 'gv-error-item' }, [
            el('p', {}, inlineRich(e.what)),
            el('p', {}, [el('strong', { class: 'gv-fix-label', text: 'Fix: ' }), ...inlineRich(e.fix)]),
            el('p', { class: 'gv-note', text: `Source: ${e.source}` }),
          ]),
        ),
      ),
    ]),
    step('exit', [
      stepHeading('Exit ticket'),
      el('p', { class: 'gv-card__prompt', text: lesson.title }),
      el('p', { class: 'gv-note', text: 'Finish the sentence in your own words. Optional, never scored, kept only on this device.' }),
      ticketField.root,
      el('div', { class: 'gv-row' }, [saveTicket]),
      ticketStatus,
      // The course-end table (decision 41) sits after the exit ticket, before the Finish button.
      lesson.table ? el('h4', { class: 'gv-family__name', text: `Course ${courseNumber} in one table` }) : null,
      lesson.table ? revealTable(lesson.table) : null,
      finished,
      markDone,
    ]),
    backNav,
  ]);
  return root;
}

function step(name: string, children: (Node | null)[]): HTMLElement {
  const node = panel(children, { class: 'gv-stack gv-step' });
  node.dataset.step = name;
  return node;
}

function stepHeading(text: string): HTMLHeadingElement {
  const h = heading(text, 3);
  h.tabIndex = -1;
  return h;
}

/** Blank-line separated paragraphs, each with the inline-code rule. */
function paragraphs(text: string): HTMLElement[] {
  return text
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => el('p', { class: 'gv-lesson__text' }, inlineRich(p.trim())));
}

/** A link to the manual page a lesson or a term quotes, opening in the browser. */
function manualLink(page: LessonPage): HTMLAnchorElement {
  return el('a', { class: 'gv-link', attrs: { href: page.url, target: '_blank', rel: 'noopener' } }, [
    `Manual: ${page.title}`,
    el('span', { class: 'gv-visually-hidden', text: ' (opens in a new tab)' }),
  ]);
}

/**
 * A term lesson's middle (decision 71): "In this lesson:" with a same-page link to each term, then one
 * step per term (its name as the heading, six labelled parts) and a Recall step after every fourth term
 * and after the last. The order is `termPage`'s.
 */
function termSteps(lesson: CourseLesson, cardsById: ReadonlyMap<string, Card>): HTMLElement[] {
  const page = termPage(lesson, (id) => {
    const card = cardsById.get(id);
    return card ? termName(card) : undefined;
  });
  const headings = new Map<string, HTMLHeadingElement>();
  // Real links, so each section has an address; a tap scrolls and focuses in place, leaving history alone.
  const links = page.list.map((item) => {
    const link = el('a', { class: 'gv-link', text: item.name, attrs: { href: item.href } });
    link.addEventListener('click', (event) => {
      const target = headings.get(item.href.slice(1));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
    });
    return el('li', {}, [link]);
  });
  const list = step('term-list', [
    el('nav', { class: 'gv-term-list', attrs: { 'aria-label': 'Terms in this lesson' } }, [el('p', { class: 'gv-label', text: 'In this lesson:' }), el('ul', {}, links)]),
  ]);
  return [list, ...page.items.map((item) => (item.kind === 'term' ? termSection(item, cardsById, headings) : recallStep(item, cardsById)))];
}

/** One term: its name as the step heading, then the six parts as a definition list. */
function termSection(item: Extract<TermPageItem, { kind: 'term' }>, cardsById: ReadonlyMap<string, Card>, headings: Map<string, HTMLHeadingElement>): HTMLElement {
  const { term } = item;
  const heading = stepHeading(item.name);
  heading.id = item.anchor;
  headings.set(item.anchor, heading);
  const other = cardsById.has(`api:class:${term.contrast.other}`)
    ? el('code', { class: 'gv-inline-code', text: term.contrast.other })
    : el('strong', { class: 'gv-fix-label', text: term.contrast.other });
  const parts: (Node | null)[][] = [
    [...paragraphs(term.what.text), manualLink(term.what.page)],
    paragraphs(term.when),
    [...paragraphs(term.where.text), term.where.image ? figure(term.where.image) : null],
    [
      ...paragraphs(term.example.text),
      term.example.drawing ? treeDrawing(term.example.drawing) : null,
      term.example.code ? codeBlock(term.example.code) : null,
      term.example.image ? figure(term.example.image) : null,
    ],
    [el('p', {}, [other]), ...paragraphs(term.contrast.text)],
    [recallControl(term.check, `term-${item.index}`, item.caseSensitive, cardsById)],
  ];
  return step(`term-${item.index}`, [
    heading,
    el('dl', { class: 'gv-term' }, TERM_PARTS.flatMap((label, i) => [el('dt', { class: 'gv-label', text: label }), el('dd', {}, parts[i]!)])),
  ]);
}

/** The no-peeking check after a group of four terms (Make It Stick ch. 2). */
function recallStep(item: Extract<TermPageItem, { kind: 'recall' }>, cardsById: ReadonlyMap<string, Card>): HTMLElement {
  return step(`recall-${item.index}`, [
    stepHeading('Recall'),
    el('p', { class: 'gv-note', text: 'From memory, without scrolling up.' }),
    recallControl(item.check, `recall-${item.index}`, item.caseSensitive, cardsById),
  ]);
}

/**
 * A recall check: the description, then four names to pick from (a class with its icon) or a field to
 * type the name in. Either ends with the verdict and the why, like the other checks.
 */
function recallControl(check: RecallCheck, name: string, caseSensitive: boolean, cardsById: ReadonlyMap<string, Card>): HTMLElement {
  const feedback = el('div', { class: 'gv-feedback', attrs: { role: 'status' } });
  const root = el('div', { class: 'gv-question gv-recall', attrs: { 'data-question': name, 'data-kind': 'recall' } }, [
    el('p', { class: 'gv-card__prompt' }, inlineRich(check.prompt)),
  ]);
  if (check.choices) {
    const choices = check.choices;
    const right = choices.indexOf(check.answer);
    const choose = (index: number) => {
      rows.forEach((row, i) => setChoiceState(row, i === index ? (i === right ? 'chosen-right' : 'chosen-wrong') : i === right ? 'revealed-right' : 'disabled'));
      root.dataset.result = index === right ? 'right' : 'wrong';
      feedback.replaceChildren(...verdict(index === right, 'Not quite. The right answer is marked.', check.why));
    };
    const rows = choices.map((text, index) => choiceRow(text, { icon: cardsById.get(`api:class:${text}`)?.icon, onChoose: () => choose(index) }));
    root.append(el('div', { class: 'gv-choices', attrs: { role: 'group', 'aria-label': 'Choices' } }, rows), feedback);
    return root;
  }
  // The field's width is fixed, so it never hints at the answer's length.
  const input = gapField('Name', 18);
  const submit = button('Check', { variant: 'secondary', onClick: () => judge() });
  const judge = typedJudge(root, input, submit, feedback, {
    answer: check.answer,
    code: caseSensitive,
    why: check.why,
    noun: 'name',
    caseHint: 'Check the case. Godot’s class names are case-sensitive.',
    judge: (typed, misses) => judgeRecall(typed, check.answer, misses, caseSensitive),
  });
  root.append(el('div', { class: 'gv-row' }, [el('label', { class: 'gv-recall__field' }, ['Name ', input]), submit]), feedback);
  return root;
}

/**
 * The judging of a typed answer, shared by the blank and the typed recall: exact match, a case hint, the
 * answer after two misses (decision 35). Returns the judge for the Check button and Enter.
 */
function typedJudge(
  root: HTMLElement,
  input: HTMLInputElement,
  submit: HTMLButtonElement,
  feedback: HTMLElement,
  o: { answer: string; code: boolean; why: string; noun: 'word' | 'name'; caseHint: string; judge: (typed: string, misses: number) => { verdict: BlankVerdict; misses: number } },
): () => void {
  let misses = 0;
  const finish = (result: 'right' | 'wrong') => {
    root.dataset.result = result;
    input.readOnly = true;
    submit.disabled = true;
  };
  const judge = () => {
    if (root.dataset.result) return;
    const result = o.judge(input.value, misses);
    misses = result.misses;
    input.setAttribute('aria-invalid', String(result.verdict !== 'right' && result.verdict !== 'empty'));
    const why = el('p', {}, inlineRich(o.why));
    switch (result.verdict) {
      case 'empty':
        feedback.replaceChildren(el('p', { text: `Type a ${o.noun} first.` }));
        input.focus();
        return;
      case 'case':
        feedback.replaceChildren(el('p', { class: 'gv-feedback__wrong', text: o.caseHint }));
        input.focus();
        return;
      case 'wrong':
        feedback.replaceChildren(el('p', { class: 'gv-feedback__wrong', text: `Not that ${o.noun}. One more try.` }));
        input.focus();
        return;
      case 'shown':
        input.value = o.answer;
        feedback.replaceChildren(
          el('p', { class: 'gv-feedback__wrong' }, ['The answer is ', o.code ? el('code', { class: 'gv-inline-code', text: o.answer }) : o.answer, '.']),
          why,
        );
        finish('wrong');
        return;
      case 'right':
        feedback.replaceChildren(el('p', { class: 'gv-feedback__right', text: misses === 0 ? 'Right.' : 'Second try, and you had it.' }), why);
        finish('right');
    }
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') judge();
  });
  return judge;
}

function figure(image: LessonImage): HTMLElement {
  return el('figure', { class: 'gv-figure' }, [
    el('img', {
      attrs: {
        src: asset(`courses/img/${image.src}`),
        alt: image.alt,
        width: String(image.width),
        height: String(image.height),
        loading: 'lazy',
        decoding: 'async',
      },
    }),
    el('figcaption', { class: 'gv-note', text: image.caption }),
  ]);
}

function example(e: Example): HTMLElement {
  return el('div', { class: 'gv-example' }, [
    el('h4', { class: 'gv-family__name', text: e.title }),
    ...paragraphs(e.text),
    e.code ? codeBlock(e.code) : null,
    e.drawing ? treeDrawing(e.drawing) : null,
    e.image ? figure(e.image) : null,
  ]);
}

/** The right/wrong line and the one-sentence why: the last thing in a check (decision 69b, no Next). */
function verdict(correct: boolean, wrongText: string, why: string): Node[] {
  return [
    el('p', { class: correct ? 'gv-feedback__right' : 'gv-feedback__wrong', text: correct ? 'Right.' : wrongText }),
    el('p', {}, inlineRich(why)),
  ];
}

/** A pretest item: the card's own question and a forward draw of its choices; never scheduled. */
function pretestItem(card: Card, index: number, cardsById: ReadonlyMap<string, Card>, onAnswer: (correct: boolean) => void): HTMLElement {
  const draw = drawChoices(card, 0, Math.random, [], cardsById);
  const feedback = el('div', { class: 'gv-feedback', attrs: { role: 'status' } });
  let answered = false;
  const rows = draw.choices.map((choice) => {
    const row = choiceRow(choice.text, {
      icon: card.icon ? `icons/${choice.text}.svg` : undefined,
      onChoose: () => {
        if (answered) return;
        answered = true;
        for (const r of rows) {
          if (r.choice === choice) setChoiceState(r.row, choice.correct ? 'chosen-right' : 'chosen-wrong');
          else if (r.choice.correct) setChoiceState(r.row, 'revealed-right');
          else setChoiceState(r.row, 'disabled');
        }
        feedback.replaceChildren(
          el('p', { class: choice.correct ? 'gv-feedback__right' : 'gv-feedback__wrong', text: choice.correct ? 'Right.' : `Not quite. It is ${card.answer}.` }),
        );
        onAnswer(choice.correct);
      },
    });
    if (choice.cardId) row.dataset.cardId = choice.cardId;
    return { choice, row };
  });
  return el('div', { class: 'gv-question', attrs: { 'data-card-id': card.id, 'data-question': `pretest-${index}` } }, [
    el('p', { class: 'gv-label', text: `${index + 1} of 3` }),
    el('p', { class: 'gv-card__prompt' }, inlineRich(card.prompt)),
    el('div', { class: 'gv-choices', attrs: { role: 'group', 'aria-label': `Choices for question ${index + 1}` } }, rows.map((r) => r.row)),
    feedback,
  ]);
}

/** A four-choice check: a chunk's check, the compare question, or a predict exercise. */
function choiceCheck(check: ChoiceCheck, name: string, kind?: 'predict'): HTMLElement {
  const feedback = el('div', { class: 'gv-feedback', attrs: { role: 'status' } });
  const rows = check.choices.map((text, index) => {
    const row = choiceRow(text, { rich: true, onChoose: () => choose(index) });
    return row;
  });
  function choose(index: number) {
    rows.forEach((row, i) => setChoiceState(row, i === index ? (i === check.answer ? 'chosen-right' : 'chosen-wrong') : i === check.answer ? 'revealed-right' : 'disabled'));
    feedback.replaceChildren(...verdict(index === check.answer, 'Not quite. The right answer is marked.', check.why));
  }
  return el('div', { class: 'gv-question', attrs: { 'data-question': name, ...(kind ? { 'data-kind': kind } : {}) } }, [
    el('p', { class: 'gv-label', text: kind === 'predict' ? 'Predict' : 'Check' }),
    el('p', { class: 'gv-card__prompt' }, inlineRich(check.prompt)),
    check.code ? codeBlock(check.code) : null,
    el('div', { class: 'gv-choices', attrs: { role: 'group', 'aria-label': 'Choices' } }, rows),
    feedback,
  ]);
}

/**
 * Type the missing word: exact match, a case hint, the answer after two misses (decision 35). When the
 * word is a plain name (a dock's, a screen's: `plainNames`), its case does not count, as in a typed recall.
 */
function blankExercise(exercise: BlankExercise, index: number, plain: boolean): HTMLElement {
  const input = gapField('Missing word', exercise.answer.length);
  const feedback = el('div', { class: 'gv-feedback', attrs: { role: 'status' } });
  const check = button('Check', { variant: 'secondary', onClick: () => judge() });
  const line = exercise.code
    ? codeBlock(exercise.code, { gap: input })
    : el('p', { class: 'gv-blank-line' }, [
        ...inlineRich(exercise.text!.split(/_{4,}/)[0] ?? ''),
        input,
        ...inlineRich(exercise.text!.split(/_{4,}/).slice(1).join('')),
      ]);
  const root = el('div', { class: 'gv-question', attrs: { 'data-question': `exercise-${index}`, 'data-kind': 'blank' } }, [
    el('p', { class: 'gv-label', text: 'Fill the blank' }),
    el('p', { class: 'gv-card__prompt' }, inlineRich(exercise.prompt)),
    line,
    el('div', { class: 'gv-row' }, [check]),
    feedback,
  ]);
  const judge = typedJudge(root, input, check, feedback, {
    answer: exercise.answer,
    code: !plain,
    why: exercise.why,
    noun: 'word',
    caseHint: 'Check the case. GDScript names are case-sensitive.',
    judge: (typed, misses) => (plain ? judgeRecall(typed, exercise.answer, misses, false) : judgeBlank(typed, exercise.answer, misses)),
  });
  return root;
}

/** Which of four lines is the bug; the corrected line follows the answer. */
function fixExercise(exercise: FixExercise, index: number): HTMLElement {
  const feedback = el('div', { class: 'gv-feedback', attrs: { role: 'status' } });
  const rows = exercise.lines.map((line, i) => {
    const row = choiceRow(line, { rich: exercise.plain, onChoose: () => choose(i) });
    if (!exercise.plain) row.classList.add('gv-choice--code');
    return row;
  });
  function choose(i: number) {
    rows.forEach((row, j) => setChoiceState(row, j === i ? (j === exercise.answer ? 'chosen-right' : 'chosen-wrong') : j === exercise.answer ? 'revealed-right' : 'disabled'));
    const fixed = exercise.plain
      ? el('p', {}, [el('strong', { class: 'gv-fix-label', text: 'Fixed: ' }), ...inlineRich(exercise.fixed)])
      : el('div', {}, [el('p', { class: 'gv-label', text: 'Fixed:' }), codeBlock(exercise.fixed)]);
    feedback.replaceChildren(...verdict(i === exercise.answer, 'Not quite. The wrong line is marked.', exercise.why), fixed);
  }
  return el('div', { class: 'gv-question', attrs: { 'data-question': `exercise-${index}`, 'data-kind': 'fix' } }, [
    el('p', { class: 'gv-label', text: 'Find the wrong line' }),
    el('p', { class: 'gv-card__prompt' }, inlineRich(exercise.prompt)),
    el('div', { class: 'gv-choices', attrs: { role: 'group', 'aria-label': 'Lines' } }, rows),
    feedback,
  ]);
}

/** The scene-dock drawing, built up one node at a time (decision 38). */
function treeDrawing(drawing: TreeDrawing): HTMLElement {
  const rows = drawing.nodes.map((node) => {
    const row = el('li', { class: 'gv-tree__row', attrs: { 'data-depth': String(node.depth) } }, [
      icon(`icons/${node.type}.svg`),
      el('span', { class: 'gv-tree__name', text: node.name }),
      node.name !== node.type ? el('code', { class: 'gv-tree__type', text: node.type }) : null,
    ]);
    row.style.setProperty('--depth', String(node.depth));
    return row;
  });
  let shown = 1;
  const status = el('p', { class: 'gv-note', attrs: { role: 'status' } });
  const add = button('Add the next node', {
    variant: 'secondary',
    onClick: () => {
      const node = drawing.nodes[shown]!;
      const parent = [...drawing.nodes.slice(0, shown)].reverse().find((n) => n.depth === node.depth - 1);
      rows[shown]!.hidden = false;
      shown++;
      status.textContent = `Added ${node.name}${parent ? ` under ${parent.name}` : ''}.`;
      if (shown === rows.length) {
        add.disabled = true;
        add.textContent = 'All nodes added';
        status.textContent += ` All ${rows.length} nodes are in the tree.`;
      }
    },
  });
  rows.forEach((row, i) => (row.hidden = i >= shown));
  return el('figure', { class: 'gv-figure gv-drawing' }, [
    el('ul', { class: 'gv-tree', attrs: { 'aria-label': drawing.caption } }, rows),
    el('figcaption', { class: 'gv-note', text: drawing.caption }),
    el('div', { class: 'gv-row' }, [add]),
    status,
  ]);
}
