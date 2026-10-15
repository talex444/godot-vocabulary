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
  LESSON0,
  LESSON0_TITLE,
  LESSON1,
  onlyFamily,
  open,
  playSession,
  screenReady,
  startReady,
  startSession,
  tile,
} from './helpers';

// Courses (decisions 31–42, 69, 70, 71, done-criteria 47–53, 89, 93, 94): the list, Lesson 0 (the
// editor) and Lesson 1 (key concepts), both term lessons, end to end, Finish → what happened, course mode
// and the lesson's cards first, and exit tickets through export v4.

const TICKET = 'a tree of nodes, grouped into scenes, wired with signals.';

async function openLesson0(page: Page): Promise<void> {
  await page.locator(`[data-lesson-id="${LESSON0.id}"] button`).click();
  await screenReady(page, LESSON0_TITLE);
}

async function openLesson1(page: Page): Promise<void> {
  await page.locator(`[data-lesson-id="${LESSON1.id}"] button`).click();
  await screenReady(page, LESSON1.title);
}

/** Taps the right (or a wrong) choice of a pretest question; the right one carries the card's id. */
async function pretest(page: Page, index: number, right: boolean): Promise<void> {
  const question = page.locator(`[data-question="pretest-${index}"]`);
  const id = await question.getAttribute('data-card-id');
  const rows = question.locator('.gv-choice');
  const ids = await rows.evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.cardId ?? ''));
  await rows.nth(right ? ids.indexOf(id!) : ids.findIndex((x) => x !== id)).click();
}

test('47, 93: the course list shows course 1 with seven written lessons, the editor lesson first as Lesson 0; it opens as a term lesson', async ({ page }) => {
  await gotoStart(page);
  await open(page, 'Courses');
  await expect(page.getByRole('heading', { name: 'Course 1: Step by step' })).toBeVisible();
  const rows = page.locator('.gv-lessons > li');
  await expect(rows).toHaveCount(7);
  for (const [i, lesson] of COURSE1.lessons.entries()) {
    await expect(rows.nth(i).getByRole('button')).toContainText(`Lesson ${i}: ${lesson.title}`);
    await expect(rows.nth(i).getByRole('button')).toContainText(lesson.page.title);
  }
  // Decision 70: the editor lesson is Lesson 0, and the key-concepts lesson (still c1-l0) is Lesson 1.
  await expect(rows.nth(0)).toHaveAttribute('data-lesson-id', 'c1-editor');
  await expect(rows.nth(0).getByRole('button')).toContainText('First look at Godot');
  await expect(rows.nth(1)).toHaveAttribute('data-lesson-id', 'c1-l0');
  await expect(rows.nth(1).getByRole('button')).toContainText('Lesson 1: What is a Godot game made of when it runs?');
  await expect(page.locator('.gv-lesson-row--planned')).toHaveCount(0);
  // The course-end table shows on the list only once the last lesson is done.
  await expect(page.locator('[data-reveal-table]')).toHaveCount(0);
  await expect(page.locator('[data-lesson-id="c1-editor"]')).toHaveAttribute('data-done', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await openLesson0(page);
  await expect(page.locator('.gv-card__family')).toHaveText('Course 1 · Lesson 0');
  // The page follows the flow order of decision 37, with the term sections of decision 71 in the middle.
  const steps = await page.locator('[data-step]').evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.step));
  expect(steps).toEqual([
    'pretest', 'need', 'term-list',
    'term-0', 'term-1', 'term-2', 'term-3', 'recall-0',
    'term-4', 'term-5', 'term-6', 'term-7', 'recall-1',
    'term-8', 'recall-2',
    'compare', 'exercises', 'errors', 'exit',
  ]);
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
  await expect(page.locator('[data-step="term-0"]')).toHaveCount(1);
});

test('93: Lesson 0 lists its terms, gives each its six parts, and its checks and recalls mark right and wrong', async ({ page }) => {
  await gotoStart(page);
  await open(page, 'Courses');
  await openLesson0(page);

  // The pretest asks the three best-ranked editor cards.
  const asked = await page.locator('[data-question^="pretest-"]').evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.cardId));
  expect(asked).toEqual(['editor:dock:scene', 'editor:dock:inspector', 'editor:dock:filesystem']);

  // The term list: every term, a same-page link that focuses its heading and leaves history alone.
  const list = page.getByRole('navigation', { name: 'Terms in this lesson' });
  await expect(list.getByRole('link')).toHaveText([
    'viewport', 'toolbar', 'FileSystem dock', 'Scene dock', 'Inspector', 'bottom panel', '2D screen', 'Game screen', 'Script screen',
  ]);
  const before = await page.evaluate(() => history.length);
  await list.getByRole('link', { name: 'Inspector', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inspector', exact: true })).toBeFocused();
  expect(await page.evaluate(() => history.length)).toBe(before);

  // The first term: its name as the heading, then the six labelled parts, the manual's picture in Where it lives.
  const term0 = page.locator('[data-step="term-0"]');
  await expect(term0.getByRole('heading', { name: 'viewport', exact: true })).toBeVisible();
  await expect(term0.locator('dt')).toHaveText(['What it is', 'When you’d reach for it', 'Where it lives', 'Example', 'Not to be confused with', 'Check']);
  await expect(term0.locator('dd').first()).toContainText('“In the center, below the scene selector is the viewport');
  await expect(term0.locator('dd').first().getByRole('link')).toHaveAttribute('href', /first_look_at_the_editor\.html#first-look-at-godot-s-editor$/);
  const picture = term0.locator('dd').nth(2).locator('img');
  await expect(picture).toHaveAttribute('src', /courses\/img\/editor_intro_3d_viewport\.webp$/);
  await picture.scrollIntoViewIfNeeded();
  await expect.poll(() => picture.evaluate((n: HTMLImageElement) => n.complete && n.naturalWidth)).toBe(741);
  await expect(term0.locator('dd').nth(4)).toContainText('2D screen');

  // Its check is typed: a wrong name, then the right one in another case (a dock's name ignores case).
  const typed = page.locator('[data-question="term-0"]');
  const field = typed.getByRole('textbox', { name: 'Name' });
  await field.fill('scene view');
  await field.press('Enter');
  await expect(typed.locator('.gv-feedback')).toHaveText('Not that name. One more try.');
  await field.fill('Viewport');
  await typed.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(typed.locator('.gv-feedback__right')).toHaveText('Second try, and you had it.');
  await expect(typed).toHaveAttribute('data-result', 'right');

  // A picked check: four plain names, no class icons.
  const picked = page.locator('[data-question="term-1"]');
  await expect(picked.locator('.gv-choice')).toHaveCount(4);
  await expect(picked.locator('.gv-choice img')).toHaveCount(0);
  await picked.locator('.gv-choice', { hasText: 'toolbar' }).click();
  await expect(picked.locator('.gv-feedback__right')).toHaveText('Right.');

  // The first recall, after four terms: a wrong pick is marked and the right one revealed.
  const recall0 = page.locator('[data-question="recall-0"]');
  await expect(page.locator('[data-step="recall-0"]').getByRole('heading', { name: 'Recall' })).toBeVisible();
  await recall0.locator('.gv-choice', { hasText: 'Scene dock' }).click();
  await expect(recall0).toHaveAttribute('data-result', 'wrong');
  await expect(recall0.locator('.gv-feedback__wrong')).toHaveText('Not quite. The right answer is marked.');
  await expect(recall0.locator('[data-state="revealed-right"] .gv-choice__label')).toHaveText('FileSystem dock');

  // The second recall is typed and right at once.
  const recall1 = page.locator('[data-question="recall-1"]');
  await recall1.getByRole('textbox', { name: 'Name' }).fill('viewport');
  await recall1.getByRole('textbox', { name: 'Name' }).press('Enter');
  await expect(recall1.locator('.gv-feedback__right')).toHaveText('Right.');

  // The blank's answer is a dock's name: its case does not count, and the answer reads as a plain name.
  const blank = page.locator('[data-kind="blank"]');
  await blank.getByRole('textbox', { name: 'Missing word' }).fill('inspector');
  await blank.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(blank.locator('.gv-feedback__right')).toHaveText('Right.');

  // No code anywhere in Lesson 0 (decision 38 holds for it).
  await expect(page.locator('.gv-lesson pre.gv-code')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('93: finishing Lesson 0 adds the nine editor cards; the home tile then names Lesson 1; the next session brings them first', async ({ page }) => {
  await gotoStart(page);
  await onlyFamily(page, 'godot-editor', 3);
  await open(page, 'Courses');
  await openLesson0(page);
  const finish = page.getByRole('button', { name: 'Finish lesson: add 9 cards' });
  await finish.click();
  const status = page.locator('[data-step="exit"] .gv-finish__status');
  await expect(status).toHaveText('Lesson 0 done. 9 cards added; your Godot sessions will bring them in before other new cards.');
  await expect(page.getByRole('button', { name: 'Next: Lesson 1' })).toBeFocused();
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await screenReady(page, 'Courses');
  await expect(page.locator('[data-lesson-id="c1-editor"]')).toHaveAttribute('data-done', 'true');
  await backToStart(page);
  await page.getByRole('button', { name: 'All areas', exact: true }).click();
  await homeReady(page);
  await expect(tile(page, 'Godot')).toHaveAccessibleName('Godot, Next: Lesson 1, 1 of 7 lessons, Last used');
  await enterArea(page, 'Godot');
  // Course mode: the lesson's first cards, in its order, are the session's new cards (three a day here).
  await startSession(page);
  await expect(page.locator('.gv-card__family')).toHaveText('Godot editor');
  const showings = await playSession(page);
  expect([...new Set(showings.map((s) => s.cardId))].sort()).toEqual(LESSON0.cardIds!.slice(0, 3).sort());
});

test('94: Lesson 1 lists its nine terms in order, builds the Player node by node, and its checks and recalls mark right and wrong', async ({ page }) => {
  await gotoStart(page);
  await open(page, 'Courses');
  await openLesson1(page);
  await expect(page.locator('.gv-card__family')).toHaveText('Course 1 · Lesson 1');

  // The term list and nine sections in the page's order of ideas, a recall after terms 4, 8 and 9.
  const names = ['Node', 'SceneTree', 'PackedScene', 'Signal', 'CharacterBody2D', 'Sprite2D', 'CollisionShape2D', 'Camera2D', 'Node3D'];
  const list = page.getByRole('navigation', { name: 'Terms in this lesson' });
  await expect(list.getByRole('link')).toHaveText(names);
  const steps = await page.locator('[data-step]').evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.step));
  expect(steps).toEqual([
    'pretest', 'need', 'term-list',
    'term-0', 'term-1', 'term-2', 'term-3', 'recall-0',
    'term-4', 'term-5', 'term-6', 'term-7', 'recall-1',
    'term-8', 'recall-2',
    'compare', 'exercises', 'errors', 'exit',
  ]);
  for (const [i, name] of names.entries()) {
    const term = page.locator(`[data-step="term-${i}"]`);
    await expect(term.getByRole('heading', { level: 3 }).first(), name).toHaveText(name);
    // What it is cites the class reference page.
    await expect(term.locator('dd').first().getByRole('link'), name).toHaveAttribute('href', `https://docs.godotengine.org/en/4.7/classes/class_${name.toLowerCase()}.html`);
  }

  // CharacterBody2D: the root alone, one node, nothing to add; its check marks a wrong pick and reveals the right one.
  const body = page.locator('[data-step="term-4"]');
  await expect(body.locator('.gv-tree__row')).toHaveCount(1);
  await expect(body.locator('.gv-tree__row')).toContainText('Player');
  await expect(body.getByRole('button', { name: 'Add the next node' })).toHaveCount(0);
  const bodyCheck = page.locator('[data-question="term-4"]');
  await expect(bodyCheck.locator('.gv-choice')).toHaveCount(4);
  await bodyCheck.locator('.gv-choice', { hasText: 'Area2D' }).click();
  await expect(bodyCheck).toHaveAttribute('data-result', 'wrong');
  await expect(bodyCheck.locator('.gv-feedback__wrong')).toHaveText('Not quite. The right answer is marked.');
  await expect(bodyCheck.locator('[data-state="revealed-right"] .gv-choice__label')).toHaveText('CharacterBody2D');

  // Camera2D: the full key-concepts tree, the camera first under Player, built one tap at a time.
  const camera = page.locator('[data-step="term-7"]');
  const rows = camera.locator('.gv-tree__row:visible');
  await expect(rows).toHaveCount(1);
  for (let i = 0; i < 3; i++) await camera.getByRole('button', { name: 'Add the next node' }).click();
  await expect(rows).toHaveText(['PlayerCharacterBody2D', 'Camera2D', 'Sprite2D', 'CollisionShape2D']);
  await expect(camera.getByRole('button', { name: 'All nodes added' })).toBeDisabled();

  // A typed recall: a class name is case-sensitive, so the case-only miss gets the hint, then it is right.
  const recall1 = page.locator('[data-question="recall-1"]');
  await expect(page.locator('[data-step="recall-1"]').getByRole('heading', { name: 'Recall' })).toBeVisible();
  const field = recall1.getByRole('textbox', { name: 'Name' });
  await field.fill('signal');
  await field.press('Enter');
  await expect(recall1.locator('.gv-feedback')).toHaveText('Check the case. Godot’s class names are case-sensitive.');
  await field.fill('Signal');
  await field.press('Enter');
  await expect(recall1.locator('.gv-feedback__right')).toHaveText('Second try, and you had it.');

  // No code anywhere in Lesson 1 (decision 38 holds for it).
  await expect(page.locator('.gv-lesson pre.gv-code')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('56: lesson 4, the first with code: a check, a typed blank in code, a code fix, Finish lesson', async ({ page }) => {
  await gotoStart(page);
  await open(page, 'Courses');
  await page.locator('[data-lesson-id="c1-l3"] button').click();
  await screenReady(page, COURSE1.lessons[4]!.title);

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
  await expect(page.locator('.gv-finish__status')).toHaveText(/^Lesson 4 done\. \d+ cards? added; /);
  await expect(page.getByRole('button', { name: 'Next: Lesson 5' })).toBeFocused();
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await screenReady(page, 'Courses');
  await expect(page.locator('[data-lesson-id="c1-l3"]')).toHaveAttribute('data-done', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('57: lesson 6 ends with the course table: every cell covered, a tap reveals one; the list keeps it once done', async ({ page }) => {
  await gotoStart(page);
  await open(page, 'Courses');
  await page.locator('[data-lesson-id="c1-l5"] button').click();
  await screenReady(page, COURSE1.lessons[6]!.title);

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
  await expect(page.locator('.gv-finish__status')).toHaveText(/^Lesson 6 done\. .* Course 1 is finished\.$/);
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

test('49–53, 89, 94: lesson 1 end to end, Finish lesson and what it says, course mode, the next session, and export v4', async ({ page }) => {
  test.setTimeout(90_000);
  await gotoStart(page);
  await onlyFamily(page, 'godot-api', 3);
  await open(page, 'Courses');
  await openLesson1(page);

  // Pretest: right and wrong are shown, nothing is scheduled.
  await pretest(page, 0, false);
  await expect(page.locator('[data-question="pretest-0"] .gv-feedback__wrong')).toHaveText(/^Not quite\. It is /);
  await expect(page.locator('[data-question="pretest-0"] [data-state="revealed-right"]')).toHaveCount(1);
  await pretest(page, 1, true);
  await expect(page.locator('[data-question="pretest-1"] .gv-feedback__right')).toHaveText('Right.');
  await pretest(page, 2, true);
  await expect(page.getByRole('button', { name: 'Skip to the exercises' })).toBeHidden();

  // A term's check, picked right: its verdict and why end the section; no Next, the page just scrolls on (decision 69b).
  const check = page.locator('[data-question="term-4"]');
  await check.locator('.gv-choice', { hasText: 'CharacterBody2D' }).click();
  await expect(check.locator('.gv-feedback__right')).toHaveText('Right.');
  await expect(check.locator('.gv-feedback > :last-child')).not.toBeEmpty();
  await expect(page.locator('.gv-lesson').getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);

  // The Sprite2D section's drawing: Player, then the sprite added under it.
  const sprite = page.locator('[data-step="term-5"]');
  await sprite.getByRole('heading', { name: 'Sprite2D', exact: true }).scrollIntoViewIfNeeded();
  const tree = sprite.locator('.gv-tree__row:visible');
  await expect(tree).toHaveCount(1);
  await sprite.getByRole('button', { name: 'Add the next node' }).click();
  await expect(tree).toHaveCount(2);
  await expect(sprite.getByRole('status')).toHaveText('Added Sprite2D under Player. All 2 nodes are in the tree.');
  await expect(sprite.getByRole('button', { name: 'All nodes added' })).toBeDisabled();

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
  await page.getByLabel(LESSON1.exitStem!).fill(TICKET);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('[data-step="exit"] .gv-result')).toHaveText('Saved on this device.');

  // The button says what it adds; the tap replaces it with what happened and two ways on (decision 69c, 69e).
  const finish = page.getByRole('button', { name: 'Finish lesson: add 9 cards' });
  await expect(page.getByRole('button', { name: 'Mark done' })).toHaveCount(0);
  await finish.click();
  await expect(finish).toHaveCount(0);
  const status = page.locator('[data-step="exit"] .gv-finish__status');
  await expect(status).toHaveText('Lesson 1 done. 9 cards added; your Godot sessions will bring them in before other new cards.');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  // No automatic navigation: still the lesson, with the next lesson focused and one Back to courses.
  await expect(page.locator('.gv-lesson')).toHaveAttribute('data-lesson-id', 'c1-l0');
  await expect(page.getByRole('button', { name: 'Next: Lesson 2' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Back to courses' })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await screenReady(page, 'Courses');
  await expect(page.locator('[data-lesson-id="c1-l0"]')).toHaveAttribute('data-done', 'true');
  await expect(page.locator('[data-lesson-id="c1-l0"] .gv-tick')).toHaveCount(1);

  // Done again: reopening shows the ticket at the top; finishing again changes nothing and says so.
  await openLesson1(page);
  await expect(page.getByRole('group', { name: 'Your exit ticket' })).toContainText(TICKET);
  await page.getByRole('button', { name: 'Finish lesson', exact: true }).click();
  await expect(status).toHaveText('Lesson 1 done again. Your cards are unchanged.');
  // Next: Lesson 2 opens lesson 2 in lesson 1's place, so Back still lands on the course list.
  await page.getByRole('button', { name: 'Next: Lesson 2' }).click();
  await screenReady(page, COURSE1.lessons[2]!.title);
  await expect(page.locator('.gv-lesson')).toHaveAttribute('data-lesson-id', 'c1-l1');
  await page.goBack();
  await screenReady(page, 'Courses');
  await backToStart(page);

  // The home tile names the first lesson not done: Lesson 0, the editor, which this test left alone.
  await page.getByRole('button', { name: 'All areas', exact: true }).click();
  await homeReady(page);
  await expect(tile(page, 'Godot')).toHaveAccessibleName('Godot, Next: Lesson 0, 1 of 7 lessons, Last used');
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

  // The next session's new cards are lesson 1's first cards (three a day here).
  await startSession(page);
  const showings = await playSession(page);
  const firsts = [...new Set(showings.map((s) => s.cardId))];
  expect(firsts.sort()).toEqual(LESSON1.cardIds!.slice(0, 3).sort());
  await page.getByRole('button', { name: 'Done' }).click();
  await startReady(page);

  // A replace with an empty file wipes the ticket; importing the export brings it back.
  await open(page, 'Settings');
  await importOnSettings(page, exportFile());
  await backToStart(page);
  await open(page, 'Courses');
  await expect(page.locator('[data-lesson-id="c1-l0"]')).toHaveAttribute('data-done', 'false');
  await openLesson1(page);
  await expect(page.getByRole('group', { name: 'Your exit ticket' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to courses' }).click();
  await screenReady(page, 'Courses');
  await backToStart(page);
  await open(page, 'Settings');
  await importOnSettings(page, text);
  await backToStart(page);
  await open(page, 'Courses');
  await expect(page.locator('[data-lesson-id="c1-l0"]')).toHaveAttribute('data-done', 'true');
  await openLesson1(page);
  await expect(page.getByRole('group', { name: 'Your exit ticket' })).toContainText(TICKET);
});
