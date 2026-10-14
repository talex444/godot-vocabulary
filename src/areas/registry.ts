import type { Card, Family } from '../cards/types';
import type { Course } from '../courses/types';
import { godotTokens, type ThemeTokens } from '../theme/tokens';

/**
 * Areas (decision 46): one area per tool, holding one or more card families. This file is the one
 * place a tool is added: its families and their labels, its look, its unofficial line, and the loader
 * for its deck and courses. Nothing else under `src/` names a family (`tests/unit/areas.test.ts`).
 */

export type AreaId = 'godot' | 'github';

export interface Area {
  id: AreaId;
  /** The area's name as the learner reads it. */
  label: string;
  families: readonly Family[];
  familyLabels: { readonly [F in Family]?: string };
  /** Default new cards per day for each of the area's families (decision 21). */
  newPerDay: { readonly [F in Family]?: number };
  /** Who makes the tool, as the unofficial line and About name them. */
  vendor: string;
  unofficialLine: string;
  /** Where a card's docs link goes, in the link's words. */
  docsLabel: string;
  theme: ThemeTokens;
  /** The area's generated deck and its courses, loaded on demand (decision 55) and kept once loaded. */
  load: () => Promise<{ cards: Card[]; courses: Course[] }>;
}

/** Memoises a loader so each area's files are fetched once per page. */
function once<T>(loader: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | undefined;
  return () => (loading ??= loader());
}

const godot: Area = {
  id: 'godot',
  label: 'Godot',
  families: ['godot-api', 'gdscript'],
  familyLabels: { 'godot-api': 'Godot API', gdscript: 'GDScript' },
  newPerDay: { 'godot-api': 10, gdscript: 5 },
  vendor: 'the Godot Foundation',
  unofficialLine: 'Unofficial; not affiliated with or endorsed by the Godot Foundation.',
  docsLabel: 'Open in the Godot docs',
  theme: godotTokens(),
  load: once(async () => {
    const [api, gdscript, course1] = await Promise.all([
      import('../data/cards.godot-api.json'),
      import('../data/cards.gdscript.json'),
      import('../data/courses/course-1.json'),
    ]);
    return { cards: [...(api.default as Card[]), ...(gdscript.default as Card[])], courses: [course1.default as Course] };
  }),
};

const github: Area = {
  id: 'github',
  label: 'Git & GitHub',
  families: ['github'],
  familyLabels: { github: 'GitHub' },
  newPerDay: { github: 5 },
  vendor: 'GitHub',
  unofficialLine: 'Unofficial; not affiliated with or endorsed by GitHub.',
  docsLabel: 'Open on GitHub Docs',
  theme: godotTokens(),
  load: once(async () => {
    const deck = await import('../data/cards.github.json');
    return { cards: deck.default as Card[], courses: [] };
  }),
};

/** Every area, in the order the app lists them (Godot first). */
export const AREAS: readonly Area[] = [godot, github];

/** What a family's cards look like on a card screen. */
export interface FamilyTraits {
  /** Class cards show Godot's class icon beside the name and the choices. */
  classIcons: boolean;
  /** A flipped card shows the name as plain text (a glossary term), not in code font. */
  plainNames: boolean;
  /** Language items (keywords, built-ins…) without code may be shown flipped. */
  languageItems: boolean;
}

const TRAITS: Record<Family, FamilyTraits> = {
  'godot-api': { classIcons: true, plainNames: false, languageItems: false },
  gdscript: { classIcons: false, plainNames: false, languageItems: true },
  github: { classIcons: false, plainNames: true, languageItems: false },
};

export function familyTraits(family: Family): FamilyTraits {
  return TRAITS[family];
}

/** The area with this id; `undefined` for anything else (callers fall back to Godot). */
export function getArea(id: string | undefined): Area | undefined {
  return AREAS.find((a) => a.id === id);
}

/** The area a family belongs to. */
export function areaOf(family: Family): Area {
  const area = AREAS.find((a) => a.families.includes(family));
  if (!area) throw new Error(`No area holds the family ${family}.`);
  return area;
}

export function familiesOf(id: AreaId): readonly Family[] {
  return getArea(id)?.families ?? [];
}

export function familyLabel(family: Family): string {
  return areaOf(family).familyLabels[family] ?? family;
}
