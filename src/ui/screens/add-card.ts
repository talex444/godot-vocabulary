import { familyLabel } from '../../areas/registry';
import { draftToCard, validateDraft, type CustomDraft } from '../../cards/custom';
import { FAMILIES, type Family } from '../../cards/types';
import { loadCards } from '../../session/deck';
import { addCustomCard, deleteCustomCard, listCustomCards, type CustomCard } from '../../store/db';
import type { Nav } from '../app';
import { button, el, heading, panel, selectField, textField } from '../kit';

/** Write your own four-choice card; it joins its family as the next new card. Your cards are listed below. */
export async function addCardScreen(nav: Nav): Promise<HTMLElement> {
  const list = el('div', { class: 'gv-stack' });
  const formPanel = el('div');
  const back = button('Back', { variant: 'secondary', onClick: () => nav.start() });

  const showList = async () => {
    const cards = (await listCustomCards()).sort((a, b) => a.family.localeCompare(b.family) || a.rank - b.rank);
    const title = heading('Your cards');
    title.tabIndex = -1;
    const afterDelete = async () => {
      await showList();
      list.querySelector<HTMLElement>('h2')?.focus();
    };
    list.replaceChildren(
      title,
      cards.length === 0
        ? el('p', { class: 'gv-note', text: 'No cards of your own yet.' })
        : el('ul', { class: 'gv-custom-list' }, cards.map((card) => customRow(card, afterDelete))),
    );
  };

  const showForm = (family: Family = FAMILIES[0]!) => {
    formPanel.replaceChildren(form(family, async (card) => {
      await showList();
      showSaved(card);
    }));
  };

  const showSaved = (card: CustomCard) => {
    const again = button('Add another', { variant: 'primary', onClick: () => showForm(card.family) });
    formPanel.replaceChildren(
      panel(
        [
          heading('Card saved'),
          el('p', { attrs: { role: 'status' } }, [
            el('strong', { text: card.answer }),
            ` is now a new ${familyLabel(card.family)} card. It comes up after the cards already waiting in that family.`,
          ]),
          el('div', { class: 'gv-row' }, [again, button('Back', { variant: 'secondary', onClick: () => nav.start() })]),
        ],
        { class: 'gv-stack' },
      ),
    );
    again.focus();
  };

  showForm();
  await showList();
  return el('div', { class: 'gv-screen' }, [
    formPanel,
    panel([list], { class: 'gv-stack' }),
    el('nav', { class: 'gv-links', attrs: { 'aria-label': 'Back' } }, [back]),
  ]);
}

function form(family: Family, onSaved: (card: CustomCard) => Promise<void>): HTMLElement {
  const familyField = selectField({ label: 'Family', choices: FAMILIES.map((f) => ({ value: f, label: familyLabel(f) })), value: family });
  const prompt = textField({ label: 'Question', multiline: true });
  const answer = textField({ label: 'Right answer' });
  const wrong = [1, 2, 3].map((n) => textField({ label: `Wrong answer ${n}` }));
  const explain = textField({ label: 'Explanation (optional)', multiline: true });
  const errors = el('div', { class: 'gv-errors', attrs: { role: 'alert' } });

  const draft = (): CustomDraft => ({
    family: familyField.select.value as Family,
    prompt: prompt.input.value,
    answer: answer.input.value,
    wrong: wrong.map((w) => w.input.value) as [string, string, string],
    explain: explain.input.value,
  });

  const markInvalid = (d: CustomDraft) => {
    const key = (s: string) => s.trim().toLowerCase();
    const all = [d.answer, ...d.wrong].map(key);
    const repeated = (s: string) => key(s) !== '' && all.filter((x) => x === key(s)).length > 1;
    const leaks = key(d.answer) !== '' && key(d.prompt).includes(key(d.answer));
    const set = (input: HTMLInputElement | HTMLTextAreaElement, bad: boolean) =>
      bad ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid');
    set(prompt.input, !d.prompt.trim() || leaks);
    set(answer.input, !d.answer.trim() || repeated(d.answer));
    wrong.forEach((w, i) => set(w.input, !d.wrong[i]!.trim() || repeated(d.wrong[i]!)));
  };

  const save = button('Save', {
    variant: 'primary',
    onClick: async () => {
      const d = draft();
      const problems = validateDraft(d);
      markInvalid(d);
      errors.replaceChildren(...(problems.length ? [el('ul', {}, problems.map((p) => el('li', { text: p })))] : []));
      if (problems.length) return;
      save.disabled = true;
      await onSaved(await addCustomCard(draftToCard(d, await loadCards())));
    },
  });
  save.classList.add('gv-wide');

  return panel(
    [
      heading('Add card'),
      el('p', { class: 'gv-note', text: 'Your card is asked like the others: the question, then four answers in a shuffled order.' }),
      familyField.root,
      prompt.root,
      answer.root,
      ...wrong.map((w) => w.root),
      explain.root,
      errors,
      save,
    ],
    { class: 'gv-stack' },
  );
}

/** One of your cards, with Delete that asks once, inline. */
function customRow(card: CustomCard, refresh: () => Promise<void>): HTMLElement {
  const actions = el('div', { class: 'gv-row' });
  const showDelete = () => {
    const del = button('Delete', {
      variant: 'flat',
      ariaLabel: `Delete ${card.answer}`,
      onClick: () => {
        const yes = button('Delete', {
          variant: 'secondary',
          ariaLabel: `Yes, delete ${card.answer}`,
          onClick: async () => {
            await deleteCustomCard(card.id);
            await refresh();
          },
        });
        const keep = button('Keep', {
          variant: 'flat',
          onClick: () => {
            showDelete();
            actions.querySelector('button')?.focus();
          },
        });
        actions.replaceChildren(el('span', { class: 'gv-warning', text: 'Delete this card and its progress?' }), yes, keep);
        keep.focus();
      },
    });
    actions.replaceChildren(del);
  };
  showDelete();
  return el('li', { class: 'gv-custom' }, [
    el('p', { class: 'gv-custom__answer', text: card.answer }),
    el('p', { class: 'gv-note', text: `${familyLabel(card.family)} · ${card.prompt}` }),
    actions,
  ]);
}
