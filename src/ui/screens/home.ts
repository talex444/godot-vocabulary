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
  /** That lesson's id, which the tile opens when nothing is ready (decision 66). */
  nextLessonId?: string;
}

export function tileFigures(area: Area, input: TileInput): TileFigures {
  const enabled = area.families.filter((f) => input.settings.families[f]?.enabled);
  const done = new Set(input.lessonsDone);
  const next = area.lessons.find((l) => !done.has(l.id));
  return {
    due: dueCount(input.progress, input.skipped, enabled, input.now),
    lessonsDone: area.lessons.filter((l) => done.has(l.id)).length,
    lessonsTotal: area.lessons.length,
    nextLesson: next?.order ?? null,
    nextLessonId: next?.id,
  };
}

/** The lessons line: what there is until the first is done ("6 lessons"), then how far ("1 of 6 lessons"). */
export const lessonsText = ({ lessonsDone, lessonsTotal }: TileFigures) =>
  lessonsTotal === 0 ? 'No courses yet' : lessonsDone === 0 ? `${lessonsTotal} lessons` : `${lessonsDone} of ${lessonsTotal} lessons`;

/**
 * The tile's figure: "12 ready" above zero, offered rather than owed, the area page's word too
 * (decision 66; tests/unit/home.test.ts holds the two together); at zero there is no figure at all.
 */
export const dueText = (due: number): string | undefined => (due > 0 ? `${due} ready` : undefined);

export const UNOFFICIAL_HOME = 'Unofficial; not affiliated with or endorsed by the Godot Foundation or GitHub.';

/** One piece of a tile's text; `action` draws it in the home's one colour (decision 64). */
export interface TileText {
  text: string;
  action: boolean;
  /** The "Next: Lesson N" line: secondary grey, a step above the lessons line, never coloured. */
  next?: boolean;
}

/** What a tile shows, in DOM order. */
export interface TileView {
  label: string;
  /** The right-hand figure, "N ready", in the action colour; none when nothing is ready. */
  figure: TileText | undefined;
  /**
   * Under the label: the next step (when nothing is ready and the area has courses), the lessons
   * line, and "Last used" as a quiet line of its own when there is no figure to sit under.
   */
  lines: TileText[];
  /** "Last used" in the right-hand column, under the figure (only when there is one). */
  tag: string | undefined;
  name: string;
  /**
   * The lesson a tap opens: the one its Next line names, when nothing is ready (decision 66: the
   * tile keeps the line's promise). Otherwise the tap opens the area page.
   */
  opens: string | undefined;
}

/**
 * The words carry the meaning; the colour only repeats it (WCAG 1.4.1), on one element at most: the
 * figure when reviews are ready (a fact about the cards). Each figure is said once, and a zero is
 * not said at all (decision 66). The "Next: Lesson N" line is plain secondary text, so a fresh
 * install shows no colour at all (decision 64, amended).
 */
export function tileView(area: Area, figures: TileFigures, lastUsed: boolean): TileView {
  const lines: TileText[] = [];
  const text = dueText(figures.due);
  if (text === undefined && figures.lessonsTotal > 0) {
    lines.push(figures.nextLesson === null ? { text: 'All lessons done', action: false } : { text: `Next: Lesson ${figures.nextLesson}`, action: false, next: true });
  }
  lines.push({ text: lessonsText(figures), action: false });
  const figure = text === undefined ? undefined : { text, action: true };
  if (lastUsed && figure === undefined) lines.push({ text: 'Last used', action: false });
  const tag = lastUsed && figure !== undefined ? 'Last used' : undefined;
  // The accessible name is the words on the tile, in reading order (WCAG 2.5.3, label in name).
  const name = [area.label, figure?.text, ...lines.map((l) => l.text), tag].filter((s) => s !== undefined).join(', ');
  const opens = figure === undefined ? figures.nextLessonId : undefined;
  return { label: area.label, figure, lines, tag, name, opens };
}

/**
 * The one plain line under the heading, or none: it names only the next step and is dropped when it
 * would repeat a tile (decision 66). No greeting, no streak, no counter (decision 63).
 */
export function todayText(tiles: readonly { area: Area; figures: TileFigures }[]): string | undefined {
  if (tiles.some((t) => t.figures.due > 0)) return undefined;
  const next = tiles.find((t) => t.figures.nextLesson !== null);
  return next ? `Start with ${next.area.label}, Lesson ${next.figures.nextLesson}.` : 'Nothing waiting today.';
}

/**
 * The home page (decisions 49, 63, 64, 66), in its own theme: a line naming where to start when no
 * tile already says it, then one tile per area with the tool's icon, its label, its ready figure,
 * the next lesson and its lessons; the area entered last carries a "Last used" tag.
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
  const today = todayText(figures);

  return el('div', { class: 'gv-screen gv-home' }, [
    heading('Areas'),
    today !== undefined && el('p', { class: 'gv-note gv-today', text: today }),
    el('ul', { class: 'gv-tiles' }, tiles),
    status,
    el('p', { class: 'gv-note gv-unofficial', text: UNOFFICIAL_HOME }),
    el('nav', { class: 'gv-links', attrs: { 'aria-label': 'More' } }, [button('About', { variant: 'flat', onClick: () => nav.about() })]),
  ]);
}

/**
 * A tile's accessible name: exactly the words it shows, in reading order: the label, the figure
 * ("12 ready") when shown, the Next line when shown, the lessons line, "Last used" when shown.
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
const NEXT = ' gv-tile__line--next';

function tile(area: Area, view: TileView, nav: Nav, status: HTMLElement): HTMLButtonElement {
  // The DOM keeps 1.3.0's order (label, then the lines); the grid in screens.css places the ready
  // figure and "Last used" under it in the right-hand column.
  const node = el('button', { class: 'gv-tile', attrs: { type: 'button', 'data-area': area.id, 'aria-label': view.name } }, [
    el('span', { class: 'gv-tile__text' }, [
      el('span', { class: 'gv-tile__label', text: view.label }),
      view.figure !== undefined && el('span', { class: `gv-tile__figure${view.figure.action ? ACTION : ''}`, text: view.figure.text }),
      ...view.lines.map((line) => el('span', { class: `gv-tile__line${line.next ? NEXT : ''}${line.action ? ACTION : ''}`, text: line.text })),
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
    void nav.area(area.id, origin, view.opens);
  });
  return node;
}
