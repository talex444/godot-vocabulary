import { FAMILIES, type Family } from '../cards/types';

export interface FamilySettings {
  enabled: boolean;
  newPerDay: number;
}

export interface Settings {
  families: Record<Family, FamilySettings>;
  /** Desired retention for FSRS; fixed at 0.9 in v1 and not shown in the settings screen. */
  retention: number;
}

export const DEFAULT_SETTINGS: Settings = {
  families: {
    'godot-api': { enabled: true, newPerDay: 10 },
    gdscript: { enabled: true, newPerDay: 5 },
    github: { enabled: true, newPerDay: 5 },
  },
  retention: 0.9,
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
  return { families, retention: stored?.retention ?? DEFAULT_SETTINGS.retention };
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
