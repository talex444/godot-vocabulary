import { allShown, coveredTable, reveal, shownCount, type RevealState } from '../../courses/reveal';
import type { RevealTable } from '../../courses/types';
import { el, icon, inlineRich } from '../kit';

let tables = 0;

/**
 * Decision 41's course-end table, laid out for a phone: one block per row (the class, with its editor
 * icon), each column a covered cell. A cell is a disclosure button: tap it and its answer opens under
 * it for good. The guess is in the learner's head; nothing is typed or stored.
 */
export function revealTable(table: RevealTable): HTMLElement {
  const id = `gv-reveal-${++tables}`;
  let state: RevealState = coveredTable(table);
  const total = table.rows.length * table.columns.length;
  const status = el('p', { class: 'gv-note', attrs: { role: 'status' }, text: `0 of ${total} cells shown.` });

  const rows = table.rows.map((row, r) => {
    const cells = table.columns.map((column, c) => {
      const answerId = `${id}-${r}-${c}`;
      const hint = el('span', { class: 'gv-reveal__hint', text: 'Tap to reveal' });
      const cover = el('button', { class: 'gv-button gv-button--secondary gv-reveal__cover', attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': answerId } }, [
        el('span', { class: 'gv-reveal__column', text: column }),
        el('span', { class: 'gv-visually-hidden', text: ` (${row.head})` }),
        hint,
      ]);
      const answer = el('p', { class: 'gv-reveal__answer', attrs: { id: answerId } }, inlineRich(row.cells[c] ?? ''));
      answer.hidden = true;
      cover.addEventListener('click', () => {
        const next = reveal(state, r, c);
        if (next === state) return;
        state = next;
        answer.hidden = false;
        hint.remove();
        cover.setAttribute('aria-expanded', 'true');
        cover.classList.add('gv-reveal__cover--shown');
        status.textContent = allShown(state) ? `All ${total} cells shown.` : `${shownCount(state)} of ${total} cells shown.`;
      });
      return el('li', { class: 'gv-reveal__cell', attrs: { 'data-row': String(r), 'data-column': String(c) } }, [cover, answer]);
    });
    return el('li', { class: 'gv-reveal__row' }, [
      el('h4', { class: 'gv-reveal__head' }, [icon(`icons/${row.head}.svg`), el('code', { text: row.head })]),
      el('ul', { class: 'gv-reveal__cells' }, cells),
    ]);
  });

  return el('figure', { class: 'gv-figure gv-reveal', attrs: { 'data-reveal-table': '' } }, [
    el('figcaption', { class: 'gv-lesson__text', text: table.caption }),
    el('ul', { class: 'gv-reveal__rows' }, rows),
    status,
  ]);
}
