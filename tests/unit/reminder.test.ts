import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Card, Family } from '../../src/cards/types';
import { REMINDER_SENTENCE, cardsWaiting, isNativeApp, nextFire, parseTime, reminderTitle } from '../../src/reminder/reminder';
import { DEFAULT_SETTINGS } from '../../src/settings/load';
import { deleteStore, getReminder, saveReminder } from '../../src/store/db';

function card(family: Family, n: number): Card {
  return {
    id: `${family}:${n}`,
    family,
    kind: 'term',
    prompt: `p${n}`,
    answer: `a${n}`,
    distractors: ['x', 'y', 'z'],
    explain: 'e',
    source: { doc: 'test', ref: 'test', version: '1' },
    rank: n,
  };
}

const deck = (['godot-api', 'gdscript', 'github'] as Family[]).flatMap((f) => Array.from({ length: 30 }, (_, i) => card(f, i)));

describe('reminder helpers', () => {
  it('reads a time of day and refuses anything else', () => {
    expect(parseTime('20:00')).toEqual({ hour: 20, minute: 0 });
    expect(parseTime('07:45')).toEqual({ hour: 7, minute: 45 });
    expect(parseTime('24:00')).toBeUndefined();
    expect(parseTime('7:45')).toBeUndefined();
    expect(parseTime('')).toBeUndefined();
  });

  it('fires later today, or tomorrow once the time has passed', () => {
    const morning = new Date(2026, 9, 13, 9, 0);
    expect(nextFire({ hour: 20, minute: 0 }, morning)).toEqual(new Date(2026, 9, 13, 20, 0));
    expect(nextFire({ hour: 8, minute: 30 }, morning)).toEqual(new Date(2026, 9, 14, 8, 30));
    expect(nextFire({ hour: 9, minute: 0 }, morning)).toEqual(new Date(2026, 9, 14, 9, 0));
  });

  it('counts due reviews and today’s new cards in the enabled families', () => {
    const at = new Date(2026, 9, 13, 20, 0);
    const loaded = { cards: deck, progress: new Map(), settings: structuredClone(DEFAULT_SETTINGS) };
    expect(cardsWaiting(loaded, at)).toBe(20);
    loaded.settings.families.github.enabled = false;
    expect(cardsWaiting(loaded, at)).toBe(15);
  });

  it('says how many cards wait, or that cards are waiting when it cannot tell', () => {
    expect(reminderTitle(12)).toBe('Godot Vocabulary · 12 cards waiting');
    expect(reminderTitle(1)).toBe('Godot Vocabulary · 1 card waiting');
    expect(reminderTitle(0)).toBe('Godot Vocabulary · cards are waiting');
    expect(reminderTitle(undefined)).toBe('Godot Vocabulary · cards are waiting');
  });

  it('keeps the plain sentence and is off the web', () => {
    expect(REMINDER_SENTENCE).toBe('Fires at about that time. Turn on Exact time if you want the minute.');
    expect(isNativeApp()).toBe(false);
  });
});

describe('reminder setting', () => {
  beforeEach(async () => {
    await deleteStore();
  });

  it('defaults to off at 20:00 and keeps what was saved', async () => {
    expect(await getReminder()).toEqual({ on: false, time: '20:00' });
    await saveReminder({ on: true, time: '07:30' });
    expect(await getReminder()).toEqual({ on: true, time: '07:30' });
  });
});
