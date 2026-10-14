import { sessionSummary } from '../session/build';
import type { Loaded } from '../session/run';

/**
 * The Android package's daily reminder (decisions 25, 27). Only these plain helpers live here; every
 * Capacitor call is in `native.ts`, which the app loads with `import()` only inside the package.
 */

export const REMINDER_SENTENCE = 'Fires at about that time. Turn on Exact time if you want the minute.';

/** True inside the Capacitor package: its WebView injects `window.Capacitor` before the app's scripts run. */
export function isNativeApp(): boolean {
  const capacitor = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
}

/** `HH:MM` → hour and minute; `undefined` when it is not a time of day. */
export function parseTime(time: string): { hour: number; minute: number } | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : undefined;
}

/** The next moment the clock reads `time`, after `now` (local time). */
export function nextFire(time: { hour: number; minute: number }, now: Date): Date {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.hour, time.minute);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

/**
 * Due reviews plus today's new cards in the enabled families, as they will stand at `at`, summed over
 * every area (one notification, one total). Each area is counted with its own overdue gate.
 */
export function cardsWaiting(areas: readonly Loaded[], at: Date): number {
  let n = 0;
  for (const loaded of areas) {
    for (const s of Object.values(sessionSummary({ ...loaded, now: at }))) if (s.enabled) n += s.due + s.newAvailable;
  }
  return n;
}

/** The notification's title; without a count (unknown, or none) it says cards are waiting. */
export function reminderTitle(count?: number): string {
  if (!count || count < 1) return 'Godot Vocabulary · cards are waiting';
  return `Godot Vocabulary · ${count} ${count === 1 ? 'card' : 'cards'} waiting`;
}
