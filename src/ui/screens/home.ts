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

/** The due count in the tile's accessible name (1.3.0's words); the figure on screen reads "N due". */
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

/** A tile's accessible name, as in 1.3.0 (decision 63): the label, the due count, the lessons, "Last used". */
export function tileName(area: Area, figures: TileFigures, lastUsed: boolean): string {
  return [area.label, dueText(figures.due), lessonsText(figures), lastUsed ? 'Last used' : undefined].filter((s) => s !== undefined).join(', ');
}

/** A decorative glyph drawn in the secondary grey: the file is the mask, the token its colour. */
function glyph(className: string, path: string): HTMLSpanElement {
  const node = el('span', { class: className, attrs: { 'aria-hidden': 'true' } });
  node.style.setProperty('--glyph', `url("${asset(path)}")`);
  return node;
}

function tile(area: Area, figures: TileFigures, lastUsed: boolean, nav: Nav): HTMLButtonElement {
  // The DOM keeps 1.3.0's order (label, then the lines); the grid in screens.css places the due
  // figure and "Last used" in the right-hand column.
  const node = el('button', { class: 'gv-tile', attrs: { type: 'button', 'data-area': area.id, 'aria-label': tileName(area, figures, lastUsed) } }, [
    el('span', { class: 'gv-tile__text' }, [
      el('span', { class: 'gv-tile__label', text: area.label }),
      el('span', { class: 'gv-tile__figure', text: `${figures.due} due` }),
      el('span', { class: 'gv-tile__line', text: lessonsText(figures) }),
      lastUsed && el('span', { class: 'gv-tile__tag', text: 'Last used' }),
    ]),
    // After the text in the DOM, drawn beside it; decorative, since the label names the area.
    glyph('gv-tile__icon', area.icon),
    glyph('gv-tile__chevron', 'octicons/chevron-right-16.svg'),
  ]);
  // At once: the pressed look and "Loading…" while the area's deck loads and its page is built
  // (decision 51: the wipe starts only then, from the point tapped). A second tap is ignored.
  node.addEventListener('click', (event) => {
    if (node.getAttribute('aria-busy') === 'true') return;
    node.setAttribute('aria-busy', 'true');
    node.querySelector('.gv-tile__text')!.append(el('span', { class: 'gv-tile__line', text: 'Loading…' }));
    node.setAttribute('aria-label', `${node.getAttribute('aria-label')}, Loading…`);
    const box = node.getBoundingClientRect();
    // A keyboard press has no pointer position: the tile's centre stands in.
    const origin = event.detail > 0 ? { x: event.clientX, y: event.clientY } : { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    void nav.area(area.id, origin);
  });
  return node;
}
