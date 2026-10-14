import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AreaId } from '../../src/areas/registry';
import type { Card } from '../../src/cards/types';
import { coursesFor, findLesson } from '../../src/courses/index';
import { newProgress, review } from '../../src/scheduler/fsrs';
import { DEFAULT_SETTINGS } from '../../src/settings/load';
import {
  addCustomCard,
  deleteCustomCard,
  deleteStore,
  exportAll,
  getExitTicket,
  getLastArea,
  getLastSessionDate,
  getLessonsDoneIds,
  getProgress,
  getSettings,
  getSkippedIds,
  importAll,
  listCustomCards,
  listExitTickets,
  listLessonsDone,
  listSkipped,
  markDoneSettings,
  markLessonDone,
  NEWER_FILE_MESSAGE,
  saveExitTicket,
  saveProgress,
  saveReminder,
  saveSettings,
  setLastArea,
  setLastSessionDate,
  skipCard,
  unskipCard,
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
    expect(file.version).toBe(4);
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
    await expect(importAll({ version: 0 }, 'merge')).rejects.toThrow(/version 1 to 4/);
    await expect(importAll('{"version":1}', 'replace')).rejects.toThrow(/missing/);
    const v2 = { ...(await exportAll(later)), skipped: [{ cardId: 'x', at: 'not a date' }] };
    await expect(importAll(v2, 'replace')).rejects.toThrow(/skipped/);
  });
});

describe('skipped cards and finished lessons (done-criteria 37, 39)', () => {
  it('skips, lists with the reason, and undoes', async () => {
    await skipCard('api:class:Timer', '  wrong description ', t0);
    await skipCard('gh:term:fork', '', later);
    expect(await listSkipped()).toEqual([
      { cardId: 'api:class:Timer', reason: 'wrong description', at: t0 },
      { cardId: 'gh:term:fork', at: later },
    ]);
    expect(await getSkippedIds()).toEqual(new Set(['api:class:Timer', 'gh:term:fork']));
    await unskipCard('api:class:Timer');
    expect([...(await getSkippedIds())]).toEqual(['gh:term:fork']);
  });

  it('records a lesson once, keeping the first date', async () => {
    await markLessonDone('l1', t0);
    await markLessonDone('l1', later);
    await markLessonDone('l2', later);
    expect(await listLessonsDone()).toEqual([
      { lessonId: 'l1', at: t0 },
      { lessonId: 'l2', at: later },
    ]);
    expect(await getLessonsDoneIds()).toEqual(['l1', 'l2']);
  });

  it('exports version 4 with skips and lessons, and restores them on a fresh install', async () => {
    await skipCard('api:class:Timer', 'confusing', t0);
    await markLessonDone('l1', t0);
    const file = await exportAll(later);
    expect(file.version).toBe(4);
    expect(file.skipped).toEqual([{ cardId: 'api:class:Timer', reason: 'confusing', at: t0.toISOString() }]);
    expect(file.lessonsDone).toEqual([{ lessonId: 'l1', at: t0.toISOString() }]);
    expect(JSON.parse(JSON.stringify(file))).toEqual(file);

    await deleteStore();
    await importAll(JSON.stringify(file), 'replace');
    expect(await listSkipped()).toEqual([{ cardId: 'api:class:Timer', reason: 'confusing', at: t0 }]);
    expect(await listLessonsDone()).toEqual([{ lessonId: 'l1', at: t0 }]);
  });

  it('merge adds the file\'s skips and lessons, keeping this device\'s on the same id; replace clears them', async () => {
    await skipCard('api:class:Timer', 'from the file', t0);
    await markLessonDone('l1', t0);
    const file = await exportAll(later);
    await deleteStore();
    await skipCard('api:class:Timer', 'mine', later);
    await skipCard('gh:term:fork', undefined, later);
    await importAll(file, 'merge');
    expect(await listSkipped()).toEqual([
      { cardId: 'api:class:Timer', reason: 'mine', at: later },
      { cardId: 'gh:term:fork', at: later },
    ]);
    expect(await getLessonsDoneIds()).toEqual(['l1']);

    await importAll({ ...file, skipped: [], lessonsDone: [] }, 'replace');
    expect(await listSkipped()).toEqual([]);
    expect(await listLessonsDone()).toEqual([]);
  });

  it('still imports a version 1 file, which has no skips or lessons', async () => {
    await saveProgress(newProgress('gd:keyword:var', 'gdscript', t0));
    const { skipped: _s, lessonsDone: _l, exitTickets: _t, ...rest } = await exportAll(later);
    await deleteStore();
    await skipCard('gh:term:fork', undefined, t0);
    await importAll({ ...rest, version: 1 }, 'merge');
    expect([...(await getProgress()).keys()]).toEqual(['gd:keyword:var']);
    expect([...(await getSkippedIds())]).toEqual(['gh:term:fork']);
    await importAll({ ...rest, version: 1 }, 'replace');
    expect(await listSkipped()).toEqual([]);
  });

  it('still imports a version 2 file, which has no exit tickets', async () => {
    await markLessonDone('l1', t0);
    const { exitTickets: _t, ...rest } = await exportAll(later);
    await deleteStore();
    await saveExitTicket('l0', 'mine', t0);
    await importAll({ ...rest, version: 2 }, 'merge');
    expect(await getLessonsDoneIds()).toEqual(['l1']);
    expect(await listExitTickets()).toEqual([{ lessonId: 'l0', text: 'mine', date: t0 }]);
    await importAll({ ...rest, version: 2 }, 'replace');
    expect(await listExitTickets()).toEqual([]);
  });
});

describe('export v4: areas, forward compatibility, validation (decision 53; done-criteria 65)', () => {
  /** A version 3 file as the 1.2.x app wrote it: one global newCardMode in its settings. */
  function v3File(newCardMode: 'course' | 'frequency') {
    const { areas: _a, ...settings } = structuredClone(DEFAULT_SETTINGS);
    return {
      version: 3,
      exportedAt: later.toISOString(),
      progress: [],
      settings: { ...settings, newCardMode },
      customCards: [],
      skipped: [],
      lessonsDone: [{ lessonId: 'c1-l0', at: t0.toISOString() }],
      exitTickets: [],
    };
  }

  it('round trip: export → import (replace) → export gives the same JSON apart from exportedAt, with no device-only keys', async () => {
    await saveProgress(review(newProgress('gd:keyword:var', 'gdscript', t0), true, t0));
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.families.github = { enabled: false, newPerDay: 7 };
    settings.areas.godot.newCardMode = 'course';
    await saveSettings(settings);
    await addCustomCard(myCard);
    await skipCard('api:class:Timer', 'confusing', t0);
    await markLessonDone('c1-l0', t0);
    await saveExitTicket('c1-l0', 'a tree of nodes', t0);
    await saveReminder({ on: true, time: '07:30' });
    await setLastSessionDate('2026-10-13');
    await setLastArea('github');

    const first = await exportAll(later);
    await importAll(JSON.stringify(first), 'replace');
    const second = await exportAll(new Date(2026, 9, 14, 9, 0));
    const strip = ({ exportedAt: _e, ...rest }: typeof first) => rest;
    expect(JSON.stringify(strip(second))).toBe(JSON.stringify(strip(first)));

    // The last-used area and the reminder are this device's settings: never in the file.
    const text = JSON.stringify(first);
    expect(Object.keys(first).sort()).toEqual(['customCards', 'exitTickets', 'exportedAt', 'lessonsDone', 'progress', 'settings', 'skipped', 'version']);
    expect(Object.keys(first.settings).sort()).toEqual(['areas', 'families', 'retention']);
    expect(text).not.toMatch(/reminder|lastArea|last-area|lastSession|07:30/i);
    // An import leaves the device's own last-used area as it was.
    expect(await getLastArea()).toBe('github');
  });

  it('keeps the last-used area on the device; an unknown stored value reads as none', async () => {
    expect(await getLastArea()).toBeUndefined();
    await setLastArea('godot');
    expect(await getLastArea()).toBe('godot');
    await setLastArea('aseprite' as AreaId);
    expect(await getLastArea()).toBeUndefined();
  });

  it('a v3 file’s course mode goes to the Godot area (the one with a course), frequency elsewhere', async () => {
    await importAll(v3File('course'), 'replace');
    expect((await getSettings()).areas).toEqual({ godot: { newCardMode: 'course' }, github: { newCardMode: 'frequency' } });
    await importAll(v3File('frequency'), 'replace');
    expect((await getSettings()).areas.godot.newCardMode).toBe('frequency');
  });

  it('ignores unknown top-level keys and stores; drops an unknown area with a warning, not a rejection', async () => {
    const file = await exportAll(later);
    const warnings: string[] = [];
    const warn = console.warn;
    console.warn = (message: string) => void warnings.push(message);
    try {
      await importAll(
        { ...file, homework: [{ id: 'h1' }], lastArea: 'github', settings: { ...file.settings, areas: { ...file.settings.areas, github: { newCardMode: 'course' }, aseprite: { newCardMode: 'course' } } } },
        'replace',
      );
    } finally {
      console.warn = warn;
    }
    expect((await getSettings()).areas).toEqual({ godot: { newCardMode: 'frequency' }, github: { newCardMode: 'course' } });
    expect(warnings).toEqual([expect.stringContaining('aseprite')]);
    const again = await exportAll(later);
    expect(JSON.stringify(again)).not.toMatch(/aseprite|homework|lastArea/);
  });

  it('Mark done on a course-1 lesson turns course mode on for Godot and leaves GitHub as it was', async () => {
    const lesson = findLesson('c1-l0', await coursesFor('godot'))!;
    await markDoneSettings(lesson.course.area);
    expect((await getSettings()).areas).toEqual({ godot: { newCardMode: 'course' }, github: { newCardMode: 'frequency' } });
    const settings = await getSettings();
    settings.areas = { godot: { newCardMode: 'frequency' }, github: { newCardMode: 'course' } };
    await saveSettings(settings);
    await markDoneSettings(lesson.course.area);
    expect((await getSettings()).areas).toEqual({ godot: { newCardMode: 'course' }, github: { newCardMode: 'course' } });
  });

  it('refuses a file from a newer version in plain words', async () => {
    const file = { ...(await exportAll(later)), version: 5 };
    await expect(importAll(file, 'merge')).rejects.toThrow(NEWER_FILE_MESSAGE);
    expect(NEWER_FILE_MESSAGE).toBe('This file was made by a newer version of the app. Update the app, then import it.');
  });

  it('refuses a custom card of a family the app does not have, and keeps only the card fields of the rest', async () => {
    const file = await exportAll(later);
    const foreign = { ...myCard, id: 'custom:aseprite:x', family: 'aseprite' };
    await expect(importAll({ ...file, customCards: [foreign] }, 'replace')).rejects.toThrow(/family this app does not have: aseprite/);
    await importAll({ ...file, customCards: [{ ...myCard, custom: true, script: 'alert(1)', extra: { a: 1 } }] }, 'replace');
    expect(await listCustomCards()).toEqual([{ ...myCard, custom: true }]);
  });
});

describe('exit tickets (decision 39)', () => {
  it('saves, replaces and removes a lesson\'s ticket; empty text removes it', async () => {
    await saveExitTicket('c1-l0', '  a tree of nodes ', t0);
    expect(await getExitTicket('c1-l0')).toEqual({ lessonId: 'c1-l0', text: 'a tree of nodes', date: t0 });
    await saveExitTicket('c1-l0', 'a tree of scenes', later);
    expect(await listExitTickets()).toEqual([{ lessonId: 'c1-l0', text: 'a tree of scenes', date: later }]);
    await saveExitTicket('c1-l0', '   ');
    expect(await getExitTicket('c1-l0')).toBeUndefined();
  });

  it('export v3 carries the tickets; replace restores them, merge keeps this device\'s on the same lesson', async () => {
    await saveExitTicket('c1-l0', 'from the file', t0);
    await saveExitTicket('c1-l1', 'second', t0);
    const file = await exportAll(later);
    expect(file.exitTickets).toEqual([
      { lessonId: 'c1-l0', text: 'from the file', date: t0.toISOString() },
      { lessonId: 'c1-l1', text: 'second', date: t0.toISOString() },
    ]);
    await deleteStore();
    await importAll(JSON.stringify(file), 'replace');
    expect((await listExitTickets()).map((t) => t.text)).toEqual(['from the file', 'second']);

    await deleteStore();
    await saveExitTicket('c1-l0', 'mine', later);
    await importAll(file, 'merge');
    expect((await listExitTickets()).map((t) => [t.lessonId, t.text])).toEqual([
      ['c1-l1', 'second'],
      ['c1-l0', 'mine'],
    ]);
    await expect(importAll({ ...file, exitTickets: [{ lessonId: 'x', text: 1, date: 'no' }] }, 'replace')).rejects.toThrow(/exit ticket/);
  });
});
