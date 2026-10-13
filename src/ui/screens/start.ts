import { FAMILIES } from '../../cards/types';
import { sessionSummary } from '../../session/build';
import { Session, load, overdueNote, startBlockedReason, type RunDeps } from '../../session/run';
import { FAMILY_LABEL, type Nav } from '../app';
import { button, el, heading, panel, stat } from '../kit';

/** Today at a glance: per enabled family the reviews due, new cards and overdue reviews, then Start. */
export async function startScreen(nav: Nav, deps: RunDeps): Promise<HTMLElement> {
  const loaded = await load(deps);
  const summary = sessionSummary({ ...loaded, now: deps.now() });
  const blocked = startBlockedReason(summary, loaded);
  const note = overdueNote(summary);

  const rows = FAMILIES.filter((f) => summary[f].enabled).map((family) => {
    const s = summary[family];
    return el('div', { class: 'gv-family' }, [
      el('h3', { class: 'gv-family__name', text: FAMILY_LABEL[family] }),
      el('dl', { class: 'gv-stats' }, [stat('Due', s.due), stat('New today', s.newAvailable), stat('Overdue', s.overdue)]),
    ]);
  });

  const reasonId = 'start-reason';
  const start = button('Start', {
    variant: 'primary',
    disabled: blocked !== undefined,
    describedBy: blocked || note ? reasonId : undefined,
    onClick: async () => {
      start.disabled = true;
      nav.begin(await Session.start(deps, loaded));
    },
  });
  start.classList.add('gv-wide');

  return el('div', { class: 'gv-screen' }, [
    panel(
      [
        heading('Today'),
        ...rows,
        blocked || note ? el('p', { class: 'gv-note', text: blocked ?? note, attrs: { id: reasonId } }) : null,
        start,
      ],
      { class: 'gv-stack' },
    ),
    el('nav', { class: 'gv-links', attrs: { 'aria-label': 'More' } }, [
      button('Settings', { variant: 'flat', onClick: () => nav.settings() }),
      button('Add card', { variant: 'flat', onClick: () => nav.addCard() }),
      button('About', { variant: 'flat', onClick: () => nav.about() }),
    ]),
  ]);
}
