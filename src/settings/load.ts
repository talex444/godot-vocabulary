import { AREAS, type AreaId } from '../areas/registry';
import { FAMILIES, type Family } from '../cards/types';

export interface FamilySettings {
  enabled: boolean;
  newPerDay: number;
}

/**
 * Which new cards come first (decision 30): `frequency` = rank order; `course` = the unseen cards
 * of finished lessons first, then rank order. Mark done on a lesson sets it for that course's area.
 */
export type NewCardMode = 'frequency' | 'course';

export interface AreaSettings {
  newCardMode: NewCardMode;
}

export interface Settings {
  families: Record<Family, FamilySettings>;
  /** Desired retention for FSRS; fixed at 0.9 in v1 and not shown in the settings screen. */
  retention: number;
  /** Per area (export version 4); before that one global `newCardMode`. */
  areas: Record<AreaId, AreaSettings>;
}

/** Settings as stored by an older version: one global `newCardMode`, no `areas`. */
export type StoredSettings = Partial<Omit<Settings, 'areas'>> & {
  areas?: Partial<Record<string, Partial<AreaSettings>>>;
  newCardMode?: unknown;
};

/**
 * The areas that had a course when the per-area mode came in (GV-8a, 2026-10-14). A global
 * `newCardMode` from an older file or device is carried to these; every other area starts at frequency.
 */
export const AREAS_WITH_COURSES_AT_V4: readonly AreaId[] = ['godot'];

export const DEFAULT_SETTINGS: Settings = {
  families: Object.fromEntries(
    AREAS.flatMap((area) => area.families.map((family) => [family, { enabled: true, newPerDay: area.newPerDay[family] ?? 0 }])),
  ) as Record<Family, FamilySettings>,
  retention: 0.9,
  areas: Object.fromEntries(AREAS.map((area) => [area.id, { newCardMode: 'frequency' }])) as Record<AreaId, AreaSettings>,
};

/** About ten reviews per day follow from each new card per day (decision 21). */
export const REVIEWS_PER_NEW_CARD = 10;
export const NEW_CARD_WARNING_ABOVE = 20;

/**
 * Fresh copy of the defaults with any stored values laid over them. Families and areas come from the
 * registry, never from the stored keys, so unknown ones are dropped and missing ones get defaults.
 * An older global `newCardMode` (no `areas`) goes to `AREAS_WITH_COURSES_AT_V4`.
 */
export function withDefaults(stored?: StoredSettings | null): Settings {
  const families = {} as Record<Family, FamilySettings>;
  for (const family of FAMILIES) {
    families[family] = { ...DEFAULT_SETTINGS.families[family], ...stored?.families?.[family] };
  }
  const legacy = stored?.areas === undefined && stored?.newCardMode === 'course';
  const areas = {} as Record<AreaId, AreaSettings>;
  for (const { id } of AREAS) {
    const mode = stored?.areas?.[id]?.newCardMode ?? (legacy && AREAS_WITH_COURSES_AT_V4.includes(id) ? 'course' : 'frequency');
    areas[id] = { newCardMode: mode === 'course' ? 'course' : 'frequency' };
  }
  return { families, retention: stored?.retention ?? DEFAULT_SETTINGS.retention, areas };
}

/** New cards per day across the enabled families. */
export function totalNewPerDay(settings: Settings): number {
  return FAMILIES.reduce((sum, f) => {
    const s = settings.families[f];
    return s.enabled ? sum + Math.max(0, s.newPerDay) : sum;
  }, 0);
}

export function projectedReviewsPerDay(settings: Settings): number {
  return REVIEWS_PER_NEW_CARD * totalNewPerDay(settings);
}

/** True when the total is above twenty: the screen warns in plain words but still accepts it. */
export function warningAboveTwenty(settings: Settings): boolean {
  return totalNewPerDay(settings) > NEW_CARD_WARNING_ABOVE;
}
