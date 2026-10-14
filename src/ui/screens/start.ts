import { AREAS, familiesOf, familyLabel, getArea, type AreaId } from '../../areas/registry';
import { sessionSummary } from '../../session/build';
import { Session, load, overdueNote, startBlockedReason, type RunDeps } from '../../session/run';
import type { Nav } from '../app';
import { button, el, heading, panel, stat } from '../kit';

/**
 * One area today, titled with its name: per enabled family the reviews due, new cards and overdue
 * reviews, then Start; the area's unofficial line under the panel.
 */
export async function startScreen(nav: Nav, deps: RunDeps, area: AreaId): Promise<HTMLElement> {
  const { label, unofficialLine } = getArea(area) ?? AREAS[0]!;
  const loaded = await load(deps, area);
  const summary = sessionSummary({ ...loaded, now: deps.now() });
  const blocked = startBlockedReason(summary, loaded);
  const note = overdueNote(summary, area);

  const rows = familiesOf(area).flatMap((family) => {
    const s = summary[family];
    if (!s?.enabled) return [];
    return [
      el('div', { class: 'gv-family' }, [
        el('h3', { class: 'gv-family__name', text: familyLabel(family) }),
        el('dl', { class: 'gv-stats' }, [stat('Due', s.due), stat('New today', s.newAvailable), stat('Overdue', s.overdue)]),
      ]),
    ];
  });

  const reasonId = 'start-reason';
  const start = button('Start', {
    variant: 'primary',
    disabled: blocked !== undefined,
    describedBy: blocked || note ? reasonId : undefined,
    onClick: async () => {
      start.disabled = true;
      nav.begin(await Session.start(deps, area, loaded));
    },
  });
  start.classList.add('gv-wide');

  return el('div', { class: 'gv-screen' }, [
    panel(
      [
        heading(label),
        ...rows,
        blocked || note ? el('p', { class: 'gv-note', text: blocked ?? note, attrs: { id: reasonId } }) : null,
        start,
      ],
      { class: 'gv-stack' },
    ),
    el('p', { class: 'gv-note gv-unofficial', text: unofficialLine }),
    el('nav', { class: 'gv-links', attrs: { 'aria-label': 'More' } }, [
      button('Courses', { variant: 'flat', onClick: () => nav.courses() }),
      button('Settings', { variant: 'flat', onClick: () => nav.settings() }),
      button('Add card', { variant: 'flat', onClick: () => nav.addCard() }),
      button('About', { variant: 'flat', onClick: () => nav.about() }),
      // TODO(GV-8b): remove; the home page's tiles open the areas.
      ...AREAS.filter((a) => a.id !== area).map((a) => button(a.label, { variant: 'flat', onClick: () => nav.start(a.id) })), // TODO(GV-8b): remove
    ]),
  ]);
}
