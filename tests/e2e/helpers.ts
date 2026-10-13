import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

/** Shared navigation for the phone specs; the same paths `scripts/screenshot.mjs` takes. */

export type Family = 'godot-api' | 'gdscript' | 'github';
export const FAMILY_LABEL: Record<Family, string> = { 'godot-api': 'Godot API', gdscript: 'GDScript', github: 'GitHub' };

export interface DeckCard {
  id: string;
  family: Family;
  kind: string;
  prompt: string;
  answer: string;
  rank: number;
}

/** The real generated decks, so crafted files use ids the app knows. */
export function deck(family: Family): DeckCard[] {
  return JSON.parse(readFileSync(`src/data/cards.${family}.json`, 'utf8')) as DeckCard[];
}

export async function gotoStart(page: Page): Promise<void> {
  await page.goto('./');
  await startReady(page);
}

export async function startReady(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Today', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
}

export async function screenReady(page: Page, heading: string): Promise<void> {
  await page.getByRole('heading', { name: heading, exact: true }).first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

/** From Start, one of the three flat links. */
export async function open(page: Page, name: 'Settings' | 'Add card' | 'About'): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click();
  await screenReady(page, name);
}

export async function backToStart(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Back', exact: true }).last().click();
  await startReady(page);
}

export async function startSession(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.locator('.gv-choice:not([disabled])').first().waitFor();
}

export const nextButton = (page: Page) => page.getByRole('button', { name: /^(Next|See summary)$/ });

/** Taps choice `index` (0–3) on the current card and waits for Next. */
export async function answer(page: Page, index = 0): Promise<void> {
  await page.locator('.gv-choice').nth(index).click();
  await nextButton(page).waitFor();
}

export async function goNext(page: Page): Promise<void> {
  await nextButton(page).click();
  await page.locator('.gv-choice:not([disabled])').first().waitFor();
}

export async function endSession(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'End session' }).click();
  await screenReady(page, 'Session done');
}

/** Due / New today / Overdue for one family on the Start screen. */
export async function familyStats(page: Page, family: Family): Promise<Record<string, number>> {
  const block = page.locator('.gv-family').filter({ has: page.getByRole('heading', { name: FAMILY_LABEL[family], exact: true }) });
  return statValues(block.locator('.gv-stat'));
}

/** Label → number for every `stat` in a locator. */
export async function statValues(stats: ReturnType<Page['locator']>): Promise<Record<string, number>> {
  const pairs = await stats.evaluateAll((nodes) =>
    nodes.map((n) => [n.querySelector('dt')?.textContent ?? '', n.querySelector('dd')?.textContent ?? ''] as const),
  );
  return Object.fromEntries(pairs.map(([k, v]) => [k, Number.parseInt(v.replace(/\D+/g, ''), 10)]));
}

export interface FamilySetting {
  enabled: boolean;
  newPerDay: number;
}

export function settings(perFamily: Partial<Record<Family, FamilySetting>> = {}) {
  return {
    families: {
      'godot-api': { enabled: true, newPerDay: 10 },
      gdscript: { enabled: true, newPerDay: 5 },
      github: { enabled: true, newPerDay: 5 },
      ...perFamily,
    },
    retention: 0.9,
  };
}

const DAY = 24 * 60 * 60 * 1000;

/** A Review-state progress record due yesterday, i.e. overdue (before local midnight today). */
export function overdueProgress(card: DeckCard, now = Date.now()) {
  return {
    cardId: card.id,
    family: card.family,
    due: new Date(now - DAY).toISOString(),
    stability: 3,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 3,
    learning_steps: 0,
    reps: 2,
    lapses: 0,
    state: 2,
    last_review: new Date(now - 4 * DAY).toISOString(),
    seenAt: new Date(now - 6 * DAY).toISOString(),
  };
}

/** An export file in the version 1 shape `exportAll` writes. */
export function exportFile(parts: { progress?: unknown[]; settings?: unknown; customCards?: unknown[] } = {}) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: parts.progress ?? [],
    settings: parts.settings ?? settings(),
    customCards: parts.customCards ?? [],
  };
}

/** From Start: Settings → Import → the given mode → back to Start. */
export async function importFromStart(page: Page, file: object | string, mode: 'merge' | 'replace' = 'replace'): Promise<void> {
  await open(page, 'Settings');
  await importOnSettings(page, file, mode);
  await backToStart(page);
}

export async function importOnSettings(page: Page, file: object | string, mode: 'merge' | 'replace' = 'replace'): Promise<void> {
  const text = typeof file === 'string' ? file : JSON.stringify(file);
  await page.locator('input[type="file"]').setInputFiles({ name: 'godot-vocabulary-test.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  const label = mode === 'replace' ? 'Replace everything on this device' : 'Merge with this device';
  await page.getByRole('button', { name: label }).click();
  await expect(page.locator('.gv-result')).toHaveText(/^Restored /);
}

export type ScreenName = 'start' | 'card' | 'card-answered' | 'summary' | 'settings' | 'settings-warning' | 'add-card' | 'about';

/**
 * Every screen once, in one pass: Start, a card before and after answering, the summary, Settings
 * (and with the above-twenty warning), Add card, About. `visit` runs on each. Settings are put back.
 */
export async function walkScreens(page: Page, visit: (name: ScreenName) => Promise<void>, afterLoad?: () => Promise<void>): Promise<void> {
  await gotoStart(page);
  if (afterLoad) await afterLoad();
  await visit('start');
  await startSession(page);
  await visit('card');
  await answer(page, 0);
  await visit('card-answered');
  await endSession(page);
  await visit('summary');
  await page.getByRole('button', { name: 'Done' }).click();
  await startReady(page);

  await open(page, 'Settings');
  await visit('settings');
  await page.getByRole('button', { name: 'More: New cards per day' }).first().click();
  await page.locator('.gv-warning:not(:empty)').waitFor();
  await visit('settings-warning');
  await page.getByRole('button', { name: 'Fewer: New cards per day' }).first().click();
  await backToStart(page);

  await open(page, 'Add card');
  await visit('add-card');
  await backToStart(page);

  await open(page, 'About');
  await visit('about');
  await backToStart(page);
}
