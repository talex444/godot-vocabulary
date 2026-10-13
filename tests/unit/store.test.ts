import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Card } from '../../src/cards/types';
import { newProgress, review } from '../../src/scheduler/fsrs';
import { DEFAULT_SETTINGS } from '../../src/settings/load';
import {
  addCustomCard,
  deleteCustomCard,
  deleteStore,
  exportAll,
  getLastSessionDate,
  getProgress,
  getSettings,
  importAll,
  listCustomCards,
  saveProgress,
  saveSettings,
  setLastSessionDate,
} from '../../src/store/db';

const t0 = new Date(2026, 9, 13, 9, 0);
const later = new Date(2026, 9, 13, 9, 10);

const myCard: Card = {
  id: 'custom:signal-up',
  family: 'gdscript',
  kind: 'concept',
  prompt: 'Rule of thumb: call down, signal ____',
  answer: 'up',
  distractors: ['down', 'sideways', 'nowhere'],
  explain: 'Parents call methods on children; children emit signals to parents.',
  source: { doc: 'custom', ref: 'me', version: '1' },
  rank: 0,
};

beforeEach(async () => {
  await deleteStore();
});

describe('on-device store', () => {
  it('returns the default settings until some are saved, then round-trips them', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    const changed = structuredClone(DEFAULT_SETTINGS);
    changed.families.github = { enabled: false, newPerDay: 3 };
    await saveSettings(changed);
    expect(await getSettings()).toEqual(changed);
  });

  it('round-trips progress with real Date objects', async () => {
    const a = review(newProgress('gd:keyword:var', 'gdscript', t0), true, t0);
    const b = newProgress('gh:term:fork', 'github', t0);
    await saveProgress([a, b]);
    const some = await getProgress(['gd:keyword:var', 'missing']);
    expect([...some.keys()]).toEqual(['gd:keyword:var']);
    expect(some.get('gd:keyword:var')).toEqual(a);
    expect(some.get('gd:keyword:var')!.due).toBeInstanceOf(Date);
    expect((await getProgress()).size).toBe(2);
  });

  it('adds, lists and deletes custom cards (with their progress)', async () => {
    const stored = await addCustomCard(myCard);
    expect(stored.custom).toBe(true);
    await saveProgress(newProgress(myCard.id, 'gdscript', t0));
    expect(await listCustomCards()).toEqual([stored]);
    await deleteCustomCard(myCard.id);
    expect(await listCustomCards()).toEqual([]);
    expect((await getProgress([myCard.id])).size).toBe(0);
  });

  it('keeps the last session date in meta', async () => {
    expect(await getLastSessionDate()).toBeUndefined();
    await setLastSessionDate('2026-10-13');
    expect(await getLastSessionDate()).toBe('2026-10-13');
  });
});

describe('export and import', () => {
  async function seed() {
    await saveProgress(review(newProgress('gd:keyword:var', 'gdscript', t0), true, t0));
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.families['godot-api'].newPerDay = 15;
    await saveSettings(settings);
    await addCustomCard(myCard);
  }

  it('writes one JSON-safe object with version, date, progress, settings and custom cards', async () => {
    await seed();
    const file = await exportAll(later);
    expect(file.version).toBe(1);
    expect(file.exportedAt).toBe(later.toISOString());
    expect(file.progress).toHaveLength(1);
    expect(typeof file.progress[0]!.due).toBe('string');
    expect(file.settings.families['godot-api'].newPerDay).toBe(15);
    expect(file.customCards.map((c) => c.id)).toEqual([myCard.id]);
    expect(JSON.parse(JSON.stringify(file))).toEqual(file);
  });

  it('restores everything on a fresh install (replace)', async () => {
    await seed();
    const before = { progress: await getProgress(), settings: await getSettings(), cards: await listCustomCards() };
    const text = JSON.stringify(await exportAll(later));
    await deleteStore();
    expect((await getProgress()).size).toBe(0);

    await importAll(text, 'replace');
    expect(await getProgress()).toEqual(before.progress);
    expect(await getSettings()).toEqual(before.settings);
    expect(await listCustomCards()).toEqual(before.cards);
  });

  it('replace wipes what was on the device', async () => {
    await seed();
    const file = await exportAll(later);
    await saveProgress(newProgress('gh:term:fork', 'github', t0));
    await importAll(file, 'replace');
    expect([...(await getProgress()).keys()]).toEqual(['gd:keyword:var']);
  });

  it('merge keeps the more recently reviewed record and this device\'s settings', async () => {
    const old = review(newProgress('gd:keyword:var', 'gdscript', t0), true, t0);
    await saveProgress(old);
    const file = await exportAll(later);

    const newer = review(old, true, old.due);
    await saveProgress([newer, newProgress('gh:term:fork', 'github', t0)]);
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.families.gdscript.newPerDay = 1;
    await saveSettings(settings);

    file.customCards.push({ ...myCard, custom: true });
    await importAll(file, 'merge');
    const progress = await getProgress();
    expect(progress.get('gd:keyword:var')).toEqual(newer);
    expect(progress.has('gh:term:fork')).toBe(true);
    expect((await getSettings()).families.gdscript.newPerDay).toBe(1);
    expect((await listCustomCards()).map((c) => c.id)).toEqual([myCard.id]);
  });

  it('merge takes the file\'s record when it was reviewed more recently', async () => {
    const old = review(newProgress('gd:keyword:var', 'gdscript', t0), true, t0);
    const newer = review(old, true, old.due);
    await saveProgress(newer);
    const file = await exportAll(later);
    await saveProgress(old);
    await importAll(file, 'merge');
    expect((await getProgress()).get('gd:keyword:var')).toEqual(newer);
  });

  it('rejects files that are not an export', async () => {
    await expect(importAll({ version: 2 }, 'merge')).rejects.toThrow(/version 1/);
    await expect(importAll('{"version":1}', 'replace')).rejects.toThrow(/missing/);
  });
});
