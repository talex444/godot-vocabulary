import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { FAMILIES, type Card } from '../cards/types';
import type { Progress } from '../scheduler/fsrs';
import { withDefaults, type Settings } from '../settings/load';

export const DB_NAME = 'godot-vocabulary';
const DB_VERSION = 1;
const SETTINGS_KEY = 'settings';
const LAST_SESSION_KEY = 'lastSessionDate';

/** A card the learner wrote on this device. */
export type CustomCard = Card & { custom: true };

interface Schema extends DBSchema {
  progress: { key: string; value: Progress };
  settings: { key: string; value: Settings };
  customCards: { key: string; value: CustomCard };
  meta: { key: string; value: string };
}

/** Progress as written to the export file: dates become ISO strings. */
export type ExportedProgress = Omit<Progress, 'due' | 'last_review' | 'seenAt'> & {
  due: string;
  last_review?: string;
  seenAt: string;
};

export interface ExportFile {
  version: 1;
  exportedAt: string;
  progress: ExportedProgress[];
  settings: Settings;
  customCards: CustomCard[];
}

let opening: Promise<IDBPDatabase<Schema>> | undefined;

function db(): Promise<IDBPDatabase<Schema>> {
  opening ??= openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('progress', { keyPath: 'cardId' });
      database.createObjectStore('settings');
      database.createObjectStore('customCards', { keyPath: 'id' });
      database.createObjectStore('meta');
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

/** Everything the learner owns, as one JSON-safe object. */
export async function exportAll(now: Date = new Date()): Promise<ExportFile> {
  const [progress, settings, customCards] = await Promise.all([getProgress(), getSettings(), listCustomCards()]);
  return {
    version: 1,
    exportedAt: now.toISOString(),
    progress: [...progress.values()].map(toExported),
    settings,
    customCards,
  };
}

/**
 * Restore an export. `replace` wipes this device first; `merge` keeps this device's settings, adds
 * the file's custom cards, and per card keeps whichever progress record was reviewed more recently.
 */
export async function importAll(json: unknown, mode: 'merge' | 'replace'): Promise<void> {
  const file = parseExport(typeof json === 'string' ? JSON.parse(json) : json);
  const progress = file.progress.map(fromExported);
  const database = await db();
  const tx = database.transaction(['progress', 'settings', 'customCards'], 'readwrite');
  const progressStore = tx.objectStore('progress');
  const writes: Promise<unknown>[] = [];
  if (mode === 'replace') {
    await Promise.all([progressStore.clear(), tx.objectStore('customCards').clear()]);
    writes.push(tx.objectStore('settings').put(withDefaults(file.settings), SETTINGS_KEY));
    writes.push(...progress.map((p) => progressStore.put(p)));
  } else {
    for (const incoming of progress) {
      const existing = await progressStore.get(incoming.cardId);
      if (!existing || reviewedLater(incoming, existing)) writes.push(progressStore.put(incoming));
    }
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

function parseExport(value: unknown): ExportFile {
  const file = value as Partial<ExportFile> | null;
  if (!file || file.version !== 1) throw new Error('Not a godot-vocabulary export (version 1).');
  if (!Array.isArray(file.progress) || !Array.isArray(file.customCards) || typeof file.settings !== 'object') {
    throw new Error('Export file is missing progress, settings or custom cards.');
  }
  for (const p of file.progress) {
    if (typeof p?.cardId !== 'string' || Number.isNaN(Date.parse(p.due))) throw new Error('Export file has a broken progress record.');
  }
  return file as ExportFile;
}
