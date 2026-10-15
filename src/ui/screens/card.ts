import { areaOf, familyLabel, familyTraits } from '../../areas/registry';
import type { Card } from '../../cards/types';
import { termName } from '../../courses/index';
import type { Choice } from '../../session/choices';
import type { Session } from '../../session/run';
import type { Nav } from '../app';
import { button, choiceRow, codeBlock, el, heading, icon, panel, richText, setChoiceState, textField } from '../kit';

const KIND_LABEL: Record<string, string> = {
  class: 'Class',
  method: 'Method',
  property: 'Property',
  signal: 'Signal',
  term: 'Term',
  keyword: 'Keyword',
  annotation: 'Annotation',
  operator: 'Operator',
  builtin: 'Built-in function',
  lifecycle: 'Lifecycle callback',
  concept: 'Concept',
  custom: 'Your card',
};

function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

const LOOK = ['', 'Second look', 'Third look', 'Fourth look', 'Fifth look', 'Sixth look'];

/** Why a card came back: "Second look" on its second showing, and so on. */
export function lookLabel(showing: number): string {
  return showing === 0 ? '' : (LOOK[showing] ?? `Look ${showing + 1}`);
}

const MEMBER_KINDS = new Set(['method', 'property', 'signal']);

/** Member prompts start "Class: "; flipped choices drop it so the class does not give the answer away. */
function choiceText(card: Card, choice: Choice): string {
  return MEMBER_KINDS.has(card.kind) ? choice.text.replace(/^[@\w]+: /, '') : choice.text;
}

/** The name a flipped card asks about: a class with its icon, a member or keyword in code font, or a term. */
function flippedPrompt(card: Card): HTMLElement {
  const traits = familyTraits(card.family);
  if (traits.classIcons && card.kind === 'class') {
    return el('p', { class: 'gv-card__prompt gv-card__name' }, [icon(`icons/${card.answer}.svg`), el('span', { text: card.answer })]);
  }
  if (traits.plainNames) return el('p', { class: 'gv-card__prompt gv-card__name', text: card.answer });
  return el('p', { class: 'gv-card__prompt gv-card__name' }, [el('code', { class: 'gv-inline-code', text: termName(card) })]);
}

/** One card: prompt, optional code, four choices; one tap locks them and shows the answer. */
export function cardScreen(session: Session, nav: Nav): HTMLElement {
  const card = session.current;
  const draw = session.draw();
  if (!card || !draw) {
    const screen = el('div', { class: 'gv-screen' });
    session.finish().then((result) => nav.summary(result));
    return screen;
  }

  const finish = async () => nav.summary(await session.finish());
  const fill = el('div', { class: 'gv-progress__fill' });
  const progress = el('div', { class: 'gv-progress', attrs: { role: 'progressbar', 'aria-label': 'Cards done', 'aria-valuemin': '0' } }, [fill]);
  const showProgress = () => {
    progress.setAttribute('aria-valuemax', String(session.total));
    progress.setAttribute('aria-valuenow', String(session.done));
    progress.setAttribute('aria-valuetext', `${session.done} of ${session.total}`);
    fill.style.width = `${session.total === 0 ? 0 : (session.done / session.total) * 100}%`;
  };
  showProgress();

  const flipped = draw.direction === 'flipped';
  const withIcons = !flipped && familyTraits(card.family).classIcons && card.kind === 'class';
  const feedback = el('div', { class: 'gv-feedback', attrs: { role: 'status' } });
  const after = el('div', { class: 'gv-after' });
  const rows = draw.choices.map((choice) => {
    const row = choiceRow(choiceText(card, choice), {
      icon: withIcons ? `icons/${choice.text}.svg` : undefined,
      rich: flipped,
      onChoose: () => void choose(choice),
    });
    if (choice.cardId) row.dataset.cardId = choice.cardId;
    return { choice, row };
  });
  let answered = false;

  async function choose(choice: Choice) {
    if (answered) return;
    answered = true;
    for (const { choice: c, row } of rows) {
      if (c === choice) setChoiceState(row, choice.correct ? 'chosen-right' : 'chosen-wrong');
      else if (c.correct) setChoiceState(row, 'revealed-right');
      else setChoiceState(row, 'disabled');
    }
    const verdict = choice.correct ? 'Right.' : flipped ? 'Not quite. The right description is marked.' : `Not quite. It is ${card!.answer}.`;
    const full = richText(card!.explainFull ?? card!.explain, 'p', { class: 'gv-explain gv-explain--full' });
    full.setAttribute('role', 'region');
    full.setAttribute('aria-label', 'Full description');
    full.tabIndex = 0;
    feedback.replaceChildren(
      el('p', { class: choice.correct ? 'gv-feedback__right' : 'gv-feedback__wrong', text: verdict }),
      full,
      ...(card!.docsUrl ? [docsLink(card!)] : []),
    );
    // Saved before Next appears: the phone may be closed at any moment.
    await session.answer(choice.text);
    showProgress();
    const last = session.current === undefined;
    const next = button(last ? 'See summary' : 'Next', {
      variant: 'primary',
      onClick: () => (last ? void finish() : nav.card(session)),
    });
    next.classList.add('gv-wide');
    after.replaceChildren(next);
    next.focus();
  }

  const look = lookLabel(session.showing);
  const body = panel(
    [
      el('p', { class: 'gv-card__family', text: familyLabel(card.family) }),
      look ? el('p', { class: 'gv-card__look', text: look }) : null,
      heading(kindLabel(String(card.kind))),
      flipped ? flippedPrompt(card) : richText(card.prompt, 'p', { class: 'gv-card__prompt' }),
      flipped ? el('p', { class: 'gv-note', text: 'Pick the description that fits.' }) : null,
      !flipped && card.code ? codeBlock(card.code) : null,
      el('div', { class: 'gv-choices', attrs: { role: 'group', 'aria-label': 'Choices' } }, rows.map(({ row }) => row)),
      feedback,
      after,
      skipControl(session, nav, card),
    ],
    { class: `gv-stack gv-card${flipped ? ' gv-card--flipped' : ''}` },
  );
  // Which card and showing this is, for the end-to-end tests.
  Object.assign(body.dataset, { cardId: card.id, showing: String(session.showing), direction: draw.direction });
  return el('div', { class: 'gv-screen' }, [
    progress,
    body,
    el('div', { class: 'gv-links' }, [button('End session', { variant: 'flat', onClick: () => void finish() })]),
  ]);
}

/** The official page for the card, opened by the browser; the app itself requests nothing. */
function docsLink(card: Card): HTMLAnchorElement {
  const label = areaOf(card.family).docsLabel;
  return el('a', { class: 'gv-link gv-docs-link', attrs: { href: card.docsUrl!, target: '_blank', rel: 'noopener' } }, [
    label,
    el('span', { class: 'gv-visually-hidden', text: ' (opens in a new tab)' }),
  ]);
}

/** "Skip this card", then an optional one-line reason with Skip and Cancel (decision 26). */
function skipControl(session: Session, nav: Nav, card: Card): HTMLElement {
  const root = el('div', { class: 'gv-skip' });
  const open = button('Skip this card', { variant: 'flat', onClick: () => show(true) });
  const reason = textField({ label: 'Reason (optional)', placeholder: 'e.g. the description is wrong' });
  const confirm = button('Skip', {
    variant: 'secondary',
    onClick: async () => {
      confirm.disabled = true;
      // After an answer the session has moved on, so name the card this screen shows.
      await session.skip(reason.input.value, card.id);
      nav.card(session);
    },
  });
  const cancel = button('Cancel', { variant: 'flat', onClick: () => show(false) });
  const form = el('div', { class: 'gv-skip__form', attrs: { role: 'group', 'aria-label': 'Skip this card' } }, [
    reason.root,
    el('p', { class: 'gv-note', text: 'It leaves your deck. Settings lists skipped cards, with Undo.' }),
    el('div', { class: 'gv-row' }, [confirm, cancel]),
  ]);
  reason.input.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Enter') confirm.click();
    if ((event as KeyboardEvent).key === 'Escape') show(false);
  });
  function show(asking: boolean) {
    open.hidden = asking;
    form.hidden = !asking;
    (asking ? reason.input : open).focus();
  }
  form.hidden = true;
  root.append(open, form);
  return root;
}
