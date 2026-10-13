import type { Card } from '../../cards/types';
import { judgeBlank } from '../../courses/blank';
import { COURSES, findLesson, pretestCards } from '../../courses/index';
import type { BlankExercise, ChoiceCheck, Example, FixExercise, LessonImage, TreeDrawing } from '../../courses/types';
import { drawChoices } from '../../session/choices';
import { loadCards } from '../../session/deck';
import { getExitTicket, getSettings, markLessonDone, saveExitTicket, saveSettings } from '../../store/db';
import type { Nav } from '../app';
import { asset, button, choiceRow, codeBlock, el, gapField, heading, icon, inlineRich, panel, setChoiceState, textField } from '../kit';

/**
 * One lesson as one scrolling page (decision 37): question, pretest, the need, agenda, explanation
 * chunks each with a check, compare, exercises, "what you'll see when it's wrong", exit ticket, Mark
 * done. Nothing here touches the scheduler (decision 36); Mark done records the lesson and turns
 * course mode on.
 */
export async function lessonScreen(nav: Nav, lessonId: string): Promise<HTMLElement> {
  const found = findLesson(lessonId);
  if (!found) throw new Error(`No lesson ${lessonId}.`);
  const { course, lesson } = found;
  const [cards, ticket] = await Promise.all([loadCards(), getExitTicket(lessonId)]);
  const cardsById = new Map(cards.map((c) => [c.id, c]));
  const courseNumber = COURSES.indexOf(course) + 1;

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

  const markDone = button('Mark done', {
    variant: 'primary',
    onClick: async () => {
      markDone.disabled = true;
      await markLessonDone(lesson.id);
      // The first finished lesson switches course mode on (decision 36).
      const settings = await getSettings();
      if (settings.newCardMode !== 'course') await saveSettings({ ...settings, newCardMode: 'course' });
      nav.courses();
    },
  });
  markDone.classList.add('gv-wide');

  const pageLink = el('a', { class: 'gv-link', attrs: { href: lesson.page.url, target: '_blank', rel: 'noopener' } }, [
    `Manual: ${lesson.page.title}`,
    el('span', { class: 'gv-visually-hidden', text: ' (opens in a new tab)' }),
  ]);

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
    ...lesson.chunks.map((chunk, i) =>
      step(`chunk-${i}`, [
        stepHeading(chunk.heading),
        ...paragraphs(chunk.text),
        chunk.code ? codeBlock(chunk.code) : null,
        chunk.drawing ? treeDrawing(chunk.drawing) : null,
        chunk.image ? figure(chunk.image) : null,
        choiceCheck(chunk.check, `check-${i}`),
      ]),
    ),
    step('compare', [
      stepHeading('Compare'),
      el('div', { class: 'gv-compare' }, [example(lesson.compare.a), example(lesson.compare.b)]),
      choiceCheck(lesson.compare.question, 'compare'),
    ]),
    step('exercises', [
      exercisesHeading,
      ...lesson.exercises.map((exercise, i) =>
        exercise.type === 'blank'
          ? blankExercise(exercise, i)
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
      markDone,
    ]),
    el('nav', { class: 'gv-links', attrs: { 'aria-label': 'Back' } }, [button('Back to courses', { variant: 'secondary', onClick: () => nav.courses() })]),
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

/** Moves focus to the next step's heading; the Next of every check. */
function nextStep(from: HTMLElement): void {
  const steps = [...document.querySelectorAll<HTMLElement>('[data-step]')];
  const current = from.closest<HTMLElement>('[data-step]');
  const target = steps[steps.indexOf(current!) + 1]?.querySelector<HTMLElement>('h3');
  if (!target) return;
  target.scrollIntoView({ block: 'start' });
  target.focus({ preventScroll: true });
}

function nextButton(): HTMLButtonElement {
  const next = button('Next', { variant: 'flat' });
  next.classList.add('gv-next');
  next.addEventListener('click', () => nextStep(next));
  return next;
}

/** The right/wrong line and the one-sentence why. */
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
  const after = el('div', { class: 'gv-after' });
  const rows = check.choices.map((text, index) => {
    const row = choiceRow(text, { rich: true, onChoose: () => choose(index) });
    return row;
  });
  function choose(index: number) {
    rows.forEach((row, i) => setChoiceState(row, i === index ? (i === check.answer ? 'chosen-right' : 'chosen-wrong') : i === check.answer ? 'revealed-right' : 'disabled'));
    feedback.replaceChildren(...verdict(index === check.answer, 'Not quite. The right answer is marked.', check.why));
    after.replaceChildren(nextButton());
  }
  return el('div', { class: 'gv-question', attrs: { 'data-question': name, ...(kind ? { 'data-kind': kind } : {}) } }, [
    el('p', { class: 'gv-label', text: kind === 'predict' ? 'Predict' : 'Check' }),
    el('p', { class: 'gv-card__prompt' }, inlineRich(check.prompt)),
    check.code ? codeBlock(check.code) : null,
    el('div', { class: 'gv-choices', attrs: { role: 'group', 'aria-label': 'Choices' } }, rows),
    feedback,
    after,
  ]);
}

/** Type the missing word: exact match, a case hint, the answer after two misses (decision 35). */
function blankExercise(exercise: BlankExercise, index: number): HTMLElement {
  const input = gapField('Missing word', exercise.answer.length);
  const feedback = el('div', { class: 'gv-feedback', attrs: { role: 'status' } });
  const after = el('div', { class: 'gv-after' });
  let misses = 0;
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
    after,
  ]);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') judge();
  });
  function finish(result: 'right' | 'wrong') {
    root.dataset.result = result;
    input.readOnly = true;
    check.disabled = true;
    after.replaceChildren(nextButton());
  }
  function judge() {
    if (root.dataset.result) return;
    const result = judgeBlank(input.value, exercise.answer, misses);
    misses = result.misses;
    input.setAttribute('aria-invalid', String(result.verdict !== 'right' && result.verdict !== 'empty'));
    const why = el('p', {}, inlineRich(exercise.why));
    switch (result.verdict) {
      case 'empty':
        feedback.replaceChildren(el('p', { text: 'Type a word first.' }));
        input.focus();
        return;
      case 'case':
        feedback.replaceChildren(el('p', { class: 'gv-feedback__wrong', text: 'Check the case. GDScript names are case-sensitive.' }));
        input.focus();
        return;
      case 'wrong':
        feedback.replaceChildren(el('p', { class: 'gv-feedback__wrong', text: 'Not that word. One more try.' }));
        input.focus();
        return;
      case 'shown':
        input.value = exercise.answer;
        feedback.replaceChildren(el('p', { class: 'gv-feedback__wrong' }, ['The answer is ', el('code', { class: 'gv-inline-code', text: exercise.answer }), '.']), why);
        finish('wrong');
        return;
      case 'right':
        feedback.replaceChildren(el('p', { class: 'gv-feedback__right', text: misses === 0 ? 'Right.' : 'Second try, and you had it.' }), why);
        finish('right');
    }
  }
  return root;
}

/** Which of four lines is the bug; the corrected line follows the answer. */
function fixExercise(exercise: FixExercise, index: number): HTMLElement {
  const feedback = el('div', { class: 'gv-feedback', attrs: { role: 'status' } });
  const after = el('div', { class: 'gv-after' });
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
    after.replaceChildren(nextButton());
  }
  return el('div', { class: 'gv-question', attrs: { 'data-question': `exercise-${index}`, 'data-kind': 'fix' } }, [
    el('p', { class: 'gv-label', text: 'Find the wrong line' }),
    el('p', { class: 'gv-card__prompt' }, inlineRich(exercise.prompt)),
    el('div', { class: 'gv-choices', attrs: { role: 'group', 'aria-label': 'Lines' } }, rows),
    feedback,
    after,
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
