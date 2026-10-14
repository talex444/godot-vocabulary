import { AREAS, type Area } from '../../areas/registry';
import type { Progress } from '../../scheduler/fsrs';
import { dueCount } from '../../session/build';
import type { Settings } from '../../settings/load';
import { getLastArea, getLessonsDoneIds, getProgress, getSettings, getSkippedIds } from '../../store/db';
import type { Nav } from '../app';
import { asset, button, el, heading } from '../kit';

/** What a tile counts: read from the device's progress rows only, no deck loaded (decision 55). */
export interface TileInput {
  progress: ReadonlyMap<string, Progress>;
  settings: Settings;
  skipped: ReadonlySet<string>;
  lessonsDone: readonly string[];
  now: Date;
}

export interface TileFigures {
  /** Reviews due now in the area's enabled families, skipped cards left out. */
  due: number;
  lessonsDone: number;
  lessonsTotal: number;
}

export function tileFigures(area: Area, input: TileInput): TileFigures {
  const enabled = area.families.filter((f) => input.settings.families[f]?.enabled);
  const done = new Set(input.lessonsDone);
  return {
    due: dueCount(input.progress, input.skipped, enabled, input.now),
    lessonsDone: area.lessonIds.filter((id) => done.has(id)).length,
    lessonsTotal: area.lessonIds.length,
  };
}

export const dueText = (due: number) => (due === 0 ? 'Nothing due' : `${due} due`);

export const lessonsText = ({ lessonsDone, lessonsTotal }: TileFigures) =>
  lessonsTotal === 0 ? 'No courses yet' : `${lessonsDone} of ${lessonsTotal} lessons`;

export const UNOFFICIAL_HOME = 'Unofficial; not affiliated with or endorsed by the Godot Foundation or GitHub.';

/**
 * The home page (decision 49), in its own neutral theme: one tile per area with the tool's icon, its
 * label, its due count and its lessons done; the area entered last carries a "Last used" tag.
 */
export async function homeScreen(nav: Nav, now: Date = new Date()): Promise<HTMLElement> {
  const [progress, settings, skipped, lessonsDone, last] = await Promise.all([
    getProgress(),
    getSettings(),
    getSkippedIds(),
    getLessonsDoneIds(),
    getLastArea(),
  ]);
  const input: TileInput = { progress, settings, skipped, lessonsDone, now };
  const tiles = AREAS.map((area) => el('li', {}, [tile(area, tileFigures(area, input), area.id === last, nav)]));

  return el('div', { class: 'gv-screen gv-home' }, [
    heading('Areas'),
    el('ul', { class: 'gv-tiles' }, tiles),
    el('p', { class: 'gv-note gv-unofficial', text: UNOFFICIAL_HOME }),
    el('nav', { class: 'gv-links', attrs: { 'aria-label': 'More' } }, [button('About', { variant: 'flat', onClick: () => nav.about() })]),
  ]);
}

function tile(area: Area, figures: TileFigures, lastUsed: boolean, nav: Nav): HTMLButtonElement {
  const lines = [dueText(figures.due), lessonsText(figures), lastUsed ? 'Last used' : undefined].filter((s): s is string => s !== undefined);
  const node = el(
    'button',
    { class: 'gv-tile', attrs: { type: 'button', 'data-area': area.id, 'aria-label': [area.label, ...lines].join(', ') } },
    [
      el('span', { class: 'gv-tile__text' }, [
        el('span', { class: 'gv-tile__label', text: area.label }),
        ...lines.map((line) => el('span', { class: 'gv-tile__line', text: line })),
      ]),
      // After the label in the DOM, drawn before it; decorative, since the label names the area.
      el('img', { class: `gv-tile__icon${area.icon.startsWith('octicons/') ? ' gv-octicon' : ''}`, attrs: { src: asset(area.icon), alt: '', 'aria-hidden': 'true', width: '32', height: '32' } }),
    ],
  );
  node.addEventListener('click', () => nav.area(area.id));
  return node;
}
