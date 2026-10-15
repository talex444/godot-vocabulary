import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  backToStart,
  COURSE1,
  enterArea,
  exportFile,
  gotoStart,
  homeReady,
  importOnSettings,
  LESSON0_TITLE,
  onlyFamily,
  open,
  playSession,
  screenReady,
  startReady,
  startSession,
  tile,
} from './helpers';

// Courses (decisions 31–42, 69, done-criteria 47–53, 89): the list, lesson 0 end to end, Finish →
// what happened, course mode and the lesson's cards first, and exit tickets through export v4.

const lesson0 = COURSE1.lessons[0]!;
const TICKET = 'a tree of nodes, grouped into scenes, wired with signals.';

async function openLesson0(page: Page): Promise<void> {
  await page.locator('[data-lesson-id="c1-l0"] button').click();
  await screenReady(page, LESSON0_TITLE);
}

/** Taps the right (or a wrong) choice of a pretest question; the right one carries the card's id. */
async function pretest(page: Page, index: number, right: boolean): Promise<void> {
  const question = page.locator(`[data-question="pretest-${index}"]`);
  const id = await question.getAttribute('data-card-id');
  const rows = question.locator('.gv-choice');
  const ids = await rows.evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.cardId ?? ''));
  await rows.nth(right ? ids.indexOf(id!) : ids.findIndex((x) => x !== id)).click();
}

test('47: the course list shows course 1 with six written lessons in order; lesson 0 opens', async ({ page }) => {
  await gotoStart(page);
  await open(page, 'Courses');
  await expect(page.getByRole('heading', { name: 'Course 1: Step by step' })).toBeVisible();
  const rows = page.locator('.gv-lessons > li');
  await expect(rows).toHaveCount(6);
  for (const [i, lesson] of COURSE1.lessons.entries()) {
    await expect(rows.nth(i).getByRole('button')).toContainText(`Lesson ${i}: ${lesson.title}`);
  }
  await expect(page.locator('.gv-lesson-row--planned')).toHaveCount(0);
  // The course-end table shows on the list only once lesson 5 is done.
  await expect(page.locator('[data-reveal-table]')).toHaveCount(0);
  await expect(page.locator('[data-lesson-id="c1-l0"]')).toHaveAttribute('data-done', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await openLesson0(page);
  // The page follows the flow order of decision 37.
  const steps = await page.locator('[data-step]').evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.step));
  expect(steps).toEqual(['pretest', 'need', 'chunk-0', 'chunk-1', 'chunk-2', 'chunk-3', 'compare', 'exercises', 'errors', 'exit']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('48: a perfect pretest shows "Skip to the exercises", which only scrolls', async ({ page }) => {
  await gotoStart(page);
  await open(page, 'Courses');
  await openLesson0(page);
  const skip = page.getByRole('button', { name: 'Skip to the exercises' });
  for (const i of [0, 1, 2]) {
    await expect(skip).toBeHidden();
    await pretest(page, i, true);
  }
  await skip.click();
  await expect(page.getByRole('heading', { name: 'Exercises' })).toBeFocused();
  // The explanation stays on the page.
  await expect(page.locator('[data-step="chunk-0"]')).toHaveCount(1);
});

test('56: lesson 3, the first with code: a check, a typed blank in code, a code fix, Finish lesson', async ({ page }) => {
  await gotoStart(page);
  await open(page, 'Courses');
  await page.locator('[data-lesson-id="c1-l3"] button').click();
  await screenReady(page, COURSE1.lessons[3]!.title);

  // The first chunk shows its code block, then its check.
  await expect(page.locator('[data-step="chunk-0"] pre.gv-code')).toContainText('extends Sprite2D');
  const check = page.locator('[data-question="check-0"]');
  await check.locator('.gv-choice').first().click();
  await expect(check.locator('.gv-feedback__right')).toHaveText('Right.');

  // The typed blank sits inside a code line: C#'s capital first, then GDScript's snake_case.
  const blank = page.locator('[data-kind="blank"]');
  const gap = blank.locator('pre.gv-code').getByRole('textbox', { name: 'Missing word' });
  await gap.fill('Rotation');
  await gap.press('Enter');
  await expect(blank.locator('.gv-feedback')).toHaveText('Check the case. GDScript names are case-sensitive.');
  await gap.fill('rotation');
  await gap.press('Enter');
  await expect(blank.locator('.gv-feedback__right')).toHaveText('Second try, and you had it.');

  // The minimal fix is in code: the wrong line is the `_init(delta)` header.
  const fix = page.locator('[data-kind="fix"]');
  await expect(fix.locator('.gv-choice--code')).toHaveCount(4);
  await fix.locator('.gv-choice').nth(2).click();
  await expect(fix.locator('.gv-feedback__right')).toHaveText('Right.');
  await expect(fix.locator('.gv-feedback pre.gv-code')).toContainText('func _process(delta):');

  await page.getByRole('button', { name: /^Finish lesson: add \d+ cards?$/ }).click();
  await expect(page.locator('.gv-finish__status')).toHaveText(/^Lesson 3 done\. \d+ cards? added; /);
  await expect(page.getByRole('button', { name: 'Next: Lesson 4' })).toBeFocused();
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await screenReady(page, 'Courses');
  await expect(page.locator('[data-lesson-id="c1-l3"]')).toHaveAttribute('data-done', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('57: lesson 5 ends with the course table: every cell covered, a tap reveals one; the list keeps it once done', async ({ page }) => {
  await gotoStart(page);
  await open(page, 'Courses');
  await page.locator('[data-lesson-id="c1-l5"] button').click();
  await screenReady(page, COURSE1.lessons[5]!.title);

  // After the exit ticket, before Mark done.
  const exit = page.locator('[data-step="exit"]');
  const table = exit.locator('[data-reveal-table]');
  const order = await exit.evaluate((step) => {
    const all = [...step.querySelectorAll('textarea, [data-reveal-table], .gv-button--primary')];
    return all.map((n) => (n.matches('textarea') ? 'ticket' : n.matches('[data-reveal-table]') ? 'table' : 'done'));
  });
  expect(order).toEqual(['ticket', 'table', 'done']);
  const covers = table.locator('.gv-reveal__cover');
  await expect(covers).toHaveCount(9);
  await expect(table.locator('.gv-reveal__answer:visible')).toHaveCount(0);

  const cell = table.getByRole('button', { name: /has a position \(Node3D\)/ });
  await expect(cell).toHaveAttribute('aria-expanded', 'false');
  await cell.click();
  await expect(cell).toHaveAttribute('aria-expanded', 'true');
  await expect(table.locator('.gv-reveal__answer:visible')).toHaveCount(1);
  await expect(table.locator('.gv-reveal__answer:visible')).toContainText('relative to the parent');
  await expect(table.getByRole('status')).toHaveText('1 of 9 cells shown.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  // The last lesson: the line says the course is finished, and there is no next lesson to offer.
  await page.getByRole('button', { name: /^Finish lesson/ }).click();
  await expect(page.locator('.gv-finish__status')).toHaveText(/^Lesson 5 done\. .* Course 1 is finished\.$/);
  await expect(page.getByRole('button', { name: /^Next: Lesson/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Back to courses' })).toBeFocused();
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await screenReady(page, 'Courses');
  const listTable = page.locator('[data-reveal-table]');
  await expect(listTable).toHaveCount(1);
  await expect(listTable.locator('.gv-reveal__answer:visible')).toHaveCount(0);
  await listTable.locator('.gv-reveal__cover').first().click();
  await expect(listTable.locator('.gv-reveal__answer:visible')).toContainText('Any CanvasItem can draw.');
});

test('49–53, 89: lesson 0 end to end, Finish lesson and what it says, course mode, the next session, and export v4', async ({ page }) => {
  test.setTimeout(90_000);
  await gotoStart(page);
  await onlyFamily(page, 'godot-api', 3);
  await open(page, 'Courses');
  await openLesson0(page);

  // Pretest: right and wrong are shown, nothing is scheduled.
  await pretest(page, 0, false);
  await expect(page.locator('[data-question="pretest-0"] .gv-feedback__wrong')).toHaveText(/^Not quite\. It is /);
  await expect(page.locator('[data-question="pretest-0"] [data-state="revealed-right"]')).toHaveCount(1);
  await pretest(page, 1, true);
  await expect(page.locator('[data-question="pretest-1"] .gv-feedback__right')).toHaveText('Right.');
  await pretest(page, 2, true);
  await expect(page.getByRole('button', { name: 'Skip to the exercises' })).toBeHidden();

  // A chunk check: its verdict and why end the chunk; no Next, the page just scrolls on (decision 69b).
  const check = page.locator('[data-question="check-0"]');
  await check.locator('.gv-choice').nth(2).click();
  await expect(check.locator('.gv-feedback__right')).toHaveText('Right.');
  await expect(check.locator('.gv-feedback > :last-child')).not.toBeEmpty();
  await expect(page.locator('.gv-lesson').getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
  await page.getByRole('heading', { name: 'Nodes', exact: true }).scrollIntoViewIfNeeded();

  // The tree drawing, one node at a time.
  const tree = page.locator('.gv-tree__row:visible');
  await expect(tree).toHaveCount(1);
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Add the next node' }).click();
  await expect(tree).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'All nodes added' })).toBeDisabled();

  // Typed blank: a case-only miss gets the hint; the right word on the second try.
  const blank = page.locator('[data-kind="blank"]');
  const gap = blank.getByRole('textbox', { name: 'Missing word' });
  await gap.fill('characterbody2d');
  await gap.press('Enter');
  await expect(blank.locator('.gv-feedback')).toHaveText('Check the case. GDScript names are case-sensitive.');
  await gap.fill('CharacterBody2D');
  await blank.getByRole('button', { name: 'Check' }).click();
  await expect(blank.locator('.gv-feedback__right')).toHaveText('Second try, and you had it.');
  await expect(blank).toHaveAttribute('data-result', 'right');

  // Minimal fix: which line is wrong.
  const fix = page.locator('[data-kind="fix"]');
  await fix.locator('.gv-choice').nth(3).click();
  await expect(fix.locator('.gv-feedback__right')).toHaveText('Right.');
  await expect(fix.locator('.gv-feedback')).toContainText('Fixed:');

  // What you'll see when it's wrong: two or three errors, each with a fix and a source.
  await expect(page.locator('.gv-error-item')).toHaveCount(3);

  // Exit ticket, saved on the device.
  await page.getByLabel(lesson0.exitStem!).fill(TICKET);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('[data-step="exit"] .gv-result')).toHaveText('Saved on this device.');

  // The button says what it adds; the tap replaces it with what happened and two ways on (decision 69c, 69e).
  const finish = page.getByRole('button', { name: 'Finish lesson: add 9 cards' });
  await expect(page.getByRole('button', { name: 'Mark done' })).toHaveCount(0);
  await finish.click();
  await expect(finish).toHaveCount(0);
  const status = page.locator('[data-step="exit"] .gv-finish__status');
  await expect(status).toHaveText('Lesson 0 done. 9 cards added; your Godot sessions will bring them in before other new cards.');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  // No automatic navigation: still the lesson, with the next lesson focused and one Back to courses.
  await expect(page.locator('.gv-lesson')).toHaveAttribute('data-lesson-id', 'c1-l0');
  await expect(page.getByRole('button', { name: 'Next: Lesson 1' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Back to courses' })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await screenReady(page, 'Courses');
  await expect(page.locator('[data-lesson-id="c1-l0"]')).toHaveAttribute('data-done', 'true');
  await expect(page.locator('[data-lesson-id="c1-l0"] .gv-tick')).toHaveCount(1);

  // Done again: reopening shows the ticket at the top; finishing again changes nothing and says so.
  await openLesson0(page);
  await expect(page.getByRole('group', { name: 'Your exit ticket' })).toContainText(TICKET);
  await page.getByRole('button', { name: 'Finish lesson', exact: true }).click();
  await expect(status).toHaveText('Lesson 0 done again. Your cards are unchanged.');
  // Next: Lesson 1 opens lesson 1 in lesson 0's place, so Back still lands on the course list.
  await page.getByRole('button', { name: 'Next: Lesson 1' }).click();
  await screenReady(page, COURSE1.lessons[1]!.title);
  await expect(page.locator('.gv-lesson')).toHaveAttribute('data-lesson-id', 'c1-l1');
  await page.goBack();
  await screenReady(page, 'Courses');
  await backToStart(page);

  // The home tile names the next lesson now.
  await page.getByRole('button', { name: 'All areas', exact: true }).click();
  await homeReady(page);
  await expect(tile(page, 'Godot')).toHaveAccessibleName('Godot, Next: Lesson 1, 1 of 6 lessons, Last used');
  await enterArea(page, 'Godot');

  // Course mode switched itself on.
  await open(page, 'Settings');
  await expect(page.getByRole('switch', { name: 'Lesson cards first' })).toHaveAttribute('aria-checked', 'true');

  // Export v4 carries the finished lesson, the ticket, and course mode on the Godot area only.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()]);
  const text = await readFile((await download.path())!, 'utf8');
  const file = JSON.parse(text);
  expect(file.version).toBe(4);
  expect(file.settings.areas).toEqual({ godot: { newCardMode: 'course' }, github: { newCardMode: 'frequency' } });
  expect(file.lessonsDone.map((l: { lessonId: string }) => l.lessonId)).toEqual(['c1-l0']);
  expect(file.exitTickets).toEqual([{ lessonId: 'c1-l0', text: TICKET, date: expect.any(String) }]);
  await backToStart(page);

  // The next session's new cards are lesson 0's first cards (three a day here).
  await startSession(page);
  const showings = await playSession(page);
  const firsts = [...new Set(showings.map((s) => s.cardId))];
  expect(firsts.sort()).toEqual(lesson0.cardIds!.slice(0, 3).sort());
  await page.getByRole('button', { name: 'Done' }).click();
  await startReady(page);

  // A replace with an empty file wipes the ticket; importing the export brings it back.
  await open(page, 'Settings');
  await importOnSettings(page, exportFile());
  await backToStart(page);
  await open(page, 'Courses');
  await expect(page.locator('[data-lesson-id="c1-l0"]')).toHaveAttribute('data-done', 'false');
  await openLesson0(page);
  await expect(page.getByRole('group', { name: 'Your exit ticket' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await screenReady(page, 'Courses');
  await backToStart(page);
  await open(page, 'Settings');
  await importOnSettings(page, text);
  await backToStart(page);
  await open(page, 'Courses');
  await expect(page.locator('[data-lesson-id="c1-l0"]')).toHaveAttribute('data-done', 'true');
  await openLesson0(page);
  await expect(page.getByRole('group', { name: 'Your exit ticket' })).toContainText(TICKET);
});
