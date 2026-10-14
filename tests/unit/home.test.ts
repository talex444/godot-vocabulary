import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getArea } from '../../src/areas/registry';
import type { Card, Family } from '../../src/cards/types';
import { newProgress, type Progress } from '../../src/scheduler/fsrs';
import { sessionSummary } from '../../src/session/build';
import { DEFAULT_SETTINGS } from '../../src/settings/load';
import { dueText, lessonsText, tileFigures } from '../../src/ui/screens/home';

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

  it('counts the area’s lessons done out of its total, and says when an area has no course', () => {
    const empty = { progress: new Map(), settings: DEFAULT_SETTINGS, skipped: new Set<string>(), now };
    const godot = tileFigures(getArea('godot')!, { ...empty, lessonsDone: ['c1-l0', 'c1-l2', 'c1-l1', 'other'] });
    expect(lessonsText(godot)).toBe('3 of 6 lessons');
    expect(lessonsText(tileFigures(getArea('github')!, { ...empty, lessonsDone: ['c1-l0'] }))).toBe('No courses yet');
    expect([dueText(0), dueText(4)]).toEqual(['Nothing due', '4 due']);
  });

  it('the temporary area links of GV-8a are gone from the area page', () => {
    const source = readFileSync(new URL('../../src/ui/screens/start.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/TODO\(GV-8b\)/);
    expect(source).not.toMatch(/AREAS\.filter/);
  });
});
