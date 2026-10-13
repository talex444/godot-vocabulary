import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { newProgress, review } from '../../src/scheduler/fsrs';
import { DEFAULT_SETTINGS } from '../../src/settings/load';
import { addCustomCard, deleteStore, getProgress, getSettings, listCustomCards, saveProgress, saveSettings } from '../../src/store/db';
import { exportFileName, exportText, importSummary, importText } from '../../src/store/file';

const t0 = new Date(2026, 9, 13, 23, 30);

beforeEach(async () => {
  await deleteStore();
});

describe('export and import files', () => {
  it('names the file by the local date', () => {
    expect(exportFileName(t0)).toBe('godot-vocabulary-2026-10-13.json');
  });

  it('restores progress, settings and custom cards on a fresh device and reports the counts', async () => {
    await saveProgress(review(newProgress('gh:term:fork', 'github', t0), true, t0));
    await saveSettings({ ...DEFAULT_SETTINGS, families: { ...DEFAULT_SETTINGS.families, github: { enabled: false, newPerDay: 7 } } });
    await addCustomCard({
      id: 'custom:github:rebase-abc123',
      family: 'github',
      kind: 'custom',
      prompt: 'Replays your commits on top of another branch.',
      answer: 'rebase',
      distractors: ['merge', 'fork', 'clone'],
      explain: '',
      source: { doc: 'custom', ref: 'your card', version: '1' },
      rank: 96,
    });
    const text = await exportText(t0);
    await deleteStore();

    const result = await importText(text, 'replace');
    expect(result).toEqual({ progress: 1, customCards: 1 });
    expect(importSummary(result)).toBe('Restored 1 card of progress and 1 custom card.');
    expect((await getProgress()).has('gh:term:fork')).toBe(true);
    expect((await getSettings()).families.github).toEqual({ enabled: false, newPerDay: 7 });
    expect((await listCustomCards()).map((c) => c.id)).toEqual(['custom:github:rebase-abc123']);
  });

  it('says plainly when a file is not JSON or not an export', async () => {
    await expect(importText('not json', 'merge')).rejects.toThrow('not a JSON file');
    await expect(importText('{"version":3}', 'merge')).rejects.toThrow('Not a godot-vocabulary export');
  });
});
