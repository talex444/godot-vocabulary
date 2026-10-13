import { localDate } from '../session/run';
import { exportAll, importAll } from './db';

/** `godot-vocabulary-YYYY-MM-DD.json`, by the device's local date. */
export function exportFileName(now: Date): string {
  return `godot-vocabulary-${localDate(now)}.json`;
}

/** The export as pretty-printed JSON text. */
export async function exportText(now: Date = new Date()): Promise<string> {
  return `${JSON.stringify(await exportAll(now), null, 2)}\n`;
}

export interface ImportResult {
  progress: number;
  customCards: number;
}

/** Reads an export file's text into this device; the counts are what the file carried. */
export async function importText(text: string, mode: 'merge' | 'replace'): Promise<ImportResult> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not a JSON file.');
  }
  await importAll(data, mode);
  const file = data as { progress: unknown[]; customCards: unknown[] };
  return { progress: file.progress.length, customCards: file.customCards.length };
}

/** "Restored 12 cards of progress and 1 custom card." */
export function importSummary(result: ImportResult): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return `Restored ${plural(result.progress, 'card', 'cards')} of progress and ${plural(result.customCards, 'custom card', 'custom cards')}.`;
}
