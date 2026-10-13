import type { Card } from '../../cards/types';
import { seededRng } from '../../session/build';
import type { Session } from '../../session/run';
import { FAMILY_LABEL, type Nav } from '../app';
import { button, choiceRow, codeBlock, el, heading, panel, richText, setChoiceState } from '../kit';

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

/** FNV-1a, so the same card shows its choices in the same order every time within a session. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export function shuffledChoices(card: Card): string[] {
  const rng = seededRng(hash(card.id));
  const out = [card.answer, ...card.distractors];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** One card: prompt, optional code, four choices; one tap locks them and shows the answer. */
export function cardScreen(session: Session, nav: Nav): HTMLElement {
  const card = session.current;
  if (!card) {
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

  const withIcons = card.family === 'godot-api' && card.kind === 'class';
  const feedback = el('div', { class: 'gv-feedback', attrs: { role: 'status' } });
  const after = el('div', { class: 'gv-after' });
  const rows = shuffledChoices(card).map((choice) => {
    const row = choiceRow(choice, { icon: withIcons ? `icons/${choice}.svg` : undefined, onChoose: () => void choose(choice) });
    return { choice, row };
  });

  async function choose(choice: string) {
    if (rows.some(({ row }) => row.disabled)) return;
    const correct = choice === card!.answer;
    for (const { choice: c, row } of rows) {
      if (c === choice) setChoiceState(row, correct ? 'chosen-right' : 'chosen-wrong');
      else if (c === card!.answer) setChoiceState(row, 'revealed-right');
      else setChoiceState(row, 'disabled');
    }
    feedback.replaceChildren(
      el('p', { class: correct ? 'gv-feedback__right' : 'gv-feedback__wrong', text: correct ? 'Right.' : `Not quite. It is ${card!.answer}.` }),
      richText(card!.explain, 'p', { class: 'gv-explain' }),
    );
    // Saved before Next appears: the phone may be closed at any moment.
    await session.answer(choice);
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

  return el('div', { class: 'gv-screen' }, [
    progress,
    panel(
      [
        el('p', { class: 'gv-card__family', text: FAMILY_LABEL[card.family] }),
        heading(kindLabel(String(card.kind))),
        richText(card.prompt, 'p', { class: 'gv-card__prompt' }),
        card.code ? codeBlock(card.code) : null,
        el('div', { class: 'gv-choices', attrs: { role: 'group', 'aria-label': 'Choices' } }, rows.map(({ row }) => row)),
        feedback,
        after,
      ],
      { class: 'gv-stack gv-card' },
    ),
    el('div', { class: 'gv-links' }, [button('End session', { variant: 'flat', onClick: () => void finish() })]),
  ]);
}
