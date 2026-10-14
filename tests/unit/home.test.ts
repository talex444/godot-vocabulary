import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AREAS, getArea } from '../../src/areas/registry';
import type { Card, Family } from '../../src/cards/types';
import { newProgress, type Progress } from '../../src/scheduler/fsrs';
import { sessionSummary } from '../../src/session/build';
import { DEFAULT_SETTINGS } from '../../src/settings/load';
import { dueText, lessonsText, tileFigures, tileName, tileView, todayText, type TileView } from '../../src/ui/screens/home';

// Done-criteria 67: the home tile counts what the area page counts, without loading a deck.

const now = new Date(2026, 9, 14, 9, 0);
const yesterday = new Date(2026, 9, 13, 9, 0);

const card = (family: Family, n: number): Card => ({
  id: `${family}:${n}`,
  family,
  kind: 'term',
  prompt: `p${n}`,
  answer: `a${n}`,
  distractors: ['x', 'y', 'z'],
  explain: 'e',
  source: { doc: 'test', ref: 'test', version: '1' },
  rank: n,
});

const due = (c: Card): Progress => ({ ...newProgress(c.id, c.family, yesterday), due: yesterday });

describe('home tiles', () => {
  it('a tile’s due count equals the area page’s due total, with a family switched off and a due card skipped', () => {
    const godot = getArea('godot')!;
    const cards = (['godot-api', 'gdscript'] as Family[]).flatMap((f) => [0, 1, 2, 3].map((n) => card(f, n)));
    const progress = new Map(cards.map((c) => [c.id, due(c)]));
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.families.gdscript.enabled = false;
    const skipped = new Set(['godot-api:2']);

    const summary = sessionSummary({ area: 'godot', cards, progress, settings, skipped, now });
    const pageTotal = Object.values(summary).reduce((n, s) => n + (s.enabled ? s.due : 0), 0);
    const figures = tileFigures(godot, { progress, settings, skipped, lessonsDone: [], now });

    expect(pageTotal).toBe(3);
    expect(figures.due).toBe(pageTotal);
  });

  it('says how many lessons there are until the first is done, then how far; and when an area has no course', () => {
    const empty = { progress: new Map(), settings: DEFAULT_SETTINGS, skipped: new Set<string>(), now };
    const area = getArea('godot')!;
    expect(lessonsText(tileFigures(area, { ...empty, lessonsDone: [] }))).toBe('6 lessons');
    expect(lessonsText(tileFigures(area, { ...empty, lessonsDone: ['c1-l0'] }))).toBe('1 of 6 lessons');
    expect(lessonsText(tileFigures(area, { ...empty, lessonsDone: ['c1-l0', 'c1-l2', 'c1-l1', 'other'] }))).toBe('3 of 6 lessons');
    expect(lessonsText(tileFigures(getArea('github')!, { ...empty, lessonsDone: ['c1-l0'] }))).toBe('No courses yet');
  });

  it('the figure: "12 ready" above zero, nothing at zero', () => {
    expect([dueText(12), dueText(1), dueText(0)]).toEqual(['12 ready', '1 ready', undefined]);
  });

  it('a tile’s accessible name is exactly the words it shows, in reading order (GV-8d, GV-8f)', () => {
    const [godot, github] = [getArea('godot')!, getArea('github')!];
    expect(tileName(godot, { due: 0, lessonsDone: 0, lessonsTotal: 6, nextLesson: 0 }, false)).toBe('Godot, Next: Lesson 0, 6 lessons');
    expect(tileName(godot, { due: 2, lessonsDone: 0, lessonsTotal: 6, nextLesson: 0 }, true)).toBe('Godot, 2 ready, 6 lessons, Last used');
    expect(tileName(godot, { due: 0, lessonsDone: 6, lessonsTotal: 6, nextLesson: null }, false)).toBe('Godot, All lessons done, 6 of 6 lessons');
    expect(tileName(github, { due: 0, lessonsDone: 0, lessonsTotal: 0, nextLesson: null }, true)).toBe('Git & GitHub, No courses yet, Last used');
    expect(tileName(github, { due: 1, lessonsDone: 0, lessonsTotal: 0, nextLesson: null }, false)).toBe('Git & GitHub, 1 ready, No courses yet');
    for (const [area, figures, last] of [
      [godot, { due: 0, lessonsDone: 0, lessonsTotal: 6, nextLesson: 0 }, false],
      [godot, { due: 0, lessonsDone: 1, lessonsTotal: 6, nextLesson: 1 }, true],
      [github, { due: 3, lessonsDone: 0, lessonsTotal: 0, nextLesson: null }, true],
    ] as const) {
      const view = tileView(area, figures, last);
      expect(view.name).toBe(texts(view).join(', '));
    }
  });

  it('names the next lesson by the number the course list shows: the first in course order not done', () => {
    const empty = { progress: new Map(), settings: DEFAULT_SETTINGS, skipped: new Set<string>(), now };
    const godot = getArea('godot')!;
    expect(tileFigures(godot, { ...empty, lessonsDone: [] }).nextLesson).toBe(0);
    expect(tileFigures(godot, { ...empty, lessonsDone: ['c1-l0', 'c1-l1', 'c1-l3'] }).nextLesson).toBe(2);
    expect(tileFigures(godot, { ...empty, lessonsDone: godot.lessons.map((l) => l.id) }).nextLesson).toBeNull();
    expect(tileFigures(getArea('github')!, { ...empty, lessonsDone: [] }).nextLesson).toBeNull();
  });
});

/** Every element of a tile with its words, and which carry the action colour. */
const coloured = (view: TileView) => [view.figure, ...view.lines].filter((t) => t?.action).map((t) => t!.text);
const texts = (view: TileView) => [view.label, view.figure?.text, ...view.lines.map((l) => l.text), view.tag].filter(Boolean);

describe('the home’s words and its one colour (decisions 63, 64, 66)', () => {
  const [godot, github] = [getArea('godot')!, getArea('github')!];
  const fig = (due: number, nextLesson: number | null, lessonsTotal: number, lessonsDone = 0) => ({ due, nextLesson, lessonsTotal, lessonsDone });

  it('fresh install: no figure, the Godot tile names its next lesson in plain grey; the line says where to start', () => {
    const tiles = [
      { area: godot, figures: fig(0, 0, 6) },
      { area: github, figures: fig(0, null, 0) },
    ];
    const [g, h] = tiles.map((t) => tileView(t.area, t.figures, false));
    expect(texts(g!)).toEqual(['Godot', 'Next: Lesson 0', '6 lessons']);
    expect(coloured(g!)).toEqual([]);
    expect(g!.lines.filter((l) => l.next).map((l) => l.text)).toEqual(['Next: Lesson 0']);
    expect(texts(h!)).toEqual(['Git & GitHub', 'No courses yet']);
    expect(coloured(h!)).toEqual([]);
    expect([g!.figure, h!.figure]).toEqual([undefined, undefined]);
    expect(todayText(tiles)).toBe('Start with Godot, Lesson 0.');
  });

  it('one area ready: only its figure carries the colour; the other tile names its next lesson; no line repeats a tile', () => {
    const tiles = [
      { area: godot, figures: fig(0, 2, 6, 2) },
      { area: github, figures: fig(3, null, 0) },
    ];
    const [g, h] = tiles.map((t) => tileView(t.area, t.figures, t.area.id === 'github'));
    expect(texts(g!)).toEqual(['Godot', 'Next: Lesson 2', '2 of 6 lessons']);
    expect(coloured(g!)).toEqual([]);
    expect(texts(h!)).toEqual(['Git & GitHub', '3 ready', 'No courses yet', 'Last used']);
    expect(h!.tag).toBe('Last used');
    expect(coloured(h!)).toEqual(['3 ready']);
    expect(todayText(tiles)).toBeUndefined();
  });

  it('both ready: one coloured figure per tile, no Next line, no line under the heading', () => {
    const tiles = [
      { area: godot, figures: fig(12, 0, 6) },
      { area: github, figures: fig(3, null, 0) },
    ];
    const [g, h] = tiles.map((t) => tileView(t.area, t.figures, false));
    expect(texts(g!)).toEqual(['Godot', '12 ready', '6 lessons']);
    expect(coloured(g!)).toEqual(['12 ready']);
    expect(coloured(h!)).toEqual(['3 ready']);
    expect(todayText(tiles)).toBeUndefined();
  });

  it('nothing ready, last used: "Last used" is a quiet line of its own under the lessons line', () => {
    const view = tileView(godot, fig(0, 1, 6, 1), true);
    expect(view.tag).toBeUndefined();
    expect(view.lines.map((l) => l.text)).toEqual(['Next: Lesson 1', '1 of 6 lessons', 'Last used']);
  });

  it('no courses anywhere and nothing ready: no colour, no figure, a plain line', () => {
    const tiles = [
      { area: { ...godot, lessons: [] }, figures: fig(0, null, 0) },
      { area: github, figures: fig(0, null, 0) },
    ];
    for (const t of tiles) expect(coloured(tileView(t.area, t.figures, false))).toEqual([]);
    for (const t of tiles) expect(tileView(t.area, t.figures, false).figure).toBeUndefined();
    expect(todayText(tiles)).toBe('Nothing waiting today.');
  });

  it('every lesson done and nothing ready: "All lessons done", in grey; "Nothing waiting today."', () => {
    const view = tileView(godot, fig(0, null, 6, 6), false);
    expect(texts(view)).toEqual(['Godot', 'All lessons done', '6 of 6 lessons']);
    expect(coloured(view)).toEqual([]);
    expect(todayText([{ area: godot, figures: fig(0, null, 6, 6) }, { area: github, figures: fig(0, null, 0) }])).toBe('Nothing waiting today.');
  });

  it('no greeting, no streak, no counter', () => {
    const source = readFileSync(new URL('../../src/ui/screens/home.ts', import.meta.url), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/streak|welcome|good (morning|afternoon|evening)|hello|in a row/i);
  });

  it('the Godot tile draws Godot’s PackedScene class icon, masked in the secondary grey like the branch icon', () => {
    expect(AREAS.map((a) => a.icon)).toEqual(['icons/PackedScene.svg', 'octicons/git-branch-24.svg']);
    // Both are masks: the file's shape, the colour from the theme's secondary grey (screens.css).
    const css = readFileSync(new URL('../../src/ui/screens/screens.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.gv-tile__icon,\s*\.gv-tile__chevron \{[^}]*background-color: var\(--font-secondary-color\);[^}]*mask: var\(--glyph/);
    expect(existsSync(new URL('../../public/app-glyph-grey.svg', import.meta.url))).toBe(false);
  });

  it('the temporary area links of GV-8a are gone from the area page', () => {
    const source = readFileSync(new URL('../../src/ui/screens/start.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/TODO\(GV-8b\)/);
    expect(source).not.toMatch(/AREAS\.filter/);
  });
});
