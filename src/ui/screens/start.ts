import { AREAS, familiesOf, familyLabel, getArea, type AreaId } from '../../areas/registry';
import { sessionSummary } from '../../session/build';
import { Session, load, overdueNote, startBlockedReason, type RunDeps } from '../../session/run';
import type { Nav } from '../app';
import { asset, button, el, heading, panel, stat } from '../kit';

/**
 * The per-family figures, in the home's words (decision 66): reviews whose day has come are "ready",
 * reviews due since before today are "From before today" (a part of the ready ones, said in the
 * note's own words, GV-8g); nothing here says "due", "overdue" or "owed".
 */
export const STAT_LABELS = { ready: 'Ready', fresh: 'New today', before: 'From before today' } as const;

/**
 * An area's page (decision 50), titled with its name: per enabled family the reviews ready, new cards
 * and the reviews from before today, then Start; "All areas" above, the area's unofficial line
 * and the app's own links (the same in every area) below.
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
        el('dl', { class: 'gv-stats' }, [stat(STAT_LABELS.ready, s.due), stat(STAT_LABELS.fresh, s.newAvailable), stat(STAT_LABELS.before, s.overdue)]),
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

  // Back to the home page, in the same place on every area page and apart from the "More" group.
  const allAreas = el('button', { class: 'gv-button gv-button--flat gv-all-areas', attrs: { type: 'button' } }, [
    el('img', { class: 'gv-icon gv-octicon', attrs: { src: asset('octicons/arrow-left-24.svg'), alt: '', 'aria-hidden': 'true', width: '24', height: '24' } }),
    'All areas',
  ]);
  allAreas.addEventListener('click', () => nav.home());

  return el('div', { class: 'gv-screen' }, [
    el('nav', { class: 'gv-areas-nav', attrs: { 'aria-label': 'Areas' } }, [allAreas]),
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
    ]),
  ]);
}
