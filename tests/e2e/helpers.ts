import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

/** Shared navigation for the phone specs; the same paths `scripts/screenshot.mjs` takes. */

export type Family = 'godot-editor' | 'godot-api' | 'gdscript' | 'github';
export const FAMILY_LABEL: Record<Family, string> = { 'godot-editor': 'Godot editor', 'godot-api': 'Godot API', gdscript: 'GDScript', github: 'GitHub' };

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

/** The areas' start-screen titles. */
export type AreaLabel = 'Godot' | 'Git & GitHub';

/** Opens the app on the home page (it always opens there). */
export async function gotoHome(page: Page): Promise<void> {
  await page.goto('./');
  await homeReady(page);
}

export async function homeReady(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Areas', exact: true }).waitFor();
  await page.locator('.gv-tile').first().waitFor();
  await settled(page);
}

/**
 * A theme switch has finished: the wipe's overlay is gone (it takes the taps while it runs). The app
 * keeps `data-switching` on the root until the transition's `finished` promise resolves.
 */
export async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => !('switching' in document.documentElement.dataset));
}

/** An area's tile on the home page: its accessible name starts with the label. */
export const tile = (page: Page, label: AreaLabel) =>
  page.getByRole('button', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},`) });

/** From the home page, taps an area's tile and waits for the area page (every tile opens it, decision 69a). */
export async function enterArea(page: Page, label: AreaLabel): Promise<void> {
  await tile(page, label).click();
  await startReady(page, label);
}

/** Opens the app and enters the Godot area. */
export async function gotoStart(page: Page): Promise<void> {
  await gotoHome(page);
  await enterArea(page, 'Godot');
}

/** Waits for an area's start screen: the one titled `area`, or any area's when omitted. */
export async function startReady(page: Page, area?: AreaLabel): Promise<void> {
  await page.getByRole('heading', { name: area ?? /^(Godot|Git & GitHub)$/, exact: area !== undefined }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
}

export async function screenReady(page: Page, heading: string): Promise<void> {
  await page.getByRole('heading', { name: heading, exact: true }).first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await settled(page);
}

/** Course 1, read from the course file. */
export const COURSE1 = JSON.parse(readFileSync('src/data/courses/course-1.json', 'utf8')) as {
  lessons: { id: string; order: number; title: string; page: { title: string }; cardIds?: string[]; exitStem?: string }[];
};
/** Lesson 0, whatever sits first in the course: since GV-8n the editor lesson, a term lesson (decision 70). */
export const LESSON0 = COURSE1.lessons[0]!;
export const LESSON0_TITLE = LESSON0.title;
/** Lesson 1, the key concepts (`c1-l0`, lesson 0 before the shift), still a chunk lesson. */
export const LESSON1 = COURSE1.lessons[1]!;

/** From Start, one of the flat links. */
export async function open(page: Page, name: 'Courses' | 'Settings' | 'Add card' | 'About'): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click();
  await screenReady(page, name);
}

/** From an area page: All areas, then into another area. */
export async function openArea(page: Page, label: AreaLabel): Promise<void> {
  await page.getByRole('button', { name: 'All areas', exact: true }).click();
  await homeReady(page);
  await enterArea(page, label);
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

/** One showing of a card, read from the card panel's data attributes and the choice rows. */
export interface Showing {
  cardId: string;
  showing: number;
  direction: 'forward' | 'flipped';
  choices: string[];
  correct: boolean;
}

export const cardPanel = (page: Page) => page.locator('.gv-card');

/** Reads the current card, answers it (right unless `wrong` says otherwise) and waits for Next. */
export async function answerShowing(page: Page, wrong = false): Promise<Showing> {
  const panel = cardPanel(page);
  const cardId = (await panel.getAttribute('data-card-id'))!;
  const showing = Number(await panel.getAttribute('data-showing'));
  const direction = (await panel.getAttribute('data-direction')) as Showing['direction'];
  const rows = page.locator('.gv-choice');
  const choices = await rows.locator('.gv-choice__label').allTextContents();
  // The right choice is the one that names (or describes) the card itself.
  const ids = await rows.evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.cardId ?? ''));
  const index = wrong ? ids.findIndex((id) => id !== cardId) : ids.indexOf(cardId);
  await rows.nth(index).click();
  await nextButton(page).waitFor();
  const state = await rows.nth(index).getAttribute('data-state');
  return { cardId, showing, direction, choices, correct: state === 'chosen-right' };
}

/**
 * Plays a whole session from the first card to the summary. `wrong(i, showing)` picks the answers
 * to get wrong; every other answer is right. Returns the showings in order.
 */
export async function playSession(page: Page, wrong: (index: number, showing: number) => boolean = () => false): Promise<Showing[]> {
  const out: Showing[] = [];
  for (let i = 0; i < 200; i++) {
    const showing = Number(await cardPanel(page).getAttribute('data-showing'));
    out.push(await answerShowing(page, wrong(i, showing)));
    const next = nextButton(page);
    if ((await next.textContent()) === 'See summary') {
      await next.click();
      await screenReady(page, 'Session done');
      return out;
    }
    await goNext(page);
  }
  throw new Error('The session did not end.');
}

/** Only `godot-api` (or the given family) with `n` new cards today, set through the app's own Import. */
export async function onlyFamily(page: Page, family: Family, n: number): Promise<void> {
  const off = { enabled: true, newPerDay: 0 };
  const perFamily = { 'godot-editor': off, 'godot-api': off, gdscript: off, github: off, [family]: { enabled: true, newPerDay: n } };
  await importFromStart(page, exportFile({ settings: settings(perFamily) }));
}

/** Ready / New today / From before today for one family on the area page. */
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
      'godot-editor': { enabled: true, newPerDay: 5 },
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

export type ScreenName =
  | 'start'
  | 'card'
  | 'card-answered'
  | 'summary'
  | 'settings'
  | 'settings-warning'
  | 'add-card'
  | 'about'
  | 'courses'
  | 'lesson';

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

  await open(page, 'Courses');
  await visit('courses');
  await page.locator(`[data-lesson-id="${LESSON0.id}"] button`).click();
  await screenReady(page, LESSON0_TITLE);
  await visit('lesson');
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await screenReady(page, 'Courses');
  await backToStart(page);
}
