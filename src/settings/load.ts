import { AREAS } from '../areas/registry';
import { FAMILIES, type Family } from '../cards/types';

export interface FamilySettings {
  enabled: boolean;
  newPerDay: number;
}

/**
 * Which new cards come first (decision 30): `frequency` = rank order; `course` = the unseen cards
 * of finished lessons first, then rank order. No screen sets it yet.
 */
export type NewCardMode = 'frequency' | 'course';

export interface Settings {
  families: Record<Family, FamilySettings>;
  /** Desired retention for FSRS; fixed at 0.9 in v1 and not shown in the settings screen. */
  retention: number;
  newCardMode: NewCardMode;
}

export const DEFAULT_SETTINGS: Settings = {
  families: Object.fromEntries(
    AREAS.flatMap((area) => area.families.map((family) => [family, { enabled: true, newPerDay: area.newPerDay[family] ?? 0 }])),
  ) as Record<Family, FamilySettings>,
  retention: 0.9,
  newCardMode: 'frequency',
};

/** About ten reviews per day follow from each new card per day (decision 21). */
export const REVIEWS_PER_NEW_CARD = 10;
export const NEW_CARD_WARNING_ABOVE = 20;

/** Fresh copy of the defaults with any stored values laid over them (unknown families dropped). */
export function withDefaults(stored?: Partial<Settings> | null): Settings {
  const families = {} as Record<Family, FamilySettings>;
  for (const family of FAMILIES) {
    families[family] = { ...DEFAULT_SETTINGS.families[family], ...stored?.families?.[family] };
  }
  return {
    families,
    retention: stored?.retention ?? DEFAULT_SETTINGS.retention,
    newCardMode: stored?.newCardMode === 'course' ? 'course' : 'frequency',
  };
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
