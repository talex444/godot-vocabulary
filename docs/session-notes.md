# Session notes

## GV-1 — scaffold, generators, deck tests, theme derivation (2026-10-13)

### Built
- **Scaffold**: Vite 8 + TypeScript (strict, `noUncheckedIndexedAccess`), `ts-fsrs`, `idb`; dev: `vite-plugin-pwa`, `vitest`, `@playwright/test`, `typescript`, plus generator-only tools `fast-xml-parser`, `yaml`, `sharp`, `@types/node`. Scripts exactly as `CLAUDE.md` lists (`e2e` = build + `playwright test --pass-with-no-tests`; `playwright.config.ts` serves `pnpm preview` at a 360×780 touch viewport, specs go in `tests/e2e/`). `vite.config.ts`: base `/godot-vocabulary/`, manifest "Godot Vocabulary" / "GodotVocab", standalone, theme and background colour read from the theme JSON, icons 192/512 (+ 512 maskable). `index.html` is a bare shell; `src/main.ts` only applies the theme.
- **App icon**: `scripts/generate-icons.mjs` draws a rounded card with an accent check (colours from the theme JSON) and renders `public/app-icon.svg`, `-192.png`, `-512.png` with sharp. Not the Godot logo.
- **Card types**: `src/cards/types.ts` (`Family`, `Card`, stable ids as specified).
- **BBCode**: `scripts/lib/bbcode.mjs` (`bbcodeToText`, `dedent`, `firstSentences`, `RAW_TAG_PATTERN`). Also handles `[Class]` references, `[codeblocks]` (keeps the GDScript sample), `[kbd]`, `[lb]`/`[rb]`.
- **API cards** `scripts/generate-api-cards.mjs` → `src/data/cards.godot-api.json`: **431 class cards** (26 tutorial classes pinned at ranks 0–25, starting Area2D, CharacterBody2D, AnimatedSprite2D…), **455 member cards**. 336 class icons copied to `public/icons/` (every class that can appear as a choice), fonts + OFL files to `public/fonts/`.
- **GitHub cards** `scripts/generate-github-cards.mjs` + `scripts/github-terms-allowlist.json` → `src/data/cards.github.json`: **96 term cards**, all allow-listed terms exist in the glossary, none skipped.
- **`pnpm generate`** (`scripts/generate.mjs`) runs both, writes `src/data/cards.gdscript.json` (`[]` until `data/cards/gdscript.json` exists), renders the icons. Ran twice: no diff the second time, PNGs included (done-criteria 13).
- **`pnpm fetch-sources`** (`scripts/fetch-sources.mjs`): sparse clones Godot `4.7-stable` (doc/classes, editor/icons, thirdparty/fonts, editor/themes, editor/settings, LICENSE, COPYRIGHT), raw godot-docs pages on branch 4.7, the GitHub glossary + LICENSE, and the demo projects (blob-less sparse clone of `.gd`/`.tscn`/`project.godot`), then recounts `data/class-frequency.json`. `--count` and `--check` run the count only.
- **Theme**: `src/theme/derive.ts` implements `ThemeModern::populate_shared_styles` (theme_modern.cpp lines 62–130) for the dark theme: dark_color_1/2/3 (incl. the HSV `_get_base_color`), contrast_color_1/2, highlight and highlight_disabled, selection, all font colours; `applyTheme()` writes them plus every script-editor colour (`--code-…`) and `--corner-radius` as CSS custom properties.
- **Tests** (vitest, 22 passing): `bbcode.test.ts` (done-criteria 15), `deck.test.ts` (18, 14, 17: four distinct choices, answer not a distractor, no raw BBCode or `{%`, `requires` resolves and ranks earlier, icons exist, ids unique, ranks numeric, every used class with a brief has a card, member coverage, tutorial ranks), `theme.test.ts` (23, derivation half: dark_color_1, contrast_color_2 and dark_color_3 against hand-computed numbers in the test, plus every `derived` value in the JSON within one 8-bit step).
- **Records**: `THIRD_PARTY_NOTICES.md`, `LICENSE` (MIT, Tyler Alex).
- **Gates**: `pnpm typecheck`, `pnpm test`, `pnpm build` green; `dist/` has `manifest.webmanifest`, `sw.js` (690 precache entries), assets under `/godot-vocabulary/`. `pnpm e2e` was not run (no specs yet).

### Deviations and why
1. **Member ranks**: spec said class rank + 0.1 × (index + 1). Node has 29 member cards and Control 28, so that would push members past later classes. Used class rank + (index + 1) / (count + 1), rounded to 4 decimals: members always sit between their class and the next class. Members of one class are interleaved method/property/signal.
2. **"Top 40 classes"** = the first 40 classes by rank that have something to ask. float, int, bool (no members at all) and VBoxContainer, HBoxContainer, StandardMaterial3D (only inherited members) are skipped; the test pins exactly that list.
3. **Member card count** is 455, under the 500–900 target, because of the caps (10 methods, 8 properties) and because builtin classes such as Vector2 have only two properties (x, y) and no inherited fallback for distractors, so those cards are skipped. Raising the caps or the class count would reach the target; not done without a decision.
4. **Prompts hide the answer**: class names are masked as `____` in class prompts; member names are masked where they appear as code (`` `wait_time` ``, `` `_ready()` ``) in member prompts; GitHub terms (and their plurals) are masked in term prompts. The explanation shows them unmasked.
5. **Liquid**: added `variables.product.github` → GitHub (used by "SSH key"); with it, nothing is skipped.
6. **Theme source**: the vendored `editor_theme_manager.cpp` does not contain the dark/contrast/font lerps; the Chief of Staff added `theme_modern.cpp` and rewrote `data/theme/godot-4.7-defaults.json` (Modern style, `inputs`, `formulas`, `derived`) mid-session. `derive.ts` follows that file and reads the engine's float inputs (`base_color_rgb` 0.14), not the rounded hex (0.1412), because the difference changes dark_color_1 by one step. That JSON change is committed together with the theme code since `derive.ts` depends on it.
7. **One recorded value is off by one**: `derived.highlight_disabled_color` red is 44 in the JSON; the engine computes 0.34 × 0.5 × 255 = 43.35 → 43. The JSON was left untouched; the cross-check allows ±1 per channel. Chief of Staff: worth correcting in the JSON.
8. **Frequency count not verified**: `data/sources/` has no demo-project clone, and the network part was not to be run, so `node scripts/fetch-sources.mjs --check` stops with "No demo projects". The counting rules (identifier tokens in `.gd` + `.tscn`, projects = folders with `project.godot`, sorted projects ↓, files ↓, mentions ↓, name ↑; keywords from `.gd` only) are inferred from the committed file's shape and are **unconfirmed** against it. Run `pnpm fetch-sources` then `node scripts/fetch-sources.mjs --check` once with network to confirm or adjust. The font licence file names in the Godot repo are also guessed by pattern.
9. **Commits**: the scaffold and theme went in one commit (main.ts applies the theme), the generators, data and their tests in a second. The uncommitted Chief-of-Staff edits to `CLAUDE.md`, `docs/decisions.md`, `docs/done-criteria.md` and `docs/ui-reference/` were left alone.

### Left for later sessions (by done-criteria number)
- **Session 2**: 4–12 (screens, session flow, FSRS adapter, scheduler unit tests), 16 (`data/cards/gdscript.json`, ≥100 cards; `pnpm generate` then copies it), 19–22 (settings, add-card, export/import, About with the attribution lines in `THIRD_PARTY_NOTICES.md`), 23 (stylesheet uses only the `--…` properties from `applyTheme`; add the grep/lint), 24 (`@font-face` for the bundled fonts), 28 (contrast unit test over the derived pairs; `derive.ts` exposes everything needed).
- **Session 3**: 2, 3, 11 (e2e), 21 (e2e), 25, 27, 29–31 (Playwright + axe specs in `tests/e2e/`), 26 (`pnpm e2e` green, README).
- **Already here**: 1 (manifest, service worker, sub-path), 13, 14, 15, 17, 18, 23 (derivation half), 24 (fonts and OFL files bundled).

## GV-2a — language cards, FSRS adapter, store, session builder (2026-10-13)

### Built
- **Language cards** `data/cards/gdscript.json`, hand-written, **120 cards**: keyword 36, concept 27, builtin 23, operator 14, annotation 10, lifecycle 10. 71 are snippet cards (a `code` field of 3–6 lines with one `____`) and 49 are plain-English descriptions. Ids `gd:<kind>:<name>`. Symbol answers use word slugs (`gd:operator:plus-assign`, `gd:concept:dollar-node-path`, `gd:concept:unique-name`). `pnpm generate` copies the file to `src/data/cards.gdscript.json`; `git diff --stat` after generating showed only that file changing.
- **Rank order**: 0–39 follow the `keywords` rows of `data/class-frequency.json` (extends, func, void, var, if, is, and, for, in, else, not, true, false, as, return, const, or, when, elif, match, preload, null, signal, while, class_name, enum, pass, await, self, TAU, assert, break, class, continue, PI, static, super, INF). `_ready()` (5) and `@onready` (13) are slotted in where the session brief listed them, because they have no row in the frequency file. Then 40–51 follow the getting-started pages (nodes and scenes, instancing, first script, player input, signals), 52–82 follow the basics page, and 83–119 cover lifecycle callbacks, built-in functions and scene-tree methods from the class reference.
- **Tests** `tests/unit/gdscript.test.ts`: at least 100 cards and all six kinds, id/family/source shape, ranks 0..n-1 with the frequency rows first, **the answer never appears in the prompt or the code** (whole word, ignoring case, for word answers; plain substring for symbols, with `____` removed first), snippets have 3–6 lines and exactly one blank, the snippet share is between 35% and 65%, and every explanation has one or two sentences. `deck.test.ts` passes over the 120 cards.
- **FSRS adapter** `src/scheduler/fsrs.ts`: `fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: false }))`, `createEmptyCard(now)`, `scheduler.next(card, now, Rating.Good | Rating.Again)` (only `.card` is kept; the review log is dropped). Exports `Progress` (the ts-fsrs `Card` fields + `cardId`, `family`, `seenAt`), `newProgress`, `review`, `isDue`, `isOverdue`, `startOfDay` (local midnight) and `State`. Tests in `tests/unit/fsrs.test.ts` use the installed library's numbers (ts-fsrs 5.4.2): a fresh card answered correctly → Learning, due in **10 min**; correct again → Review, due in **2 days**; correct again → **11 days**; wrong on a Review card → **Relearning**, 1 lapse, due in 10 min; wrong on a new card → due in 1 min.
- **Store** `src/store/db.ts` on `idb`: database `godot-vocabulary` v1 with stores `progress` (keyPath `cardId`; value = `Progress`, dates kept as `Date`), `settings` (one record under key `settings`), `customCards` (keyPath `id`; `Card` + `custom: true`), `meta` (key `lastSessionDate` → `YYYY-MM-DD` string). Functions: `getSettings` (stored values laid over the defaults) / `saveSettings`, `getProgress(ids?)` → `Map` (all records when `ids` is omitted) / `saveProgress(one or many)`, `listCustomCards` / `addCustomCard` / `deleteCustomCard` (also deletes that card's progress), `getLastSessionDate` / `setLastSessionDate`, `exportAll()` → `{ version: 1, exportedAt, progress, settings, customCards }` with dates as ISO strings, `importAll(objectOrString, 'merge' | 'replace')`, and `closeStore` / `deleteStore`. `tests/unit/store.test.ts` uses `fake-indexeddb` (new dev dependency): round-trips, export JSON-safety, a fresh-install restore, replace wiping the device, both merge directions, and rejecting bad files.
- **Session builder** `src/session/build.ts` (pure): `buildSession({ cards, progress, settings, now }, rng)` → card ids, `sessionSummary(input)` → per family `{ enabled, due, overdue, newAvailable }`, `seededRng(seed)` (mulberry32), `interleave`, `runLimit`. Reviews = enabled cards with progress due ≤ now. Any enabled card due before local midnight → **no new cards**. Otherwise each enabled family gets `newPerDay` minus the cards first seen today (`seenAt` ≥ local midnight). Those are the unseen cards in rank order (ties broken by id) whose `requires` already has progress. Ordering: a Fisher–Yates shuffle, then a weighted deal by family that never makes a same-family run longer than `ceil(biggest / (rest + 1))`. That is the shortest limit any order can achieve, so with three comparable families the runs are 1–2 long. `tests/unit/session.test.ts` (done-criteria 9, 10, 11) also runs **two simulated weeks over the real 1,102-card deck** and checks that no member card ever appears before its class card has progress.
- **Settings maths** `src/settings/load.ts`: `Settings` type, `DEFAULT_SETTINGS` (10/5/5, all on, retention 0.9), `withDefaults`, `totalNewPerDay` (enabled families only), `projectedReviewsPerDay` = 10 × total, `warningAboveTwenty` (total > 20). Tested in `tests/unit/settings.test.ts`.
- **Gates**: `pnpm generate`, `pnpm typecheck`, `pnpm test` (8 files, 63 tests), `pnpm build` green. `pnpm e2e` not run (no specs yet; session 3).

### Deviations and why
1. **Short-term steps stay on (ts-fsrs defaults).** The brief wanted two things the library can't give together. A fresh correct card due "within 1–10 days" happens only with `enable_short_term: false`. A wrong answer after a correct one going to "the relearning state" happens only with it on: with it off, the card stays in Review. I kept the defaults because they give relearning. So a new card answered correctly is due again in **10 minutes**, and the 1–10-day interval comes on the next correct answer (2 days, asserted).
   **For session 2b:** to keep the overdue gate from blocking tomorrow's new cards, re-ask a card in the same session when its new `due` falls before the session ends, or before local midnight. Otherwise every card first seen today is overdue tomorrow and holds back that day's new cards until it is cleared. The other option is a Chief-of-Staff call to set `enable_short_term: false`, which means no Relearning state and no same-day repeats.
2. **The `keywords` rows have no `_ready` or `@onready`** (they count language keywords only), so those two cards sit at the positions the brief's example list gave them. `NAN`, `breakpoint` and `yield` (0 projects; `yield` is obsolete) have no cards. Language items outside the basics page are ordered getting-started pages first, then the basics page, then the class reference, which is the order a beginner meets them.
3. **`@GDScript.xml` is not in `data/sources/`** (the engine keeps it under `modules/gdscript/doc_classes`, which the sparse clone leaves out). Cards for `load`, `len` and `@warning_ignore` cite `classes/class_@gdscript#…` from the online class reference. `range` and `preload` cite the basics page. `pnpm fetch-sources` could add that folder.
4. **`source.ref` format** is the docs URL path plus `#` and the section heading, e.g. `tutorials/scripting/gdscript/gdscript_basics#if/else/elif`. Class-reference cards use `classes/class_node#_ready`.
5. **Answer format**: description cards show callables with `()` (`_ready()`, `clamp()`). Snippet cards show exactly what fills the blank (`_process`, `lerp`, `connect`).
6. **`settings/load.ts` went into the scheduler + store commit**, because the store imports its `Settings` type and defaults. The session builder had its own commit, and the notes have theirs.
7. **The merge import** keeps this device's settings, adds the file's custom cards (the file wins on the same id), and per card keeps whichever progress record has the later `last_review` (more `reps` breaks ties). `replace` clears progress and custom cards first.
8. **The first commit (language cards)** went in after `pnpm test` but before typecheck and build had run. Both were green at the next commit, and nothing in that commit touches TypeScript sources.

### Left for session 2b
Screens (start with `sessionSummary`, card, feedback, summary, settings with the `load.ts` maths, add-card, export/import, About), wiring `buildSession` + `review` + `saveProgress`, the same-session re-ask policy from deviation 1, rendering `code` in JetBrains Mono with Godot's syntax colours (done-criteria 5), 23 lint, 28 contrast test.

## GV-2b — component kit, session screens, live flow, fonts, screenshots (2026-10-13)

### Built
- **Kit** `src/ui/kit/index.ts` (plain DOM factories) + `src/ui/kit.css` (only `--…` properties): `el`, `asset` (base-path URLs), `button` (primary = accent fill, secondary = `contrast_color_1`, flat; all ≥ 44 px), `panel` (`dark_color_1`, `--corner-radius`, no border), `heading` (accent blue, bold), `icon` (24 px, `alt=""`, removes itself if the file is missing), `choiceRow` + `setChoiceState` (`idle | chosen-right | chosen-wrong | revealed-right | disabled`; right/wrong use `success_color`/`error_color` as text and a 2 px inset ring, plus a visible note "Right" / "Your answer" / "Correct answer" so colour is never the only cue), `textField` (LineEdit look, accent ring on focus, optional search glyph drawn in `currentColor`), `toggle` (`role="switch"`, CheckButton look), `stepper` (−/+ 44 px buttons around an `<output>`), `stat` (`dt`/`dd`, used inside a `dl`), `blank` (the `____` slot in `selection_color`, read out as "blank"), `codeBlock`, `richText` (`inline code`, ``` fences, blanks).
- **Fonts**: `@font-face` for Inter 400/700 and JetBrains Mono 400 at the top of `kit.css`; Vite rewrites `/fonts/…` to `/godot-vocabulary/fonts/…` (checked in `dist`). Body text 16 px; code 16 px.
- **Tokenizer** `src/ui/kit/gdscript.ts`: per line; keywords, control-flow keywords, `@annotations`, strings (with `&`/`^` prefixes), numbers, `#` and `##` comments, function definitions, calls, global functions (a fixed list), base types, engine types, members after `.`, symbols, `$`/`%` node paths, and the `____` blank. `tests/unit/tokenizer.test.ts` checks the classes and that every snippet card tokenizes back to its exact text with one blank.
- **`pnpm lint:css`** `scripts/lint-css.mjs`: fails on `#hex`, `rgb(a)(`, `hsl(a)(` in `src/**/*.{css,ts}` outside `src/theme/derive.ts` (done-criteria 23). Hover uses `color-mix(in srgb, var(--mono-color) 7%, transparent)`, which is Godot's `alpha1`.
- **Screens** `src/ui/screens/`: **start** (per enabled family: Due / New today / Overdue from `sessionSummary`; primary Start, disabled with a plain reason; flat Settings / Add card / About open **placeholders** for GV-2c), **card** (thin accent progress bar with `role="progressbar"`; family in secondary text; the kind as an accent heading like the help panel's "Description"; prompt; code block; four choices in an order seeded by an FNV-1a hash of the card id; API class cards show `icons/<Choice>.svg` on every choice; one tap locks all four, marks right/wrong, reveals the answer, shows the explanation in a `role="status"` region, then a primary Next (or "See summary") that takes focus; a flat "End session" stops early), **summary** (cards seen, right, wrong, due tomorrow; Done → Start). `src/ui/app.ts` swaps screens in `#screen` (no router, no URL change) and moves focus to the new screen's heading. `index.html` keeps one `<main>` with the `<h1>` app name (small, centred like a Godot dialog title).
- **Flow** `src/session/run.ts` (`Session`, deps injected; `src/session/deck.ts` wires the decks + IndexedDB):
  - Start loads the three decks + custom cards, `getProgress()`, settings; `buildSession` with `seededRng(Date.now())`.
  - Reviews first: when any enabled card is overdue the builder already yields reviews only; after each answer, once no enabled card is overdue, `buildSession` runs again and its ids not already queued are appended.
  - Each answer: `review(progress ?? newProgress(...), correct, now)` → `saveProgress` awaited before Next appears.
  - Re-ask: when the new `due` is before the next local midnight the card is reinserted at queue index 3 (three cards between) or at the end if fewer remain. Summary counts each card once, by its first answer.
  - `finish()` (also on End session) writes `setLastSessionDate` (local `YYYY-MM-DD`). "Due tomorrow" = enabled-family progress with `due` before the end of tomorrow (so it includes anything left today).
  - Start-blocked reasons: every family off; nothing due and today's new cards done; nothing due and every card seen. When reviews are overdue, a note says new cards wait until the N overdue reviews are done.
  - `tests/unit/run.test.ts`: immediate save, re-ask position, once-only counting, `lastSessionDate`, overdue-first then new cards appended.
- **Screenshots** `scripts/screenshot.mjs` (Playwright, 360×780, scale 2, touch, service workers blocked) → `docs/screenshots/start.png`, `card-api.png`, `card-code.png`, `card-answered.png`, `summary.png`. The run's order is random, so `card-answered.png` shows whichever card first got a wrong tap (a GitHub term in the committed one).
- **Gates**: `pnpm typecheck`, `pnpm test` (10 files, 70 tests), `pnpm build`, `pnpm lint:css` green. `pnpm e2e` not run (no specs yet).

### What the critique changed
Compared with the Create New Node dialog, the help panel and the script editor:
1. The right/wrong notes sat beside the label and broke class names mid-word ("CollisionObject2 D"). Now they go on their own line under the label, and labels break only when they must.
2. The programmatically focused heading showed a focus ring. `tabindex="-1"` targets no longer show an outline; real controls keep the accent ring plus a `highlight_color` halo.
3. Hover stuck after a tap on touch screens (End session looked pressed). Hover rules now sit under `@media (hover: hover)`.
4. Code wrapped mid-string (`"u|i_accept"`). Now there is a break opportunity (`<wbr>`) after `.`, `(` and `,`, wrapped lines hang 2 columns in, and the tab size is 2 below 480 px (4 above, as in the editor).
5. The progress line now moves as soon as a card is answered, not on Next.
Kept on purpose: the code block has the same colour as the panel (`script_background_color` and `dark_color_1` are both `#171717` in 4.7), so the line numbers and the highlighted blank line mark it, as in the editor. The line with the blank gets `current_line_color`, like the caret line.

### Deviations and why
1. **Annotation colour**: the 4.7 annotation colour lives in `modules/gdscript/editor/gdscript_highlighter.cpp`, which is not vendored, and `data/theme/` has no annotation entry. `@annotations` use `--code-string-placeholder-color` (`#ffbf66`, the nearest orange) until the Chief of Staff adds the engine value to the theme JSON. Node paths (`$Node`, `%Name`) use the string colour for the same reason (no `node_path`/`node_ref` colour in the file).
2. **Engine types are guessed** from PascalCase spelling, not checked against the class list. User-defined class names would be coloured as engine types; snippets don't define any.
3. **Primary button text** is `font_focus_color` (white) on the accent. That is Godot's look, and it falls below 4.5:1. It goes on the contrast report (done-criteria 28, not built yet).
4. **Playwright's Chromium is not installed** on this machine. `scripts/screenshot.mjs` falls back to the system Edge (`channel: 'msedge'`). `pnpm exec playwright install chromium` is needed before `pnpm e2e` (session 3).
5. **Bundle size**: the three decks are bundled into the main chunk (697 kB, 128 kB gzip). Vite warns over 500 kB. Everything is precached for offline use, so it is left as is; code-splitting the decks is an option.
6. **"End session"** is an extra flat control on the card screen (not in the brief), so a learner can stop and still get a summary. Every answer is already saved.

### Left for session 2c / 3
Settings, Add card, About screens (the kit's `toggle`, `stepper` and `textField` are ready for them), export/import UI, the contrast report (28), and the e2e + axe specs (25, 27, 29–31).

## GV-2c — settings, add card, export/import, About, contrast report (2026-10-13)

### Built
- **Navigation**: `Nav` gained `settings()`, `addCard()` and `about()`; the Start screen's three flat buttons open them. `placeholderScreen` now serves only as the "Something went wrong" screen. Every new screen ends with a secondary **Back** (to Start) in a `gv-links` nav below the panels.
- **Settings** `src/ui/screens/settings.ts` (done-criteria 19): one block per family (`role="group"` named after the family) with a `toggle` carrying the family name (bold, flush, like Start's family names) and a `stepper` "New cards per day", 0–50. Below them a `role="status"` area: `stat` "New per day" (`totalNewPerDay`) and "Reviews per day" ("about N", `projectedReviewsPerDay`). Above twenty it adds the warning in `warning_color`: "Above twenty new cards a day the review pile grows to about two hundred a day. It is allowed; it is a lot." The value is still accepted. Retention is not shown. Every change calls `saveSettings` straight away.
- **Data panel** (same screen; helpers in `src/store/file.ts`, tested in `tests/unit/file.test.ts`):
  - **Export** writes `exportAll()` as pretty-printed JSON to `godot-vocabulary-YYYY-MM-DD.json` (local date), using a Blob and an `<a download>`. File shape: `{ version: 1, exportedAt, progress: [ts-fsrs card fields + cardId, family, seenAt; dates as ISO strings], settings: { families: {…: { enabled, newPerDay }}, retention }, customCards: [Card + custom: true] }`.
  - **Import** is a secondary button that opens a hidden `<input type="file" accept=".json,application/json">`. After a file is picked, the screen asks "<file name>: how should it be imported?" and offers two buttons, each with a sentence under it:
    - **Merge with this device**: "Keeps your settings here. Adds the file's custom cards. For each card, keeps whichever progress was reviewed last."
    - **Replace everything on this device**: "Deletes the progress and custom cards on this device, then restores the file's progress, settings and custom cards."
    - Plus **Cancel**.
  - The result is one line, e.g. "Restored 12 cards of progress and 1 custom card." (the counts are what the file carried). A bad file gives, in `error_color`, "Nothing was imported." followed by the reason ("This file is not a JSON file." or the store's "Not a godot-vocabulary export (version 1)."). After an import the family controls redraw from the stored settings.
- **Add card** `src/ui/screens/add-card.ts` + `src/cards/custom.ts` (done-criteria 20; tested in `tests/unit/custom-card.test.ts`):
  - Fields: Family (select), Question (multi-line), Right answer, Wrong answer 1–3, Explanation (optional, multi-line).
  - **Save** checks the draft and lists problems in plain words in a `role="alert"` list: "Write a question." / "Write the right answer." / "Write all three wrong answers." / "The four answers must all be different." (ignores case and outer spaces) / "The question gives the answer away: take the answer out of it." (the answer appears anywhere in the question, ignoring case). The offending fields get `aria-invalid` and an `error_color` ring; when focused they show the accent ring instead.
  - The saved card gets id `custom:<family>:<slug of the answer>-<6 random base-36 chars>` (`crypto.getRandomValues`), kind `custom` (shown as "Your card" on the card screen), source `{ doc: 'custom', ref: 'your card' }`, and `rank` = floor(the family's highest rank, decks and custom cards together) + 1. It is then the family's next new card in rank order.
  - Then "Card saved" names the answer and offers **Add another** (keeps the family) and **Back**. Below the form, "Your cards" lists every custom card: answer, family and prompt (clamped to two lines), and a flat **Delete**. Delete swaps in "Delete this card and its progress?" with **Delete** / **Keep**, inline, with no browser dialog.
- **About** `src/ui/screens/about.ts` (done-criteria 22; `tests/unit/about.test.ts`):
  - Two sentences on what the app is, then the unofficial statement and "The Godot logo is not used; the app icon is its own glyph."
  - Card counts per family read from the bundled decks (886 / 120 / 96), plus the number of your own cards.
  - Every notice from `THIRD_PARTY_NOTICES.md`: Godot Engine MIT copyright, the Godot docs CC BY 3.0 line with the licence URL, GitHub Docs CC BY 4.0, the demo projects, Inter and JetBrains Mono OFL, ts-fsrs, idb, Workbox. The test checks the required lines and that every `dependencies` entry in `package.json` appears both here and in the notices file.
  - The repository link `https://github.com/talex444/godot-vocabulary` (accent link, 44 px tall), and "Version 0.1.0" from `package.json`.
- **Kit additions**: `selectField` (Godot's OptionButton: a native `<select>` in the LineEdit box, with a down-arrow glyph drawn in `currentColor`), the `[hidden] { display: none !important }` rule, and the invalid-field ring. Screen-level classes in `screens.css`: `gv-load`, `gv-warning`, `gv-error`, `gv-result`, `gv-label`, `gv-option` (a button with a sentence under it), `gv-row`, `gv-errors`, `gv-custom…`, `gv-credits`, `gv-link`. Also `.gv-screen p { margin: 0 }`; the summary and start screenshots are unchanged by it.
- **Contrast report** `tests/unit/contrast.test.ts` → `docs/contrast-report.md` (done-criteria 28):
  - How it measures: WCAG 2.x relative luminance. A translucent foreground is composited onto its background, and a translucent background onto `base_color`, both rounded to 8 bits.
  - What it covers: 49 pairs. Body, secondary and disabled text on `base_color`, `dark_color_1` and the script background. Focus text on `dark_color_1`. Accent heading (large, 3:1), accent link text (4.5:1) and accent focus ring (3:1) on `base_color` and `dark_color_1`. Success, warning and error on `dark_color_1` and on `base_color` (the choice rows sit on `base_color`). All 16 syntax colours the tokenizer uses, on the script background. Code text on the blank line's `current_line_color`. Inline code. Primary and secondary button text. As controls (3:1): field border, switch tracks and thumb, right/wrong rings, blank slot.
  - It never fails on a ratio. It rewrites the file and fails only when the committed report differs from what it computed, so the report cannot go stale.
  - **5 of 49 pairs fall short**: disabled text on all three backgrounds (3.18–3.22:1; WCAG 1.4.3 exempts inactive controls, but they are listed anyway), primary button text, white on accent (2.71:1), and the blank slot, `selection_color` on `dark_color_1` (2.08:1).
- **Screenshots**: `scripts/screenshot.mjs` now also captures `settings.png`, `settings-warning.png` (Godot API at 11, total 21), `add-card-errors.png` (a duplicate answer), `add-card.png` (after saving one card, so the list shows it) and `about.png`. The session screenshots were re-taken in the same run (random order, same screens).
- **Gates**: `pnpm typecheck`, `pnpm test` (14 files, 83 tests), `pnpm build`, `pnpm lint:css` green. `pnpm e2e` not run (no specs; session 3).

### What the critique changed
Compared with the existing screenshots: the family switches sat 4 px in from the stepper labels and looked lighter than the Start screen's family names. They are now flush and bold. Nothing else was restyled.

### Deviations and why
1. **No README yet**, so done-criteria 28's "the README names that file as a known deviation" is open. The README is session 3's (26); it should link `docs/contrast-report.md`.
2. **`selectField` added to the kit**: no existing component fitted a family choice. A native select keeps keyboard and screen-reader behaviour for free.
3. **Extra screenshot** `add-card-errors.png`, to show the validation. The brief listed four screenshots.
4. **The import result counts what the file carried**, not what a merge actually changed: a merge that keeps newer local progress still reports the file's totals. Counting the real writes would mean changing `importAll`'s return value; not done.
5. **The warning text is fixed** ("about two hundred a day"), even when the projected figure beside it reads 210 or more. That is the brief's wording; the number is right there in the stat.
6. **About's attribution text is a copy of `THIRD_PARTY_NOTICES.md`**, not read from it at runtime (the file isn't shipped). `about.test.ts` guards the required lines and the dependency names, not the exact wording.
7. **Export on a phone**: the download goes through `<a download>`. On Android Chrome this lands in Downloads; on iOS Safari it opens the share/save sheet. Not checked on a device this session.

### Left for session 3
21 (export → fresh install → import e2e), 25, 27 (axe on settings, add-card and about too), 29–31, 26 (README, including the contrast-report link from deviation 1).

## GV-3 — phone end-to-end suite with axe, README, GitHub Pages workflow (2026-10-13)

### Built
- **Specs** in `tests/e2e/`, all at the `phone` project (360×780, touch). Shared navigation is in `helpers.ts`: `gotoStart`, `open`, `backToStart`, `startSession`, `answer`, `goNext`, `endSession`, `familyStats`, `importFromStart`/`importOnSettings`, `exportFile`/`overdueProgress` (version 1 files built from the real `src/data/*.json` ids), and `walkScreens`, which visits all eight screens in one pass and is reused by the layout, keyboard and axe specs.

  | Spec | Done-criteria | What it checks |
  |------|---------------|----------------|
  | `install-offline.spec.ts` | 1, 2, 3 | Manifest linked and parsed (name, short_name, standalone, 192/512 icons); service worker active and controlling. Offline: reload, answer a card, end the session, change a setting, add a card. Close the page and reopen offline: same per-family counts, the setting, the custom card. |
  | `session.spec.ts` | 4, 5, 6, 8, 12 | Start counts 10/5/5 with due and overdue at 0, and one Start. A card has one prompt and exactly four choices; no explanation or Next before the tap; the first session is 20 new cards. An API class card has an icon (loaded) on every choice. A snippet card's code is in JetBrains Mono, with more than one token colour. One tap disables all four, marks the tapped one, shows exactly one right answer, the explanation and Next; a forced second tap changes nothing. The summary shows seen 2, right + wrong = 2, due tomorrow ≥ 2. |
  | `overdue.spec.ts` | 11 (+ 21 import) | A crafted file with one Review record for `api:class:Area2D`, due yesterday, imported with Replace. Start shows it as overdue, with the "New cards wait…" note. The queue holds only that card (`aria-valuemax` 1). After it is answered, new cards are appended and one comes within two cards. A fresh install has no overdue and a 20-card queue. |
  | `data.spec.ts` | 19, 20, 21 | Switch and stepper persist across a reload (it waits until IndexedDB has the value first). Total and projection go 20/200 → 16/160 → 21/210; the warning appears above twenty and survives a reload; retention is not shown. Add a card, answer one card, export (download). A new browser context imports with Replace and gets "Restored 1 card of progress and 1 custom card."; re-exporting there gives identical progress, settings and custom cards. |
  | `about.spec.ts` | 22 | Every Notice cell in `THIRD_PARTY_NOTICES.md` (URL and aside cut off) appears on About, along with the licence names, the CC links, the unofficial statement, "The Godot logo is not used", and the link `https://github.com/talex444/godot-vocabulary`. |
  | `layout.spec.ts` | 25, 29, 31 | Every screen at 360×780, 320×780 and 780×360 landscape: `scrollWidth ≤ clientWidth`; every visible `button`, link, input, select, textarea and switch at least 44×44; no text under 16 px; no clipped text; no overlapping controls. At 320 px, twenty random cards (before and after answering) are checked at normal size and at 200%. The 200% test (every screen) is a proxy, stated in the spec: Playwright cannot set browser zoom, so the root font size is set to 200% (the stylesheet is in rem). |
  | `keyboard.spec.ts` | 30 | Tab from Start's heading reaches Start; Enter starts. Tab reaches the four choices in order, and each one's outline or box-shadow differs from its unfocused look. Space answers, Next takes focus, Enter goes on, Enter answers. On every screen, every Tab stop is `:focus-visible` with a ring, fully in the viewport after `scrollIntoViewIfNeeded`, and on top at its centre (`elementFromPoint`). Stops follow reading order. In Settings, Space flips a switch and Enter steps a number. |
  | `axe.spec.ts` | 27 | 15 screen states: start, settings, settings with the warning, the import choice, each family's card before and after answering, summary, add card, add card with errors, about. Each runs `AxeBuilder.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])` twice: with `disableRules(['color-contrast'])`, violations must be empty; run normally, the `color-contrast` nodes are written to `docs/axe-contrast.md` (sorted, no timestamps). The card screens are deterministic: an imported file sets each family to one new card a day. |

- **`pnpm e2e`**: 22 tests, about 10 s of Playwright time with 8 workers (about 15 s with the build and the preview server). The layout spec passed `--repeat-each 8` (160 random cards at 200%).
- **axe findings**: **0 violations** on every rule but contrast. **7 contrast findings**, all one pair: white text on the accent primary button (`#ffffff` on `#579eff`, 2.71:1), on start, the three answered cards, summary, add card and add card with errors. It is already on `docs/contrast-report.md`. axe skips disabled text, so the disabled-text pairs from the contrast report do not show up here.
- **README.md** (26): what it is and that it is unofficial; Android and iPhone install; offline; the session rules; where cards come from and `pnpm fetch-sources` / `pnpm generate`; add card; export/import; the contrast deviation, linking both reports; licences, linking `THIRD_PARTY_NOTICES.md`; local commands.
- **`.github/workflows/deploy.yml`**: on push to `main` and manual dispatch; `concurrency: pages` with cancel-in-progress.
  - `build`: checkout@v5, pnpm/action-setup@v4 (no `version` input, so it reads `packageManager: pnpm@11.9.0`, already in package.json), setup-node@v5 (Node 22, pnpm cache), `pnpm install --frozen-lockfile`, typecheck, test, lint:css, `playwright install --with-deps chromium`, `pnpm e2e`, upload-pages-artifact@v4 with `dist`.
  - `deploy`: needs build, environment `github-pages`, `pages: write` + `id-token: write`, deploy-pages@v4.
  - **Chief of Staff:** enable Pages on the repo (Settings → Pages → Source: GitHub Actions) after this lands. Until then the README's URL is not live.
- **Gates**: `pnpm typecheck`, `pnpm test` (14 files, 83 tests), `pnpm build`, `pnpm lint:css`, `pnpm e2e` (22 tests) green.

### What the e2e found and fixed in the app (separate commit `fix: reflow stat grids…`)
1. **Horizontal scroll at 200% text** (WCAG 1.4.4/1.4.10):
   - Start's three stat columns could not fit "Overdue" at 32 px.
   - On Add card, the native `<select>` widened the whole screen to 510 px.
   - Long class names (`VisibleOnScreenNotifier2D`) in choices and in "Not quite. It is …" pushed past the edge.
   The cause was grid tracks sized `auto`, which never shrink below their content's min-content width. Now every single-column grid uses `minmax(0, 1fr)`, the screen sets `overflow-wrap: break-word` (so words still break only when they must), the code line's text column is `minmax(0, 1fr)`, and the stat grids `auto-fit` columns of at least 5.5rem (8rem in the summary). At 16 px on a 360 phone that is still three columns (two in the summary); at 320 px Start shows two.
2. **Inline code was 15.2 px** (`0.95em`), under the app's 16 px floor. It is now `1em`.

### Deviations and why
1. **`@axe-core/playwright` was not installed**, although the brief pointed at its README. Added as a dev dependency (4.13.0) in the first commit.
2. **Playwright's Chromium for the installed version (v1248) was missing** on this machine, so every test failed to launch. I ran `pnpm exec playwright install chromium` once, which downloads to the user's ms-playwright cache.
3. **Service workers are blocked by default** in `playwright.config.ts` (`serviceWorkers: 'block'`). Only `install-offline.spec.ts` turns them back on, so a cached shell can't leak between specs. The config also sets `forbidOnly` and the `github` reporter on CI.
4. **Settings save is fire-and-forget** (`void saveSettings(...)`). A reload within milliseconds of a tap lost the last change in the first run of `data.spec.ts`. The spec now waits until IndexedDB holds the value. On a phone the window is a few milliseconds; not changed in the app. Awaiting the save before the UI updates would close it, if wanted.
5. **Keyboard focus ring on text fields** is drawn on the field box (`:focus-within`, like Godot's LineEdit), not on the `<input>` (outline none). The spec reads the ring from `.gv-field__box` for fields.
6. **Screenshots were not re-taken** after the CSS fix: `scripts/screenshot.mjs` needs a running preview server, and this session runs nothing in the background. At 360 px the layout is unchanged; the visible differences are inline code at 16 px instead of 15.2 px, and how text reflows at 320 px or 200%.
7. **axe report rows** add the text and background colours next to the brief's screen, selector, expected and actual, because they make each row checkable against `contrast-report.md`.
8. **Workflow action majors** (checkout v5, setup-node v5, upload-pages-artifact v4, deploy-pages v4, pnpm/action-setup v4) are the latest majors I know of. Not run on GitHub yet.

## GV-4a — generator rules, pools, full descriptions, links, topics; scheduler; learning queue; skips and course hooks (2026-10-13)

Logic and data only; no screens changed. Done-criteria 32, 33, 34, 36 (data half), 37 (store half), 38, 39.

### Card data (done-criteria 34, 36, 39)
`Card` gains `distractorPool`, `distractorIds`, `explainFull`, `docsUrl` and `topic`. `distractors` stays as the first three entries of the pool.

- **Pools** hold up to 8 entries.
  - Class cards: siblings under the same `inherits`, then the nearest ancestor's other children, then rank neighbours. Editor-only classes are never used. A class whose own card a rule dropped stays in the pool.
  - Member cards: same-kind members of the class, then of its ancestors.
  - GitHub: up to 6 terms from the same group, then other terms. Synonym sets never stand as each other's wrong answer (see deviation 6).
  - Language cards (`generate.mjs`, so `data/cards/gdscript.json` is untouched): the hand-written wrong answers first, then same-kind answers of the same form (snippet or not), then any of the same kind.
  - Pool sizes: **8 for 1,057 cards, 7 for 6, 4 for 3** (99.2% have six or more).
- **`explainFull`**: the complete converted description, capped at 1,200 characters at the last sentence end with " …". The cap never cuts inside a code fence. Members get the signature line first. GitHub cards get "term: description". Language cards copy `explain`, the only text they have.
- **`docsUrl`**: built in `scripts/lib/docs.mjs`.
  - Class page `…/en/4.7/classes/class_<lower>.html`.
  - Member anchors are docutils ids of `class_<Class>_<kind>_<member>`, e.g. `#class-timer-property-one-shot`.
  - Manual sections use the Sphinx slug (`#if-else-elif`).
  - Glossary: `…/github-glossary#<slug>`.
- **Topics**: `scripts/topics.json`, read by `scripts/lib/topics.mjs`.
  - Class topics come from the first staged page that mentions the class (step by step → first 2D game → GDScript pages), otherwise from the inheritance roots (Control → UI, Node3D → 3D nodes, CanvasItem → 2D nodes, Resource → Resources), otherwise Core.
  - Members take their class's topic. Language cards take their page's topic; class-reference pages take that class's topic.
  - GitHub topics: the group in `scripts/github-terms-allowlist.json` ("Git basics", "Branches and pull requests", "GitHub features").
  - Class cards per topic: Resources 127, Core 89, 3D nodes 60, UI 42, GDScript basics 31, 2D nodes 24, Your first 2D game 16, Nodes and scenes 8, Signals 5, Your first script 5, and Instancing, Player input, Exports and Static typing 1 each.

### Generator rules (done-criteria 38)
`pnpm generate` prints each count. The removed ids are written to `data/removed-cards.json`, which the deck test reads.

| Rule | Removed | Cards |
|------|---------|-------|
| (a) class brief identical (normalised) to another non-editor class's | 9 | CheckButton, CheckBox, TileMapLayer, TileMap, ParallaxBackground, XRPositionalTracker, AudioListener3D, NavigationMeshSourceGeometryData2D/3D |
| (b) `api_type="editor"` | 6 | EditorPlugin, EditorInterface, EditorImportPlugin, EditorFileSystem, EditorScript, EditorSelection |
| (c) prompt still has `____` or ≤ 2 words after masking (fallback: first sentence of the full description for classes, first sentence alone for members) | 9 | JSON, IP, RemoteTransform3D, GDExtension, GraphFrame; Color.hex, Transform3D.is_equal_approx, Transform3D.is_finite, Environment.adjustment_contrast |
| (d) member description of ≤ 4 words | 12 | AnimatedSprite2D.offset/animation_changed/frame_changed/sprite_frames_changed, Animation.step, VisibleOnScreenNotifier2D.rect, CollisionObject2D.get_rid, CanvasLayer.offset/scale/transform, Label.justification_flags, TextureRect.texture |
| (extra) fewer than 4 wrong answers | 7 | Vector2.x/y, Vector3.x/y/z, Transform3D.basis/origin |

The fallback saved Image ("____ datatype." → "Native image datatype."). **New counts: Godot API 850 (411 class + 439 member, was 431 + 455), GDScript 120, GitHub 96, total 1,066.** The README count is updated. `pnpm generate` run twice gives an identical diff.

### Scheduler (done-criteria 32)
`enable_short_term: false`. ts-fsrs 5.4.2 numbers, pinned in `tests/unit/fsrs.test.ts`:

| Answer | Result |
|--------|--------|
| New card, right | Review, due in **3 days** |
| Right again | **14 days** |
| New card, wrong | Due in **1 day** |
| Wrong on a Review card | Stays in Review, 1 lapse, due in **2 days** (shorter than the 14) |

There is no Relearning state.

### Learning queue (done-criteria 33), exactly as implemented (`src/session/learning.ts`)
- **Plan**: `planSession(input, rng)` returns `{ order, newIds }`. `order` holds the first showings, interleaved as before. `newIds` are today's new cards. Cards with progress are reviews.
- **Showings**: a new card is shown until it has been shown **≥ 3 times AND its last answer was right**, or the session ends. A review card is shown once.
- **Due slots**: slot = the number of answers given before a showing. First showings are due at their index in `order`. After an answer at slot `s`, a card that is not done is due at `s + max(8, floor(remaining / 4))`, where `remaining` = showings still queued. It goes in behind everything due at or before that slot, but always with at least `min(8, remaining)` showings in front of it. The queue is served in due order.
- **Tail**: a card with nothing left to put between is not asked again (never adjacent).
- **Grading**: only the first answer of the session is returned as `grade` and passed to `review()`; repeats never touch FSRS. "Seen/right/wrong" in the summary count first answers.
- **Tests**: never adjacent and gap ≥ min(8, remaining) over 1,000 seeded sessions (1–30 new + 0–29 reviews, 70% right); three showings; wrong-until-right (5 showings after 4 wrong); first-answer-only grades; reviews once; append.

10-card trace (seed 42, about 75% right; first answers c0✓ c1✓ c2✗ c3✓ c4✓ c5✓ c6✓ c7✓ c8✗ c9✓):
```
1:c0 2:c1 3:c2 4:c3 5:c4 6:c5 7:c6 8:c7 9:c8 10:c0 11:c9 12:c1 13:c2 14:c3 15:c4 16:c5 17:c6 18:c7 19:c8 20:c0
21:c9 22:c1 23:c2 24:c3 25:c4 26:c5 27:c6 28:c7 29:c8 30:c9 31:c7
```
c7 was wrong on its third showing, so it got a fourth.

### What GV-4b needs
- **`src/session/choices.ts`**: `drawChoices(card, showingIndex, rng, previousSets, cardsById?)` returns `{ direction: 'forward' | 'flipped', choices: { text, correct, cardId? }[4], key }`.
  - `showingIndex` counts from 0. Showings 1 and 2 flip when `canFlip(card)` holds (class/method/property/signal/term, or a language keyword/builtin/lifecycle/concept/operator/annotation card without `code`). The flip also needs three pool ids that resolve to cards with no `code`, and an unused set of four. Otherwise the draw is forward.
  - Flipped choices are prompts. The right one is the card's own `prompt`, and the screen shows `card.answer` as the question.
  - Keep each `key` in `previousSets`. Pools of 4 have only four sets, so a fifth forward showing repeats one.
- **`src/session/learning.ts`**: `startLearning(plan)`, `currentCard`, `showingIndex`, `answerCurrent(state, correct)` → `{ state, grade, requeuedAt }`, `appendCards`, `dropCard`, `isLearned`, `requeueDelay`, `SHOWINGS`, `GAP`.
- **`src/session/build.ts`**:
  - `planSession`, `Lesson`, `SessionPlan`.
  - `SessionInput` gains `skipped?`, `lessonsDone?` and `lessons?`.
  - `Settings.newCardMode` (`'frequency'` by default; stored, no UI).
  - `buildSession` remains as `planSession(...).order`.
- **`src/session/run.ts`**: already uses the plan and the state machine.
  - New: `session.showing`, `session.draw()` (cached per showing; adds to the card's sets) and `session.skip(reason?)`.
  - `answer(choiceText)` checks against the current draw, so a flipped answer is the description text. Without `draw()` it compares with `card.answer`, which is what today's card screen does.
  - `RunDeps` gains optional `getSkipped`, `skipCard` and `getLessonsDone` (wired in `deck.ts`).
- **`src/store/db.ts`**: database v2 with stores `skipped` (cardId, reason?, at) and `lessonsDone` (lessonId, at).
  - Functions: `listSkipped`, `getSkippedIds`, `skipCard(id, reason?, at?)` (reason trimmed, empty dropped), `unskipCard`, `listLessonsDone`, `getLessonsDoneIds`, `markLessonDone` (first date kept).
  - `exportAll()` writes version 2 with `skipped` and `lessonsDone` (ISO dates). `importAll` reads versions 1 and 2. Replace clears both stores; merge adds missing entries and keeps this device's on the same id. The error text is now "Not a godot-vocabulary export (version 1 or 2)."
- **Card screen still to do**: it still shuffles `card.distractors` itself. It should call `session.draw()`; show `explainFull` and a `docsUrl` link (`target="_blank" rel="noopener"`) after answering; and add the Skip control.

### Gates
`pnpm typecheck`, `pnpm test` (16 files, 114 tests), `pnpm build`, `pnpm lint:css` green. **`pnpm e2e`: 20 pass, 2 fail**, both left for GV-4b:
1. `data.spec.ts` "add a card, export, then a fresh install imports…": it expects `file.version` 1, and the export is now version 2.
2. `session.spec.ts` "12: the summary shows … due tomorrow": it expects due tomorrow ≥ 2 after two answers. With short-term steps off, a right first answer is due in 3 days, so only wrong answers count.

The other specs pass because the card screen still draws forward from `distractors`. They will need changes once the screen uses `draw()` (repeats, flipped cards) and once session lengths include repeats: `aria-valuemax` now grows as repeats are queued.

### Deviations and why
1. **The pool's ids live in a parallel `distractorIds`** rather than the pool being ids. Forward choices need the text even when no card exists (a dropped class, a hand-written wrong answer), and flipped choices need a card to take the prompt from. `distractorIds[i]` is the id entry `i` would have; `drawChoices` resolves it through `cardsById`. Unresolvable hand-written language distractors get `gd:wrong:<kind>:<text>`.
2. **The new `Card` fields are optional in the type.** Custom cards have no docs link, pool or topic. Every generated card has them (deck test). `drawChoices` falls back to `distractors`.
3. **Rule (c) applies to Godot API cards only.** GitHub prompts ("A ____ is…") and the hand-written language prompts use the blank as the question itself.
4. **Rule (a) drops both classes of a pair** and compares against every non-editor class, not only those in the deck. That removes TileMap, TileMapLayer and ParallaxBackground, which a 2D learner meets. **Chief of Staff:** worth deciding whether such classes should fall back to the first sentence of their full description (as rule (c) does) instead of being dropped.
5. **Extra rule "fewer than 4 wrong answers"** (7 cards). The deck test asserts pools ≥ 4 everywhere, and these cards had exactly three wrong answers.
6. **The GitHub allow-list changed shape** to `{ terms: [[term, group]…], synonyms: [[…]…] }`. Preferring the same group brings near-synonyms together (main/master/default branch, feature/topic branch, review/pull request review, …), and two of them could both fit one description. Eleven synonym sets keep them apart. The sets are my judgement.
7. **Topic list**: besides the brief's examples, `topics.json` names "Instancing", "Your first script", "Player input", "GDScript advanced", "Format strings", and "Built-in functions" (for `@GlobalScope`/`@GDScript` language cards). Because step-by-step pages come first, Area2D, Timer and Button get "Signals", and CharacterBody2D gets "Nodes and scenes".
8. **The learning queue uses due slots, not a plain insert at position `max(8, remaining/4)`.** The first version inserted at that position, which pushed the cards behind it back on every answer. In a 10-card session the last card was never shown until the end, and then only once. With due slots the spacing rule is the same, first showings keep their place, and the minimum gap still holds. A repeat can wait one or two slots longer than its delay when other repeats are due at the same time (pinned in the test: 9, then 10 between).
9. **Docs anchors not verified for virtual methods, annotations and `@` classes.** They are built by the docutils id rule from the class reference's labels: `_ready` → `#class-node-private-method-ready`, `@warning_ignore` → `#class-gdscript-annotation-warning-ignore`, `@GlobalScope.lerp` → `class_@globalscope.html#class-globalscope-method-lerp`. Worth one check in a browser.
10. **`run.ts` is rewired to the plan and state machine** (logic, not a screen), so the live app never sends a repeat to FSRS. Without that, the scheduler change would have made the old re-ask path grade repeats.
11. **Commit order**: the learning queue was committed before the scheduler, so each commit's unit tests pass on its own. The learning commit was also run under the old short-term setting.
12. **Bundle**: the main chunk grew from 697 kB to 1,635 kB (249 kB gzip), mostly `explainFull` and the pools. It is still precached. Code-splitting the decks is the fix if load time matters.
13. **Gates**: `CLAUDE.md` asks for `pnpm e2e` green before every commit. The store and notes commits went in with the two expected e2e failures above, as the brief directs.

## GV-4b — screens for the new flow, Skip, the generator pair rule, e2e and screenshots (2026-10-13)

Done-criteria 33 (e2e), 34 (UI), 35, 36 (UI), 37 (UI + e2e), 38 (the keep-one fix), 40.

### What changed on screen
- **Card** (`src/ui/screens/card.ts`). It now takes its four choices from `session.draw()` on every showing, so the wrong answers are fresh each time; the old per-card `shuffledChoices` is gone.
  - **Flipped showings** (`data-direction="flipped"`, class `gv-card--flipped`): the question is the name. A class shows its icon beside the name. A member shows `Class.member` in code font, a language card shows the keyword in code font, and a GitHub term shows plain text. A line "Pick the description that fits." follows.
  - The four choices on a flipped card are descriptions. `choiceRow` has a new `rich` option that renders `inline code` and `____` slots and wraps over several lines. On flipped member cards the choices drop their "Class: " prefix, so the class name does not give the answer away.
  - **Repeat label**: "Second look", "Third look" (and on up) appears under the family label.
  - **After answering**: "Right." or "Not quite. …" comes first. Then `explainFull` appears in a scrollable region (`role=region`, "Full description", focusable, max 16rem tall, on `base_color`). Below it is the flat link **Open in the Godot docs** / **Open on GitHub Docs** (`target=_blank rel=noopener`, with hidden text "(opens in a new tab)"), then Next.
  - **Skip this card**: a flat control at the foot of the panel, available before and after answering. Tapping it opens a one-line "Reason (optional)" field with a note, **Skip** and **Cancel** (Enter skips, Escape cancels). Confirming calls `session.skip(reason, cardId)` and moves on.
  - For tests, the panel carries `data-card-id`, `data-showing` and `data-direction`, and each choice row carries `data-card-id`. Assistive technology does not read these.
- **Summary**: two more stats, **Cards learned** (three showings with the last one right) and **Continue tomorrow** (new cards answered but not learned). A one-line explanation follows. These only show when the session had new cards. Skipped cards count in neither.
- **Settings**: a **Skipped cards** panel between the families and Data. Each entry shows the card's answer, its family, the skip date, and the reason (or "No reason given."), with **Undo** (accessible name "Undo skip: <title>"). After an Undo, focus stays in the section. The Export note mentions skipped cards.
- **Look fixes after the screenshots**: on a flipped card the class icon wrapped onto its own line above a long name, so it is now pinned beside the name. On the summary, a wrapped "Continue tomorrow" label pushed its value below the one beside it, so summary stats now align their values.

### Session wiring (`src/session/run.ts`)
`SessionResult` gains `learned` and `continueTomorrow`. `skip(reason?, cardId?)` can name the card, because once a card is answered the queue has already moved on. The rest was wired in GV-4a: `draw()`, first-answer-only grading and appending after overdue cards are cleared.

### Generator pair rule (CoS ruling)
Classes with the same normalised brief now keep one card. The kept class is the one not `deprecated`; if neither is, the one with the better frequency rank. The dropped twins never appear in the kept card's pool.
- **Rule (a) removes 4 (was 9)**: CheckBox (CheckButton kept), TileMap (TileMapLayer kept), NavigationMeshSourceGeometryData3D (2D kept), ParallaxBackground.
- **Back in the deck**: TileMapLayer, CheckButton, XRPositionalTracker, AudioListener3D, NavigationMeshSourceGeometryData2D.
- **New counts**: Godot API **855** (416 class + 439 member), GDScript 120, GitHub 96, **total 1,071**. The README count is updated.
- The deck test pins the three pairs, the twin missing from each kept pool, and 4 removals.

### e2e (26 tests, about 12 s)
| Spec | Test | Done-criteria |
|------|------|---------------|
| `learning.spec.ts` | 10 API cards. The third first-showing is answered wrong. The test checks: no adjacent repeats, ≥ 3 showings each with the last right, showing numbers counting up, gaps of ≥ 8 while the queue is long, some flipped later showings, first showings forward, and a summary of seen 10 / right 9 / wrong 1 / learned 10 / continue 0 | 33 |
| `session.spec.ts` "34, 35" | 3 API cards × 3 showings. No card shows the same four choices twice. A flipped class card has the icon and name as the question, "Second/Third look", and four icon-less descriptions | 34, 35 |
| `session.spec.ts` "36" | Full-description region present, docs link with `target=_blank` / `rel=noopener` and an official host, no sideways scroll | 36 |
| `skip.spec.ts` | Cancel keeps the card. Skip with a reason, and the card never reappears in the rest of the session. Settings lists it with family and reason. The export has it in `skipped`. Undo empties the list, and the card is the next new card | 37 |
| `session.spec.ts` "12" (fixed) | Due tomorrow equals wrong first answers, learned 0, continue 2 | 12, 33 |
| `data.spec.ts` (fixed) | The export is version 2 with `skipped: []` | 37 |
| `axe.spec.ts` (extended) | Adds: flipped card, flipped card answered, the skip field, Settings with a skipped card | 40 |

### Screenshots and reports (done-criteria 40)
- `scripts/screenshot.mjs` adds `card-flipped.png`, `card-answered-full.png`, `card-skip.png` and `settings-skipped.png` (an element shot of the panel), and retakes the rest. It now answers right by default.
- `docs/axe-contrast.md` has 8 findings. The new one is the same Godot accent-blue Next button on the flipped-answered screen.
- `docs/contrast-report.md` is unchanged, because there are no new colour pairs.

### Deviations and why
1. **Card-screen Skip went into the card commit.** It shares `card.ts` and `run.ts` with the screen work. The Settings list is its own commit.
2. **The generator commit missed two icons** (`public/icons/TileMapLayer.svg`, `AudioListener3D.svg`) that `pnpm generate` wrote for the classes back in the deck. They are in a follow-up `fix(generate)` commit.
3. **ParallaxBackground has no card.** It is deprecated, and its non-deprecated twin is outside the deck (no demo-project uses), so the rule drops it and nothing replaces it. TileMap is in the same position, but TileMapLayer replaces it.
4. **"Continue tomorrow" is a label, not a date.** A new card answered right first is due in 3 days, so the note under it says the rest "carry on at their next review".
5. **The last e2e run reused an orphaned preview.** Stopping the screenshot `pnpm preview` task ended pnpm but left its vite child on port 4173. Every way to find its process id (netstat, wmic, ps) needed approval, which the headless session cannot get. The suite ran green (26/26) against that server, which serves the same `dist/`, through a temporary config with `reuseExistingServer: true` that was deleted afterwards. **That vite process may still be running on port 4173. Close it before the next `pnpm e2e`.**
6. **Docs anchors** for virtual methods and `@GDScript` members follow the CoS-verified hyphen rule. No change was made.

## GV-5 — Android package with Capacitor, daily reminder, signed APK on Releases (2026-10-13)

Decisions 25, 27 and 28; done-criteria 41 to 45. Seven commits, none pushed, no tag.

### What was generated (done-criteria 41)
- **Packages:** `@capacitor/core` 8.5.3, `@capacitor/android` 8.5.3 and `@capacitor/local-notifications` 8.3.1 (runtime); `@capacitor/cli` 8.5.3 (dev).
- **`capacitor.config.ts`:** appId `io.github.talex444.godotvocabulary`, appName "Godot Vocabulary", webDir `dist`, background = theme `base_color`. `LocalNotifications.smallIcon` = `ic_stat_reminder` (hand-written vector, the glyph's tick in white), `iconColor` = theme `accent_color` `#579eff`.
- **`android/`:** made by `pnpm exec cap add android` and committed. Capacitor's own `android/.gitignore` already leaves out `build/`, `.gradle/`, `local.properties`, the copied web assets and the generated `capacitor.config.json`/plugin lists. The root `.gitignore` adds `android/app/build/`, `android/build/`, `android/.gradle/`, `android/local.properties`, `*.keystore`, `*.jks` and `keystore.properties`. `.gitattributes` keeps `*.bat` at CRLF and `*.jar` binary.
- **Edits to the generated project:**
  - `app/build.gradle`: `versionName` comes from `package.json` (`1.1.0`), and `versionCode` = major·10000 + minor·100 + patch (`10100`). Release signing reads `android/keystore.properties` when the file exists.
  - The launcher icons are the app's own glyph. `scripts/generate-icons.mjs` now also writes legacy, round and adaptive-foreground PNGs for every density, plus the `#242424` background. The `public/` icons are byte-identical.
  - The launch theme uses the base colour instead of Capacitor's sample splash. The unused `splash.png` files stay in the tree.
  - `SaveFilePlugin.java` is registered in `MainActivity` (see Export below).
- **Scripts:** `build:android` = `tsc --noEmit && vite build --mode android && cap sync android`. `android:debug` / `android:build` = `node scripts/gradle.mjs assembleDebug|assembleRelease`. The wrapper runs `gradlew.bat` on Windows and `sh ./gradlew` on Linux, always with `--no-daemon`. On Windows it falls back to `%ProgramFiles%\Android\Android Studio\jbr` and `%LOCALAPPDATA%\Android\Sdk` when `JAVA_HOME`/`ANDROID_HOME` are unset, so no `local.properties` and no machine path in `gradle.properties`.

### One source tree, two bases
- `vite build --mode android` → `base: './'` and `VitePWA({ disable: true })`: no `sw.js`, no `manifest.webmanifest`, no `registerSW.js`. The plain `vite build` is unchanged. Before the reminder code went in, it produced the same asset hashes as before this session.
- `index.html`'s favicon link changed from `/godot-vocabulary/app-icon.svg` to `/app-icon.svg`, so Vite prefixes it per target.
- Checked in `dist/index.html`:
  - Web build: `/godot-vocabulary/app-icon.svg`, `/godot-vocabulary/assets/index-….js|css`, manifest and registerSW present.
  - Android build: `./app-icon.svg`, `./assets/…`, no manifest.
  - Fonts are `url(../fonts/…)` in both. Class icons go through `import.meta.env.BASE_URL`, which becomes `./icons/…` in the package.

### The reminder, exactly (done-criteria 43)
- **Where:** `src/reminder/reminder.ts` holds the plain helpers and the platform check. `src/reminder/native.ts` holds every Capacitor call. The web build loads `native.ts` only through `import()`, behind `isNativeApp()`, which reads `window.Capacitor.isNativePlatform()` (the package's WebView injects `window.Capacitor` before the app's scripts run). The web bundle's main chunk has no Capacitor code; Vite puts it in separate chunks that the web never requests. Workbox still precaches those few KB.
- **Setting:** `{ on, time }` in the IndexedDB `meta` store under `reminder`, with default `{ on: false, time: '20:00' }`. It is a property of this phone, so it is **not** in the export file, and a replace-import leaves it alone.
- **Settings screen:** a **Reminder** panel appears between the family settings and Skipped cards, only inside the package. It has:
  - a **Daily reminder** switch;
  - a **Time** field (native `<input type="time">` in the kit's LineEdit box; `textField` gained a `time` option);
  - the sentence "Fires at about that time. Turn on Exact time if you want the minute.";
  - an **Exact time** switch, described by that sentence;
  - a status line.
- **Permission:** turning the reminder on calls `checkPermissions()`, and `requestPermissions()` only when the state is `prompt`/`prompt-with-rationale`, so Android asks once. If notifications are denied, the switch goes back off and the status line says where to turn them on.
- **Exact time:** the switch shows `checkExactNotificationSetting()`. Tapping it calls `changeExactNotificationSetting()`, which opens Android's "Alarms & reminders" screen for the app. On return the switch shows what Android now allows, and the reminder is re-scheduled. Android owns this setting, so the switch mirrors it rather than storing a preference. On Android 14+ (the S24) exact alarms are off by default for a fresh install, so the default is the window. On Android 12–13 they are on by default, so the reminder will be exact there until the user turns it off.
- **Scheduling (`applyReminder`):**
  1. Cancel id 1.
  2. If the reminder is on, the time parses, and notification permission is `granted`, schedule one notification with `schedule: { on: { hour, minute }, allowWhileIdle: true }` and `isExactNotification` = whether Android currently allows exact alarms.
  3. **Why that flag:** plugin 8.3 opens the exact-alarm screen on every `schedule()` call whose notification wants exact (the default), so `isExactNotification: false` is what keeps the default a window. With it false, the plugin uses `setAndAllowWhileIdle` (inexact); with it true and allowed, `setExactAndAllowWhileIdle`. The plugin's publisher re-arms the `on` schedule after each firing, and its boot receiver restores it after a reboot.
- **When it is re-scheduled:** on every launch (`main.ts` → `restoreReminder()`), whenever the app goes to the background (`visibilitychange` → hidden), on every change in the panel, and it is cancelled when switched off.
- **Text:** the title is "Godot Vocabulary · N cards waiting" ("1 card waiting"; "cards are waiting" when the count is 0 or could not be computed). The body is "Due reviews and today's new cards. Tap to open." N = due reviews + today's new cards in the enabled families, as `sessionSummary` sees them **at the next firing time**. Tapping the notification opens the app (the plugin's default).
- **Known limit:** the text is fixed when it is scheduled. If the app is not opened for days, later firings repeat the last count. Opening or leaving the app refreshes it.

### Export and import inside the package (done-criteria 45, found during the session)
- **Import already worked:** Capacitor's WebView implements the file chooser.
- **Export did not:** the package's WebView has no download handler, so the blob `<a download>` would have done nothing.
- **Fix:** an app-local plugin, `android/app/src/main/java/…/SaveFilePlugin.java` (`@CapacitorPlugin(name = "SaveFile")`, registered in `MainActivity.onCreate`). It opens `ACTION_CREATE_DOCUMENT` (Android's "Save as") with the export's file name and writes the JSON through the content resolver. It needs no storage permission. `src/store/save-file.ts` bridges it, loaded only inside the package. Cancelling says "Nothing was saved."
- The web Export is unchanged.
- The Settings help text still says "in Downloads". In the package the learner picks the folder, which Android usually opens in Downloads.

### About (done-criteria 44)
- A **Check for updates** link under the version opens `https://github.com/talex444/godot-vocabulary/releases` with `target="_blank"`. The e2e About test checks its href and target.
- **How it leaves the app:** this WebView has no multi-window support, so the link navigates in place. Capacitor's `BridgeWebViewClient.shouldOverrideUrlLoading` then calls `Bridge.launchIntent`, which sends any host other than the app's to `ACTION_VIEW` (the browser). This was confirmed by reading `Bridge.java` in the installed 8.5.3, **not on a phone**.
- The version is now **1.1.0** in `package.json`, so About, the APK's versionName and the `v1.1.0` tag agree.

### CI signing flow (done-criteria 42): `.github/workflows/android.yml`
1. **Triggers:** tags `v*` and manual dispatch. `permissions: contents: write`.
2. **Checks:** checkout, pnpm (from `packageManager`), Node 22 with the pnpm cache, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`.
3. **On a tag:** the tag must equal `v` + `package.json` version, or the job fails.
4. **Build:** `pnpm build:android`.
5. **Java:** `actions/setup-java@v5`, **Temurin 21**.
6. **Signing:** the step decodes `ANDROID_KEYSTORE_BASE64` to `$RUNNER_TEMP/godot-vocabulary.keystore`, outside the repo. It writes `android/keystore.properties` (storeFile, storePassword, keyAlias, keyPassword) from the four secrets, passed through `env:` and never echoed.
7. **Release build:** `pnpm android:build` (assembleRelease, signed through the `signingConfigs.release` above).
8. **Check the APK:** copy `app/build/outputs/apk/release/app-release.apk` to `godot-vocabulary-<ref>.apk`. If signing did not happen, Gradle names the output `app-release-unsigned.apk` and this copy fails. Then `apksigner verify --print-certs` with the newest build-tools.
9. **Clean up:** an `always()` step deletes the keystore and `keystore.properties`.
10. **Publish:** `actions/upload-artifact@v4` uploads the APK. On a tag, `gh release upload --clobber` attaches it if the release exists; otherwise `gh release create --verify-tag` creates the release with install notes. Both use `GITHUB_TOKEN`.
- `deploy.yml` is untouched.
- **Not run:** this workflow has never run. Its first run is the CoS's `v1.1.0` tag.

### Local build result (done-criteria 41)
- `pnpm build:android` and `cap sync android` succeed. Sync found the one plugin, `@capacitor/local-notifications@8.3.1`; the app-local SaveFile plugin is registered in Java, not through sync.
- `pnpm android:debug` succeeds. The first run downloaded Gradle 8.14.3 and took 1 min 10 s; later runs took about 11 s. Output: **`android/app/build/outputs/apk/debug/app-debug.apk`, 5,197,420 bytes**.
- `pnpm android:build` succeeds without a keystore (lint-vital passes): **`android/app/build/outputs/apk/release/app-release-unsigned.apk`, 3,836,180 bytes**. Signed local release builds were not tried, because the keystore is not on this machine.
- The JDK was Android Studio's `jbr` and the SDK `%LOCALAPPDATA%\Android\Sdk`, both picked up by `scripts/gradle.mjs`.
- The very first Gradle run used a daemon. It was stopped with `gradlew --stop`, and since then the wrapper always passes `--no-daemon`.
- **Not installed on a phone.** Every on-device behaviour above is untested here and is the human check on the S24: the reminder firing, the permission prompt, the Exact time round trip, Export's Save as, Import, Check for updates, and the launcher icon.

### Gates
- `pnpm typecheck`, `pnpm test` (120 tests, 6 new in `tests/unit/reminder.test.ts`), `pnpm build`, `pnpm lint:css` and `pnpm e2e` (26/26) ran green before the commits, with three exceptions:
  - The first two commits (setup, then base switch) shared one gate run.
  - Before the Export commit, the full suite was 25/26 twice, failing only on the flaky test below. That spec file then passed on its own.
  - For the README/notes commit only `pnpm e2e` was re-run, because it changes no code.
- **One flaky e2e test, which predates this session:** "5: an API class card shows the class icon beside every choice". It failed in 2 of 7 full runs and passed when re-run.
  - **Cause:** the distractor pools of several class cards list `InputEvent`. Godot ships no `InputEvent.svg` and `public/icons/` has none, so that choice's `<img>` fails, `icon()` removes it, and the test finds no icon.
  - The draw is seeded by `Date.now()`, so the test fails whenever `InputEvent` is drawn.
  - **Fix for a later session:** in the generator, drop icon-less classes from class-card distractor pools, or give them their parent's icon as the editor does. That needs `pnpm generate` with `data/sources/`.
- The Reminder panel never renders in the browser, so neither axe nor the layout tests cover it. Its controls are the kit's `toggle` and `textField`, which those tests cover elsewhere.

### Deviations and why
1. **`--mode android` instead of a `BUILD_TARGET` env flag.** An env prefix in a package.json script does not run in `cmd.exe` on Windows. Vite's mode is cross-platform and needs no extra dependency.
2. **Temurin 21, not 17.** Capacitor 8's Android library declares `JavaVersion.VERSION_21`, so a JDK 17 build would fail.
3. **Signing through `keystore.properties`** instead of `-Pandroid.injected.signing.*`. The same file serves CI and Tyler's local `pnpm android:build` (done-criteria 41: signed locally when the keystore is present).
4. **`gh release` instead of `softprops/action-gh-release`.** `gh` is preinstalled on the runner, so this adds no third-party action.
5. **Export plugin added.** It was not in the brief, but without it done-criteria 45 (export works inside the package) could not be met.
6. **`gradlew` is committed without the executable bit.** `git update-index --chmod=+x` needs approval in headless mode. The wrapper runs `sh ./gradlew`, so CI does not need the bit. Running `./gradlew` directly on Linux/macOS would.
7. **Version bumped to 1.1.0** in the workflow commit, so the CI tag check passes for `v1.1.0`.
8. **`THIRD_PARTY_NOTICES.md` and the About list went into the setup commit**, not the notes commit. `tests/unit/about.test.ts` requires every runtime dependency to be named in both, so the setup commit would fail its own gate without them. AndroidX (Apache 2.0) is named too, because it is inside the APK.
9. **Capacitor's sample `splash.png` files and the default `drawable-v24/ic_launcher_foreground.xml` are committed but unused.** Deleting tracked generated files needs `git rm`, which this session does not use. They can go in a cleanup.

## GV-5b — class choice rows show either four icons or none (2026-10-13)

### The rule
- `classPool` in `scripts/generate-api-cards.mjs` now keeps icon parity. A class card's pool holds only classes that match the answer: either all have `data/sources/godot-4.7/icons/<Name>.svg`, or none do.
- The filter applies to every candidate before the pool is cut: siblings, ancestors' children and the rank-neighbour fallback. Ordering and twin exclusion are unchanged.
- This fixes the flaky e2e test noted in GV-5. It also removes a leak: before, a learner could rule out an icon-less choice without reading it.
- A class card whose parity pool is under `MIN_POOL` (4) now goes to `removed.smallPool`, which until now held only member cards. The exception is a card under rank 60 (`EARLY_RANK`): it stays as long as its pool still has 3 names.
- `copyAssets` is unchanged.

### Counts
- Before: 416 class cards. 316 have an icon and 100 do not. 117 icon cards had an icon-less name in their pool, and 94 icon-less cards had an icon name in theirs (CoS figures).
- After: still **416 class cards** and 439 member cards. Mixed pools: **0**. Every class pool still has 8 names.
- **No class card was removed because of parity.** `data/removed-cards.json` is byte-for-byte unchanged, and `smallPool` is still the 7 member cards it was before. No early card (rank under 60) needed the 3-name exception.

### Tests
- `tests/unit/deck.test.ts` has two new tests:
  - "gives every class card a pool with the icon parity of its answer (done-criteria 46)". The answer's icon-ness agrees with `card.icon`, and every pool name's icon file in `public/icons` matches the answer's.
  - "keeps no class card with a pool under MIN_POOL; parity shortfalls go to the removed list". `MIN_POOL` is imported from the generator.
- In `tests/e2e/session.spec.ts`, "5: an API class card shows the class icon beside every choice" now looks for a forward class card whose row shows icons. Without that change, an icon-less answer such as `Input` would correctly show four blanks and fail the test. The existing four-icons assertion now doubles as the parity check for icon rows.

### Gates
- `pnpm typecheck`, `pnpm test` (122 tests), `pnpm build`, `pnpm lint:css`: all green.
- `pnpm e2e`: 26/26, run twice, both green.

### Deviations
1. **The new test has not been seen failing on the old deck.** `git stash` needs approval in headless mode, so it was not run. The CoS counts (117 + 94 mixed pools on the old deck) show the test would have failed there.
2. **The e2e test now chooses an icon card**, as described under Tests. Icon-less rows have no e2e test of their own. The unit parity test covers them.
