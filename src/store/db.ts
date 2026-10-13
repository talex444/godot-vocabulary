import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { FAMILIES, type Card } from '../cards/types';
import type { Progress } from '../scheduler/fsrs';
import { withDefaults, type Settings } from '../settings/load';

export const DB_NAME = 'godot-vocabulary';
const DB_VERSION = 2;
const SETTINGS_KEY = 'settings';
const LAST_SESSION_KEY = 'lastSessionDate';

/** A card the learner wrote on this device. */
export type CustomCard = Card & { custom: true };

/** A card the learner took out of the deck (decision 26), with the optional reason they gave. */
export interface SkippedCard {
  cardId: string;
  reason?: string;
  at: Date;
}

/** A finished course lesson (decision 30). */
export interface LessonDone {
  lessonId: string;
  at: Date;
}

interface Schema extends DBSchema {
  progress: { key: string; value: Progress };
  settings: { key: string; value: Settings };
  customCards: { key: string; value: CustomCard };
  meta: { key: string; value: string };
  skipped: { key: string; value: SkippedCard };
  lessonsDone: { key: string; value: LessonDone };
}

/** Progress as written to the export file: dates become ISO strings. */
export type ExportedProgress = Omit<Progress, 'due' | 'last_review' | 'seenAt'> & {
  due: string;
  last_review?: string;
  seenAt: string;
};

export type ExportedSkip = Omit<SkippedCard, 'at'> & { at: string };
export type ExportedLesson = Omit<LessonDone, 'at'> & { at: string };

/** Version 2 adds `skipped` and `lessonsDone`; version 1 files (without them) still import. */
export interface ExportFile {
  version: 2;
  exportedAt: string;
  progress: ExportedProgress[];
  settings: Settings;
  customCards: CustomCard[];
  skipped: ExportedSkip[];
  lessonsDone: ExportedLesson[];
}

let opening: Promise<IDBPDatabase<Schema>> | undefined;

function db(): Promise<IDBPDatabase<Schema>> {
  opening ??= openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('progress', { keyPath: 'cardId' });
        database.createObjectStore('settings');
        database.createObjectStore('customCards', { keyPath: 'id' });
        database.createObjectStore('meta');
      }
      if (oldVersion < 2) {
        database.createObjectStore('skipped', { keyPath: 'cardId' });
        database.createObjectStore('lessonsDone', { keyPath: 'lessonId' });
      }
    },
  });
  return opening;
}

/** Close the connection (tests reopen a fresh database afterwards). */
export async function closeStore(): Promise<void> {
  if (opening) (await opening).close();
  opening = undefined;
}

/** Delete the whole database. */
export async function deleteStore(): Promise<void> {
  await closeStore();
  await deleteDB(DB_NAME);
}

export async function getSettings(): Promise<Settings> {
  return withDefaults(await (await db()).get('settings', SETTINGS_KEY));
}

export async function saveSettings(settings: Settings): Promise<void> {
  await (await db()).put('settings', withDefaults(settings), SETTINGS_KEY);
}

/** Progress records by card id: the given ids that have one, or every record when `ids` is omitted. */
export async function getProgress(ids?: readonly string[]): Promise<Map<string, Progress>> {
  const database = await db();
  const records = ids
    ? (await Promise.all(ids.map((id) => database.get('progress', id)))).filter((p) => p !== undefined)
    : await database.getAll('progress');
  return new Map(records.map((p) => [p.cardId, p]));
}

export async function saveProgress(progress: Progress | readonly Progress[]): Promise<void> {
  const tx = (await db()).transaction('progress', 'readwrite');
  await Promise.all([...[progress].flat().map((p) => tx.store.put(p)), tx.done]);
}

export async function listCustomCards(): Promise<CustomCard[]> {
  return (await db()).getAll('customCards');
}

export async function addCustomCard(card: Card): Promise<CustomCard> {
  if (!FAMILIES.includes(card.family)) throw new Error(`Unknown family: ${card.family}`);
  const custom: CustomCard = { ...card, custom: true };
  await (await db()).put('customCards', custom);
  return custom;
}

/** Remove a custom card and whatever progress it had. */
export async function deleteCustomCard(id: string): Promise<void> {
  const tx = (await db()).transaction(['customCards', 'progress'], 'readwrite');
  await Promise.all([tx.objectStore('customCards').delete(id), tx.objectStore('progress').delete(id), tx.done]);
}

export async function getLastSessionDate(): Promise<string | undefined> {
  return (await db()).get('meta', LAST_SESSION_KEY);
}

export async function setLastSessionDate(date: string): Promise<void> {
  await (await db()).put('meta', date, LAST_SESSION_KEY);
}

/** Skipped cards, oldest first. */
export async function listSkipped(): Promise<SkippedCard[]> {
  return (await (await db()).getAll('skipped')).sort((a, b) => a.at.getTime() - b.at.getTime());
}

export async function getSkippedIds(): Promise<Set<string>> {
  return new Set((await (await db()).getAllKeys('skipped')).map(String));
}

/** Takes a card out of the deck; its progress is kept, so undo brings it back where it was. */
export async function skipCard(cardId: string, reason?: string, at: Date = new Date()): Promise<void> {
  const trimmed = reason?.trim();
  await (await db()).put('skipped', { cardId, ...(trimmed ? { reason: trimmed } : {}), at });
}

/** Undo a skip. */
export async function unskipCard(cardId: string): Promise<void> {
  await (await db()).delete('skipped', cardId);
}

export async function listLessonsDone(): Promise<LessonDone[]> {
  return (await (await db()).getAll('lessonsDone')).sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Lesson ids in the order they were finished (the session builder's `lessonsDone`). */
export async function getLessonsDoneIds(): Promise<string[]> {
  return (await listLessonsDone()).map((l) => l.lessonId);
}

/** Records a finished lesson; finishing it again keeps the first date. */
export async function markLessonDone(lessonId: string, at: Date = new Date()): Promise<void> {
  const tx = (await db()).transaction('lessonsDone', 'readwrite');
  if (!(await tx.store.get(lessonId))) await tx.store.put({ lessonId, at });
  await tx.done;
}

/** Everything the learner owns, as one JSON-safe object. */
export async function exportAll(now: Date = new Date()): Promise<ExportFile> {
  const [progress, settings, customCards, skipped, lessonsDone] = await Promise.all([
    getProgress(),
    getSettings(),
    listCustomCards(),
    listSkipped(),
    listLessonsDone(),
  ]);
  return {
    version: 2,
    exportedAt: now.toISOString(),
    progress: [...progress.values()].map(toExported),
    settings,
    customCards,
    skipped: skipped.map((s) => ({ ...s, at: s.at.toISOString() })),
    lessonsDone: lessonsDone.map((l) => ({ ...l, at: l.at.toISOString() })),
  };
}

/**
 * Restore an export (version 1 or 2). `replace` wipes this device first; `merge` keeps this
 * device's settings, adds the file's custom cards, skips and finished lessons (this device's entry
 * wins on the same id), and per card keeps whichever progress record was reviewed more recently.
 */
export async function importAll(json: unknown, mode: 'merge' | 'replace'): Promise<void> {
  const file = parseExport(typeof json === 'string' ? JSON.parse(json) : json);
  const progress = file.progress.map(fromExported);
  const skipped = file.skipped.map((s) => ({ ...s, at: new Date(s.at) }));
  const lessons = file.lessonsDone.map((l) => ({ ...l, at: new Date(l.at) }));
  const database = await db();
  const tx = database.transaction(['progress', 'settings', 'customCards', 'skipped', 'lessonsDone'], 'readwrite');
  const progressStore = tx.objectStore('progress');
  const skippedStore = tx.objectStore('skipped');
  const lessonStore = tx.objectStore('lessonsDone');
  const writes: Promise<unknown>[] = [];
  if (mode === 'replace') {
    await Promise.all([progressStore.clear(), tx.objectStore('customCards').clear(), skippedStore.clear(), lessonStore.clear()]);
    writes.push(tx.objectStore('settings').put(withDefaults(file.settings), SETTINGS_KEY));
    writes.push(...progress.map((p) => progressStore.put(p)));
    writes.push(...skipped.map((s) => skippedStore.put(s)), ...lessons.map((l) => lessonStore.put(l)));
  } else {
    for (const incoming of progress) {
      const existing = await progressStore.get(incoming.cardId);
      if (!existing || reviewedLater(incoming, existing)) writes.push(progressStore.put(incoming));
    }
    for (const s of skipped) if (!(await skippedStore.get(s.cardId))) writes.push(skippedStore.put(s));
    for (const l of lessons) if (!(await lessonStore.get(l.lessonId))) writes.push(lessonStore.put(l));
  }
  writes.push(...file.customCards.map((c) => tx.objectStore('customCards').put({ ...c, custom: true })));
  await Promise.all([...writes, tx.done]);
}

function reviewedLater(a: Progress, b: Progress): boolean {
  const at = a.last_review?.getTime() ?? -Infinity;
  const bt = b.last_review?.getTime() ?? -Infinity;
  return at !== bt ? at > bt : a.reps > b.reps;
}

function toExported(p: Progress): ExportedProgress {
  const { due, last_review, seenAt, ...rest } = p;
  return {
    ...rest,
    due: due.toISOString(),
    ...(last_review ? { last_review: last_review.toISOString() } : {}),
    seenAt: seenAt.toISOString(),
  };
}

function fromExported(p: ExportedProgress): Progress {
  const { due, last_review, seenAt, ...rest } = p;
  return {
    ...rest,
    due: new Date(due),
    ...(last_review ? { last_review: new Date(last_review) } : {}),
    seenAt: new Date(seenAt),
  };
}

/** Reads a version 1 or 2 file into the version 2 shape (version 1 has no skips or lessons). */
function parseExport(value: unknown): ExportFile {
  const file = value as (Omit<Partial<ExportFile>, 'version'> & { version?: unknown }) | null;
  if (!file || (file.version !== 1 && file.version !== 2)) throw new Error('Not a godot-vocabulary export (version 1 or 2).');
  if (!Array.isArray(file.progress) || !Array.isArray(file.customCards) || typeof file.settings !== 'object') {
    throw new Error('Export file is missing progress, settings or custom cards.');
  }
  for (const p of file.progress) {
    if (typeof p?.cardId !== 'string' || Number.isNaN(Date.parse(p.due))) throw new Error('Export file has a broken progress record.');
  }
  const skipped = file.version === 2 ? file.skipped : [];
  const lessonsDone = file.version === 2 ? file.lessonsDone : [];
  if (!Array.isArray(skipped) || !Array.isArray(lessonsDone)) throw new Error('Export file is missing skipped cards or lessons.');
  for (const s of skipped) {
    if (typeof s?.cardId !== 'string' || Number.isNaN(Date.parse(s.at))) throw new Error('Export file has a broken skipped card.');
  }
  for (const l of lessonsDone) {
    if (typeof l?.lessonId !== 'string' || Number.isNaN(Date.parse(l.at))) throw new Error('Export file has a broken lesson record.');
  }
  return { ...(file as ExportFile), version: 2, skipped, lessonsDone };
}
