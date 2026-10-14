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
  /** The number of the first lesson in course order not yet done; `null` when every one is (or there are none). */
  nextLesson: number | null;
}

export function tileFigures(area: Area, input: TileInput): TileFigures {
  const enabled = area.families.filter((f) => input.settings.families[f]?.enabled);
  const done = new Set(input.lessonsDone);
  return {
    due: dueCount(input.progress, input.skipped, enabled, input.now),
    lessonsDone: area.lessons.filter((l) => done.has(l.id)).length,
    lessonsTotal: area.lessons.length,
    nextLesson: area.lessons.find((l) => !done.has(l.id))?.order ?? null,
  };
}

export const lessonsText = ({ lessonsDone, lessonsTotal }: TileFigures) =>
  lessonsTotal === 0 ? 'No courses yet' : `${lessonsDone} of ${lessonsTotal} lessons`;

export const UNOFFICIAL_HOME = 'Unofficial; not affiliated with or endorsed by the Godot Foundation or GitHub.';

/** One piece of a tile's text; `action` draws it in the home's one colour (decision 64). */
export interface TileText {
  text: string;
  action: boolean;
}

/** What a tile shows, in DOM order. */
export interface TileView {
  label: string;
  /** The right-hand figure, "N due"; `quiet` (zero) draws it at the lessons line's size and grey. */
  figure: TileText & { quiet: boolean };
  /** Under the label: the next step (when nothing is due and the area has courses), then the lessons line. */
  lines: TileText[];
  tag: string | undefined;
  name: string;
}

/**
 * The words carry the meaning; the colour only repeats it (WCAG 1.4.1), on one element at most:
 * the due figure when reviews are due, else the "Next: Lesson N" line. Nothing to do, or no courses,
 * leaves the tile grey.
 */
export function tileView(area: Area, figures: TileFigures, lastUsed: boolean): TileView {
  const lines: TileText[] = [];
  if (figures.due === 0 && figures.lessonsTotal > 0) {
    lines.push(figures.nextLesson === null ? { text: 'All lessons done', action: false } : { text: `Next: Lesson ${figures.nextLesson}`, action: true });
  }
  lines.push({ text: lessonsText(figures), action: false });
  const figure = { text: `${figures.due} due`, action: figures.due > 0, quiet: figures.due === 0 };
  const tag = lastUsed ? 'Last used' : undefined;
  // The accessible name is the words on the tile, in reading order (WCAG 2.5.3, label in name).
  const name = [area.label, figure.text, ...lines.map((l) => l.text), tag].filter((s) => s !== undefined).join(', ');
  return { label: area.label, figure, lines, tag, name };
}

/**
 * The one plain line under the heading: what today holds and the next step. No greeting, no streak,
 * no counter (decision 63).
 */
export function todayText(tiles: readonly { area: Area; figures: TileFigures }[]): string {
  const due = tiles.filter((t) => t.figures.due > 0);
  if (due.length > 0) return due.map((t) => `${t.figures.due} due in ${t.area.label}.`).join(' ');
  const next = tiles.find((t) => t.figures.nextLesson !== null);
  return next ? `Nothing due today. Next: ${next.area.label}, Lesson ${next.figures.nextLesson}.` : 'Nothing due today.';
}

/**
 * The home page (decisions 49, 63, 64), in its own theme: a line saying what today holds, then one
 * tile per area with the tool's icon, its label, its due figure, the next lesson and its lessons
 * done; the area entered last carries a "Last used" tag.
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
  const figures = AREAS.map((area) => ({ area, figures: tileFigures(area, input) }));
  // "Loading…" is announced here, not added to a tile's name, so the name stays the words it shows.
  const status = el('p', { class: 'gv-visually-hidden', attrs: { role: 'status' } });
  const tiles = figures.map((t) => el('li', {}, [tile(t.area, tileView(t.area, t.figures, t.area.id === last), nav, status)]));

  return el('div', { class: 'gv-screen gv-home' }, [
    heading('Areas'),
    el('p', { class: 'gv-note gv-today', text: todayText(figures) }),
    el('ul', { class: 'gv-tiles' }, tiles),
    status,
    el('p', { class: 'gv-note gv-unofficial', text: UNOFFICIAL_HOME }),
    el('nav', { class: 'gv-links', attrs: { 'aria-label': 'More' } }, [button('About', { variant: 'flat', onClick: () => nav.about() })]),
  ]);
}

/**
 * A tile's accessible name: exactly the words it shows, in reading order: the label, the figure
 * ("0 due"), the Next line when shown, the lessons line, "Last used" when shown.
 */
export function tileName(area: Area, figures: TileFigures, lastUsed: boolean): string {
  return tileView(area, figures, lastUsed).name;
}

/** A decorative glyph drawn in the secondary grey: the file is the mask, the token its colour. */
function glyph(className: string, path: string): HTMLSpanElement {
  const node = el('span', { class: className, attrs: { 'aria-hidden': 'true' } });
  node.style.setProperty('--glyph', `url("${asset(path)}")`);
  return node;
}

const ACTION = ' gv-action';
const QUIET = ' gv-tile__figure--quiet';

function tile(area: Area, view: TileView, nav: Nav, status: HTMLElement): HTMLButtonElement {
  // The DOM keeps 1.3.0's order (label, then the lines); the grid in screens.css places the due
  // figure and "Last used" in the right-hand column.
  const node = el('button', { class: 'gv-tile', attrs: { type: 'button', 'data-area': area.id, 'aria-label': view.name } }, [
    el('span', { class: 'gv-tile__text' }, [
      el('span', { class: 'gv-tile__label', text: view.label }),
      el('span', { class: `gv-tile__figure${view.figure.action ? ACTION : ''}${view.figure.quiet ? QUIET : ''}`, text: view.figure.text }),
      ...view.lines.map((line) => el('span', { class: `gv-tile__line${line.action ? ACTION : ''}`, text: line.text })),
      view.tag !== undefined && el('span', { class: 'gv-tile__tag', text: view.tag }),
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
    status.textContent = `Loading ${area.label}…`;
    const box = node.getBoundingClientRect();
    // A keyboard press has no pointer position: the tile's centre stands in.
    const origin = event.detail > 0 ? { x: event.clientX, y: event.clientY } : { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    void nav.area(area.id, origin);
  });
  return node;
}
