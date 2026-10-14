import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AREAS, areaOf, familiesOf, familyLabel, getArea } from '../../src/areas/registry';
import { FAMILIES } from '../../src/cards/types';
import { sessionLessons } from '../../src/courses/index';
import deckCounts from '../../src/data/deck-counts.json';
import { DEFAULT_SETTINGS } from '../../src/settings/load';

// Done-criteria 62: the area registry is the one place a tool is added.

const SRC = join(import.meta.dirname, '..', '..', 'src');

function* files(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

describe('area registry', () => {
  it('has Godot first, then Git & GitHub, with their families', () => {
    expect(AREAS.map((a) => [a.id, a.label, a.families])).toEqual([
      ['godot', 'Godot', ['godot-api', 'gdscript']],
      ['github', 'Git & GitHub', ['github']],
    ]);
    expect(FAMILIES).toEqual(['godot-api', 'gdscript', 'github']);
  });

  it('maps families to areas and labels', () => {
    expect(areaOf('gdscript').id).toBe('godot');
    expect(areaOf('github').id).toBe('github');
    expect(familiesOf('godot')).toEqual(['godot-api', 'gdscript']);
    expect(FAMILIES.map(familyLabel)).toEqual(['Godot API', 'GDScript', 'GitHub']);
    expect(getArea('godot')?.label).toBe('Godot');
    expect(getArea('aseprite')).toBeUndefined();
    expect(getArea(undefined)).toBeUndefined();
  });

  it('carries the unofficial lines', () => {
    expect(getArea('godot')!.unofficialLine).toBe('Unofficial; not affiliated with or endorsed by the Godot Foundation.');
    expect(getArea('github')!.unofficialLine).toBe('Unofficial; not affiliated with or endorsed by GitHub.');
  });

  it('keeps the default budgets (10 / 5 / 5)', () => {
    expect(DEFAULT_SETTINGS.families).toEqual({
      'godot-api': { enabled: true, newPerDay: 10 },
      gdscript: { enabled: true, newPerDay: 5 },
      github: { enabled: true, newPerDay: 5 },
    });
  });

  it('loads each area’s own deck once, and the counts About shows match it', async () => {
    for (const area of AREAS) {
      const first = await area.load();
      expect(await area.load()).toBe(first);
      expect(new Set(first.cards.map((c) => c.family))).toEqual(new Set(area.families));
      for (const family of area.families) {
        expect(first.cards.filter((c) => c.family === family).length, family).toBe((deckCounts as Record<string, number>)[family]);
      }
    }
    expect((await getArea('godot')!.load()).courses.map((c) => c.id)).toEqual(['course-1']);
    expect((await getArea('github')!.load()).courses).toEqual([]);
  });

  it('lists each area’s written lessons as its courses hold them, and ships its icon', async () => {
    for (const area of AREAS) {
      const { courses } = await area.load();
      const written = sessionLessons(courses).map((l) => l.id);
      expect(area.lessonIds, area.id).toEqual(written);
      expect(existsSync(join(SRC, '..', 'public', area.icon)), area.icon).toBe(true);
    }
  });

  it('no family id appears in src/ outside cards/types.ts, areas/ and the data JSON', () => {
    const allowed = (rel: string) => rel === 'cards/types.ts' || rel.startsWith('areas/') || (rel.startsWith('data/') && rel.endsWith('.json'));
    const literal = /(['"`])(godot-api|gdscript|github)\1|^\s*(gdscript|github)\s*:/m;
    const hits: string[] = [];
    for (const file of files(SRC)) {
      const rel = relative(SRC, file).split(sep).join('/');
      if (allowed(rel) || !/\.(ts|css|json)$/.test(rel)) continue;
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (literal.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
