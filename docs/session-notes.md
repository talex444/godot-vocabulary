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

## GV-6a — courses: the lesson engine, the two screens, lesson 0 (2026-10-13)

Decisions 31–42; done-criteria 47–55. Ten commits, none pushed.

### The format (`src/courses/types.ts`, `src/data/courses/course-1.json`)
- A **course** is `{ id, title, lessons[] }`. A lesson is either written (`CourseLesson`) or **planned** (`{ id, order, title, page, planned: true }`). Lessons 1–5 are planned rows that the list shows as "Coming in a later version."
- A written lesson has:
  - `id`, `order`, `title` (the focus question), `page` `{ title, url }` (a docs.godotengine.org link) and `cardIds` (≥ 3).
  - `need` (paragraphs split by a blank line), `agenda` (3 lines) and `chunks[]`. Each chunk has `heading`, `text`, optional `code`, `image` `{ src, alt, caption, width, height }` and `drawing` `{ caption, nodes: { name, type, depth }[] }`, and one `check`.
  - `compare` `{ a, b, question }`. Examples have `title`, `text` and optional code, image or drawing.
  - `exercises[]`: `predict` (a four-choice check), `blank` (`text` or `code` with exactly one `____`, a one-word `answer`, `why`) and `fix` (`lines[4]`, `answer`, `fixed`, `why`, optional `plain` for prose lines).
  - `errors[]` `{ what, fix, source }` (2–3), `exitStem`, and an optional `table` `{ caption, columns, rows: { head, cells } }` for decision 41. It is stored and validated but not rendered yet.
- Text fields use the cards' inline rule (`code`, `____`). `validateCourse` returns every shape problem; the unit test runs it on every file in `src/data/courses/`.
- **Pictures:** `image.src` is a file name. `scripts/lesson-images.mjs` (run by `pnpm generate`, and run once by hand this session) copies each named picture from `data/sources/godot-docs/img/` to `public/courses/img/`. The term check fails a missing one. `webp` joined the service worker's precache globs, so the pictures work offline.
- `src/courses/index.ts` holds `COURSES`, `findLesson`, `pretestCards` (the three lowest `rank`s among `cardIds`) and `sessionLessons()`. `load()` in `run.ts` now passes the written lessons to the session builder, so `courseFirst` has lessons to work with.

### The term check (`scripts/check-lessons.mjs`, `pnpm lint:lessons`, first step of `pnpm build` after tsc)
- **What counts as code font:** `inline code` in any text field, `code` blocks, non-plain `fix` lines, a blank's `answer`, and drawing node `type`s. String literals, `#` comments and `____` inside code are skipped. URLs, alt text, ids and image names are never read.
- **Resolution** (an index built from the three decks):
  - A class name → `api:class:<Name>`.
  - `Class.member` → the member card, if there is one.
  - A bare `member` or `member()` → any member card of that name, or the `gd:*` card whose answer it is (`_ready()` → `_ready`, `@export`, `func`, `print`, …).
- **Met** = this lesson's `cardIds` plus those of earlier written lessons in the same course.
- **It fails when:**
  - a token resolves to cards and none of them is met;
  - a capitalised name resolves to no card at all (e.g. `Spatial`);
  - a `cardId` is not in the decks;
  - a picture is missing.
- **It passes** a lower-case name with no card (a local variable is not vocabulary). That is my reading of "identifier": without it, lessons 3–5 could not show `var speed = 400`.
- **Message:** `course-1 lesson c1-l0 ("…"): \`Timer\` in code font (chunks[0].text) is not a card the learner has met; add api:class:Timer to this lesson's or an earlier lesson's cardIds`.
- The unit tests cover: an unmet class added to lesson 0; `func`/`_ready`/`add_child` caught in a code block while strings, comments and local names pass; an earlier lesson's card counting as met; and a class the decks lack.

### Store and export
- **Database v3:** a new store, `exitTickets` (keyPath `lessonId`; `text`, `date`), with `saveExitTicket` (text trimmed; empty text deletes the ticket), `getExitTicket` and `listExitTickets`.
- **Export v3:** adds `exitTickets` with ISO dates. Import reads versions 1, 2 and 3.
  - Merge keeps this device's ticket for the same lesson.
  - Replace clears and restores.
  - The error text is now "version 1, 2 or 3".
- Settings' Export note names finished lessons and exit tickets.

### Screens
- **Start:** a flat **Courses** link comes first among Settings / Add card / About.
- **Course list** (`courses.ts`): a 44 px row per lesson, laid out like a Create New Node row: order number in code font, "Lesson n: title", and the manual page in secondary text. Done lessons get a green tick plus hidden "(done)" text. Planned rows are not buttons: they show an outline and "Coming in a later version."
- **Lesson page** (`lesson.ts`): one panel per step, `data-step` = `pretest`, `need`, `chunk-n`, `compare`, `exercises`, `errors`, `exit`.
  - The header shows "Course 1 · Lesson 0", the question as the h2, and a "Manual: …" link that opens in a new tab. On reopen, the saved exit ticket shows there too ("Your exit ticket").
  - **Pretest:** it reuses `drawChoices` (showing 0, forward) and `choiceRow`, with class icons as on the card screen. It shows "Right." / "Not quite. It is X." and makes no scheduler call. Three right answers reveal **Skip to the exercises**, a flat button that scrolls to and focuses the Exercises heading.
  - **Checks, predict and fix:** each shows "Right." or "Not quite. The right answer is marked." / "The wrong line is marked.", then the one-sentence why, then a flat **Next** that focuses the next step's heading. Fix items also show the fixed line.
  - **Typed blank** (`judgeBlank` in `src/courses/blank.ts`; `gapField` in the kit): a LineEdit-styled input in code font sits inside the sentence. For code snippets, `codeBlock` gained a `gap` option, so the input replaces the `____` slot in the line.
    - Enter or **Check** submits. An empty field is not a try.
    - A case-only miss shows "Check the case. GDScript names are case-sensitive." and counts as a miss. Any other miss shows "Not that word. One more try."
    - The second miss fills in the answer, shows it and marks the item `data-result="wrong"`.
    - A right answer shows "Right.", or "Second try, and you had it." when it came after a miss.
  - **Tree drawing:** Scene-dock rows (editor icon, name, and the type in code font when it differs from the name), indented with the dock's guide line. It starts with the root; **Add the next node** reveals one row at a time and announces "Added Camera2D under Player." When every row is shown, the button is disabled and reads "All nodes added".
  - **Errors:** a warning-coloured edge (like a docs note), the error, **Fix:**, and the source in secondary text.
  - **Exit:** the question again, a note ("Optional, never scored, kept only on this device."), a multi-line field labelled with the stem, **Save** ("Saved on this device."), and **Mark done**. Mark done calls `markLessonDone`, sets `newCardMode: 'course'` if it was not already, and returns to the list.
- **Settings:** a **Lesson cards first** switch (course mode) with a sentence saying it turns on by itself. The brief's e2e check "Settings shows course mode on" needed something visible, so I made it a switch rather than a read-only line.
- **About:** a "Lessons and cards" panel (the two paths, and why memorise). The course attribution row is in About and `THIRD_PARTY_NOTICES.md`.

### Lesson 0, measured
- **Source:** "Overview of Godot's key concepts" (4.7 branch). It quotes the page's sentences in curly quotes, plus three class-reference briefs (`Node`, `PackedScene`, `SceneTree`). Framing is mine: the need, agenda, bridge sentences, questions and error fixes.
- **Chunks:** 4 (Scenes 118 words, Nodes 141, The scene tree 95, Signals 108), so **462 words** in the explanation, inside 400–1,000. About 1,780 words on the whole page, which is a twenty-minute read-and-do.
- **Cards (9):** `Node`, `PackedScene`, `SceneTree`, `Signal`, `CharacterBody2D`, `Camera2D`, `Sprite2D`, `CollisionShape2D`, `Node3D`. The pretest is `CharacterBody2D` (rank 1), `CollisionShape2D` (6) and `Node` (11).
- **Pictures:** 5 of the page's 6 (`key_concepts_scene_example`, `character_nodes` (twice), `scene_tree`, `signals`, `main_menu` in compare). `node_menu` is not used. The drawing is the Player scene: Player (`CharacterBody2D`) → `Camera2D`, `Sprite2D`, `CollisionShape2D`.
- **Checks and exercises:** 4 chunk checks; compare (Player scene vs the MainMenu scene: what they share); 3 exercises (predict, blank `CharacterBody2D`, plain-prose fix).
- **Errors (3):**
  - the page's note "‘Spatial’ Nodes are now called ‘Node3D’ starting with Godot 4";
  - Sorva row 79 (class vs instance → saved scene vs the nodes made from it);
  - Sorva row 91 (objects created by themselves → a scene is in the game only once it is in the tree).
  - Row 70 is not used.
- **Exit stem:** "When a Godot game runs, it is made of …".

### e2e and reports
- **`courses.spec.ts`** (3 tests, about 5 s together):
  - the list (six rows, the planned note, no sideways scroll, the step order);
  - the perfect-pretest skip;
  - lesson 0 end to end, under one family at 3 new cards a day. Pretest wrong then right; a check and Next focus; the drawing to four rows; the blank with `characterbody2d`, then `CharacterBody2D`; fix; three errors; the ticket saved; Mark done and the tick; the ticket shown on reopen; the Settings switch on; export v3 with the lesson and the ticket. Then a session whose new cards are exactly the first three `cardIds`, a replace with an empty file (lesson not done, no ticket), and an import of the export (both back).
- **`walkScreens`** now visits Courses and the lesson page, so the layout specs (44 px, 16 px, 320 px, 200 %, landscape) and the keyboard spec cover them. `axe.spec.ts` audits "courses", "lesson" and "lesson answered".
- **Full suite:** 29 tests, about 16 s.
- **`docs/axe-contrast.md`:** 10 findings. The 2 new ones are the same Godot accent-blue primary button (Mark done). `docs/contrast-report.md` is unchanged: no new colour pairs.
- **Screenshots:** `courses.png`, `lesson-top.png` (pretest answered), `lesson-drawing.png` (extra: the tree at three rows), `lesson-exercise.png` (the case hint), and `lesson-end.png` (last error and the exit ticket). All the others were retaken.
- **What the screenshots changed:**
  - the blank's paragraph had line-height 2.9 on every line, and now has 1.6;
  - nested straight quotes inside the manual's curly ones became ‘single’ quotes;
  - planned lesson titles are no longer the focus white;
  - pictures carry their size (no jump while a lazy picture loads, which had also put a focused row 0.33 px under the fold) and keep their natural width instead of stretching.
- **Preview server:** started as `node node_modules/vite/bin/vite.js preview` (no pnpm wrapper, so no orphaned child) and stopped. The next `pnpm e2e` started its own server on 4173 with `--strictPort`, so the port was free.

### Gates
`pnpm typecheck`, `pnpm test` (18 files, 137 tests), `pnpm build` (with the term check), `pnpm lint:css` and `pnpm e2e` (29/29) are green on the final tree. Each commit had typecheck and the unit tests run before it. The full e2e ran before the e2e commit and again after the screenshot fixes.

### Deviations and why
1. **Commit order and grouping.** Lesson 0 went into the first commit with the format and the term check. The schema test, `pretestCards` and the screens all import `course-1.json`, so a format commit without it would not build. About came before the screens because it is independent. Two `fix` commits came out of the e2e and screenshot looks.
2. **Lesson 0's minimal-fix uses prose lines** (`plain: true`). Lesson 0 has no code (decision 38), but the e2e asks for a minimal-fix item. The format still renders code lines (code font, the fixed line as a code block) for lessons 1–5.
3. **Lesson 0's typed blank is an identifier in a quoted sentence**, not a code line, for the same reason. The code path (`codeBlock` with `gap`) exists but has no lesson using it yet.
4. **Scope of the term check:** lower-case names with no card pass (see above). Drawing types and a blank's answer count as code font.
5. **Planned lessons in the file.** Course 1 lists lessons 1–5 as `planned` rows with their manual pages, so the list shows six rows now and GV-6b only replaces them.
6. **`Button` is not one of lesson 0's cards.** The page says "buttons" in plain words, and the lesson does too; the card comes with lesson 5.
7. **The keyboard spec's in-view check allows 0.5 px.** On a long page the browser can scroll a focused row to a fractional edge (bottom 780.33 of 780). That is not obscured focus.
8. **The pretest draw is random** (`Math.random`). It is not seeded per lesson, so the three distractor sets vary between visits, like the card screen.
9. **`fetch-sources.mjs` was not run** (no network). Checked offline instead: its image rule (every `.. image::`/`.. figure::` in the introduction and step-by-step pages) names exactly the 75 files in `data/sources/godot-docs/img/`. The first-2D-game pages' pictures are not fetched, because today's hand fetch did not have them either.
10. **`docs/decisions.md` has uncommitted CoS edits** (rows 31–43 and "Noted ideas"). I left them unstaged.

## GV-6b — courses: lessons 1 to 5 and the course-end table (2026-10-13)

Done-criteria 56–59. Eleven commits, none pushed.

### Cards added through the generator
- **The gap.** The pages' members had no cards. The generator takes only the first 10 methods and 8 properties of a class, in the XML's alphabetical order, and gives members only to the top 40 classes. So `get_node`… was fine (a gd card), but these had no card:
  - `Node.set_process` and `Node.is_processing`;
  - `Vector2.rotated`;
  - `Input.is_action_pressed` (Input is rank 47, past the 40 member classes);
  - `CanvasItem.visible`;
  - `BaseButton.pressed`.
- **Why not the suggested route.** Raising `MEMBER_CLASSES` or pinning a class would not reach them: they sit past the alphabetical caps.
- **What I did.** `LESSON_MEMBERS` in `scripts/generate-api-cards.mjs` names the members course 1 shows in code. They are carded past the caps, and for classes past the 40, under the same rules (b)–(d).
- **The result:** 855 → **861 cards** (+6 member cards). `data/removed-cards.json` is **unchanged**, and every deck test passes.
- **`Sprite2D.texture`** was on the list at first. Rule (d) dropped it ("Texture2D object to draw.", four words), so I took it off. `texture` stays a lower-case name with no card, which the check passes.
- **Constants have no cards.** The generator has no constant kind, so `Vector2.UP` and `Vector2.ZERO` have none. The check passes them because ALL_CAPS is not a class name. I report this rather than adding a card kind. `PI` has its gd card.

### Per lesson
| Lesson | Explanation words (per chunk) | Cards | Pretest (3 best ranks) | Pictures | Sorva rows |
|---|---|---|---|---|---|
| 1 Nodes and Scenes | 607 (102+185+137+95+88) | 8: `Node2D`, `Control`, `Label`, gd node, scene, root node, main scene, `res://` | `Node2D`, `Control`, `Label` | `nodes_and_scenes_nodes`, `3d_scene_example`, `02_scene_dock`, `06_label_text`, `12_play_button`, `11_final_result` (compare) + Player drawing | 6 |
| 2 Creating instances | 594 (126+114+109+132+113) | 5: `RigidBody2D`, `PackedScene.instantiate`, gd instance, gd instantiate, `PhysicsMaterial` | `RigidBody2D`, `PackedScene.instantiate`, gd instance | `ball_scene`, `ball_instances_example`, `scene_link_button`, `property_revert_icon`, `diagram_shooter.png`, `main_scene_with_balls` (compare) + Ball drawing | 70, 79 |
| 3 Your first script | 636 (119+97+180+102+138) | 15: extends, func, var, print, `_init`, `_process` (gd and `Node._process`), delta, PI, `+=`, `Node2D.rotation`, `Node2D.position`, `Vector2`, `Vector2.rotated`, `CanvasItem` | extends, func, var | `attach_node_script`, `print_hello_world`, the two GIFs | 41, 15 |
| 4 Player input | 556 (108+94+114+100+140) | 5: `Input`, `Input.is_action_pressed`, if, true, `_unhandled_input` | if, true, `Input` | `moving_with_input.gif` (the page's only picture) | 3, 10 |
| 5 Using signals | 718 (162+114+96+189+157) | 19: `Area2D`, `Area2D.body_entered`, `_ready` (gd and `Node._ready`), `Timer`, `Timer.timeout`, `Timer.autostart`, `Button`, `BaseButton.pressed`, `Node.set_process`, `Node.is_processing`, `CanvasItem.visible`, not, false, signal, connect, emit, get_node, pass | `Area2D`, `Area2D.body_entered`, `_ready` | `12_node_connection`, `13_signals_connection_icon`, `15_scene_tree`, `17_custom_signal` + the Node2D/Sprite2D/Button drawing | 42, 136 |

- **Exercises.** Every lesson follows the same order:
  - two items on today's idea (a predict, then a typed blank);
  - the confusable:
    - lesson 1: `Node2D` / `Control` / `Node3D`;
    - lesson 2: `RigidBody2D` / `CharacterBody2D`;
    - lesson 3: `_init` / `_process`, a code fix;
    - lesson 4: the `Input` singleton / `_unhandled_input`;
    - lesson 5: the `pressed` signal / the `Button` node, plus `emit` / `connect` as a code fix;
  - two predicts that reuse an earlier lesson.
- **Typed blanks.** Lessons 1 and 2 have the blank in a quoted sentence (`Label`, `PackedScene`). Lessons 3–5 have it inside code (`rotation`, `is_action_pressed`, `connect`).
- **Errors from the pages.**
  - Lesson 1: the main scene vs current scene note, and the Save Scene As note.
  - Lesson 2: the PhysicsMaterial "Make Unique" note.
  - Lesson 3: the "Indented block expected" note.
  - Lesson 4: the comment-out step ("This will ignore the code that moved…"). It is the page's own sentence, though not a boxed note.
  - Lesson 5: the external-editor note.
- **Sorva rows not used:** 91, 7, 1 and 137. Row 132 ("a method only once") is lesson 5's third chunk check rather than an error.
- **The course-end table** sits in lesson 5's `table` field.
  - Rows `Node2D`, `Control`, `Node3D`; columns "draws on screen", "has a position", "lives in which tree".
  - Cells come from the class reference: CanvasItem's "Any CanvasItem can draw.", the Node2D and Control briefs, and Node3D's "Base object in 3D space" with VisualInstance3D's "Parent of all visual 3D nodes."
  - "Lives in which tree" is the same scene tree for all three. The 2D canvas or 3D world is the difference, which is the lesson 0 idea the table checks.

### The reveal table
- **State:** `src/courses/reveal.ts` (pure): `coveredTable`, `reveal`, `isShown`, `shownCount`, `allShown`. A tap outside the table, or on a cell already shown, leaves the state as it was.
- **View:** `src/ui/screens/reveal-table.ts`. There is one Inspector-like block per class: the editor icon and the name in code font. Each cell is a secondary Godot button, the column question plus "Tap to reveal".
  - Each cell is a disclosure: `aria-expanded`, `aria-controls`, and a visually hidden "(Node3D)" in its name. When opened, the answer shows under it with an accent edge, like a docs quote.
  - A status line counts "n of 9 cells shown."
  - It is a list of blocks, not a `<table>`. Three text columns cannot fit 320 px without sideways scroll.
- **Where it shows:**
  - in lesson 5's exit step, after the ticket and before Mark done, under "Course 1 in one table";
  - on the course list once lesson 5 is done. The cells start covered again there: the reveal state is never stored.

### Other changes
- **Code fix rows** (`.gv-choice--code`) keep their tab indent (`white-space: pre-wrap; tab-size: 4`). Without it, the body line of a fix looked like it sat at the function's level.
- **`gif` joined the precache globs**, so lesson 3's two animations and lesson 4's work offline. The precache is now 749 entries, 2.87 MB.

### Tests, screenshots and reports
- **Unit** (141, 18 files):
  - six written lessons, in page order;
  - lessons 1–5 each have the three exercise types and sourced errors (`Godot manual, …` or `Sorva 2012, Table A.1, row n`);
  - lesson 3 has a blank in code and a code fix;
  - every picture's pixel size, read with sharp, matches the lesson;
  - the table's content, and the reveal state.
  - The existing word-budget and term-check tests now cover all six lessons.
- **e2e** (31 tests, about 18 s):
  - "47" now checks six written lessons and no table yet;
  - "56" is lesson 3: chunk 0's code and its check; the blank in code with `Rotation` (case hint), then `rotation`; the code fix (line 3) and its fixed line; Mark done;
  - "57" is lesson 5: the table sits between the ticket and Mark done; nine covered cells; "has a position (Node3D)" opens; the status reads "1 of 9"; after Mark done the list shows the table, covered.
  - `axe.spec.ts` also audits "lesson with code" and "lesson with the course table". That makes 12 findings; the 2 new ones are the same Mark done blue. `docs/contrast-report.md` is unchanged.
- **Screenshots:** new `lesson-code.png` (lesson 3's "Every frame" code and its answered check), `lesson-blank-code.png` (`Rotation` with the case hint, the code fix under it) and `course-table.png` (Control covered, Node3D with two cells shown). All the others were retaken.
  - Compared with `docs/ui-reference/from-godot-docs/editor_ui_script_editor_coding_area.webp`, the code colours match.
  - The first take showed two faults, now fixed: the table heads fell back to the browser's monospace, and a wrapped "Tap to reveal" jumped to the left.
- **Preview server:** started once as `node node_modules/vite/bin/vite.js preview --port 4173 --strictPort` for the screenshots and stopped. The next `pnpm e2e` started its own on the same port.

### Gates
`pnpm typecheck`, `pnpm test` (141), `pnpm build` (term check included), `pnpm lint:css` and `pnpm e2e` (31/31) are green on the final tree.

### Deviations and why
1. **`LESSON_MEMBERS` instead of pinning classes or raising `MEMBER_CLASSES`.** Neither of those reaches a member past the alphabetical caps (see above).
2. **The pretest picks by raw `rank` across families.** GDScript and API ranks are separate scales, so lesson 3's pretest is extends, func, var, and lesson 4's is if, true, `Input`.
   - To keep `Input` in lesson 4's pretest, `false` is not one of lesson 4's cards. The manual's sentence is quoted up to "returns `true` if the action is pressed …" with an ellipsis, and `false` arrives with lesson 5.
   - A fix to rank within the API family first (or per-lesson pretest ids) is the CoS's call.
3. **The manual's "built-in ``Vector`` type"** (a slip on the player-input page; there is no `Vector` class) is quoted in plain text. In code font the term check would fail it as an uncarded class.
4. **Pictures with the Godot logo.**
   - Used: the three GIFs, which show the Godot icon, under the CoS's allowance.
   - Not used: `signals_09_scene_setup`, which shows the logo large. Lesson 5 uses a scene drawing and `signals_15_scene_tree` instead.
   - `icon.svg` is never copied.
5. **e2e between commits.** The lesson commits ran typecheck, the unit tests and the term check. `pnpm e2e` was red on "47" (it expected planned rows) from the lesson 1 commit until the e2e commit, and green from there on.
6. **Ellipses inside quotes:**
   - lesson 1: "The Godot editor essentially is a scene editor. … A Godot project can contain…";
   - lesson 2: "a `RigidBody2D` node … which allows…", in a check;
   - lesson 4: the cut above.
   These select from the page; they do not paraphrase it.
7. **The Node2D "draws on screen" cell says "It can"**, not "Yes". A bare `Node2D` draws nothing until it has something to draw. The class reference's sentence is "Any CanvasItem can draw."

## GV-7 — v1.2.1: safe areas in the Android app (2026-10-13)

Done-criteria 60. Five commits, none pushed, no tag.

### Cause
- Tyler's S24 (Android 15, gesture navigation): content under the camera cutout / status bar and under the navigation bar. The web version in Chrome was fine.
- `android/variables.gradle` targets SDK 36, and Android 15+ draws apps targeting 35+ edge to edge. `index.html` already had `viewport-fit=cover`, so the WebView filled the screen, but `#app` padded only the bottom by the inset and the top by a fixed 8px.

### The CSS (`src/ui/screens/screens.css`, `#app`)
- Four properties, one per edge: `--safe-top: max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))`, likewise right, bottom, left.
- Padding: top `8px + --safe-top`, right/left `--gutter + --safe-right/left` (landscape puts the cutout on a side), bottom `--gutter + --safe-bottom` (as before, plus the var).
- No element in `src/` is `position: fixed` or `sticky`, so the shell is the only thing to pad.
- With zero insets every value is what it was (8px / 16px), so the web build is unchanged.

### The config (`capacitor.config.ts`)
- `plugins.SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' }`, citing `node_modules/@capacitor/cli/dist/declarations.d.ts`. `'css'` is already the default; it is now explicit. `pnpm build:android` wrote both into `android/app/src/main/assets/capacitor.config.json`.

### Proven here, and what only the phone can prove
- e2e "safe areas: zero insets keep the shell as it was, injected insets pad every edge" (`tests/e2e/layout.spec.ts`): the shell's padding is 8/16/16/16 px with no insets. With `--safe-area-inset-*` set to 48/24/34/24 px on `:root` (what Capacitor injects), it becomes 56/40/50/40 px, and the app name moves down 48 px and right 24 px. The landscape, 320 px and 200 % layout tests still pass with zero insets.
- `pnpm build:android` and `pnpm android:debug` succeed: **`app-debug.apk`, 5,638,880 bytes** (12 s build).
- **Not proven:** that the S24's WebView reports the real insets and the content clears the cutout, status bar and gesture bar in portrait and landscape. That is the human check on the phone.

### Gates
`pnpm typecheck`, `pnpm test` (141), `pnpm build`, `pnpm lint:css` and `pnpm e2e` (32/32) green on the final tree.

### Deviations and why
1. **`max(env(…), var(…))` instead of `env(…, var(…))`.** Chromium always defines `env(safe-area-inset-*)` (as 0 in a browser), so a fallback inside `env()` is never used, and a browser test could not reach it. Capacitor 8.5.3's `SystemBars.java` injects the vars with the same values it passes to the WebView's insets, and sets both to 0 when it pads the WebView itself (Chromium < 140), so the larger of the two never pads twice.
2. **Top is `8px + inset`, not `max(8px, inset)`.** This keeps the app name 8px clear of the status bar instead of touching it, and the test then checks a move of the full inset.

## GV-8a — areas under the engine (2026-10-14)

Done-criteria 61–66. Nine commits (one per step of the brief), none pushed, no version bump (GV-8b bumps to 1.3.0). Every step committed with `typecheck`, `test`, `lint:css`, `build` and `e2e` green.

### What moved where
- **Look:** `src/theme/tokens.ts` (`ThemeTokens`, `applyTokens`, `godotTokens`) replaces `applyTheme` in `derive.ts`. `--font-ui`, `--font-code` and `color-scheme` left `kit.css` `:root` for the token map (the `@font-face` rules stay). `applyTokens(root, tokens, name)` writes every entry inline and names the map in `data-theme`; it keeps no module state, and since every map has the same key set, writing one map replaces the last entry for entry. The app applies the area's map on entering it (`enter()` in `src/ui/app.ts`), before the first paint at start; `main.ts` no longer applies a theme itself.
- **GitHub Desktop dark:** `src/theme/github-desktop.ts`. The full token → Desktop variable → Primer name → hex table is its doc comment. The four SCSS `darken`/`lighten` values were computed by hand and are re-derived in `tokens.test.ts` ("darken/lighten written as Sass computes them"): `darken($gray-900, 3%)` #1d2125, `lighten($gray-900, 3%)` #2b3137, `darken($gray-500, 10%)` #535a61, `lighten($gray-500, 3%)` #717b85. `_dark.scss` has a syntax section (`--syntax-*`), so the `--code-*` colours come from it. `scripts/lint-css.mjs` now allows colour literals in `src/theme/*.ts` only.
- **Registry:** `src/areas/registry.ts` holds `AREAS` (Godot first, then Git & GitHub) with labels, families, family labels, default budgets, vendor, unofficial line, docs-link wording, token map and a memoised `load()` (dynamic `import()` of the area's deck JSON and course JSON). `FAMILIES` (`cards/types.ts`) and `DEFAULT_SETTINGS.families` derive from it. Family traits that screens used to test by id (class icons, plain-name flips, language items, docs-link wording) are `familyTraits()` / `docsLabel` in the registry. `FAMILY_LABEL` (app.ts) and About's `DECKS` map are gone; About reads `src/data/deck-counts.json`, which `pnpm generate` now writes.
- **Sessions:** `SessionInput.area`; `plan()` filters to `familiesOf(area)` and gates on that area's overdue reviews only; `sessionSummary` returns `AreaSummary` (the area's families only) and counts due through the new exported `dueCount(progress, skipped, families, now)` (fed the progress of cards in the deck, so the count is what the session can ask, as before). `load(deps, area)`, `Session.start(deps, area, …)`, `overdueNote(summary, area)`; `Session.finish`'s "due tomorrow" counts the area only. `RunDeps.loadCards(area)` and the new optional `RunDeps.loadCourses(area)`. `session/deck.ts` imports no deck: `loadCards(area)` = the area's loader plus the learner's cards in its families; `loadAllCards()` for the skipped list. `cardsWaiting(loadedPerArea[], at)` sums every area, each with its own gate; `native.ts` loads every area.
- **Courses:** `Course.area` (`course-1.json`: `"godot"`; `validateCourse` checks it), `coursesFor(area)`, `findLesson(id, courses)`, `sessionLessons(courses)`. `COURSES` is gone (it was the static import that kept course 1 in the entry chunk).
- **UI:** `Nav.start(area?)`, `Nav.courses(area?)` (no argument = the area last entered, kept in `mountApp`); `Nav.lesson(id)` opens a lesson of that area. The start screen is titled with the area's label (was "Today"), lists its families only and carries its unofficial line under the panel. `document.title` is "<Area> · Godot Vocabulary". The app opens Godot.
- **Data:** see below.

### Temporary area links (remove in GV-8b)
The start screen's "More" row ends with a flat button for each *other* area (on Godot: "Git & GitHub"; on Git & GitHub: "Godot"), marked `// TODO(GV-8b): remove` in `src/ui/screens/start.ts`. They exist only so both areas are reachable until the home page, and so the e2e can enter the GitHub area (`openArea(page, 'Git & GitHub')` in `tests/e2e/helpers.ts`). The theme switch is instant; the wipe is GV-8b.

### Export v4 and what it tolerates
- `ExportFile.version: 4`; `Settings.areas: Record<AreaId, { newCardMode }>` replaces the global `newCardMode`. The reminder and (in GV-8b) the last-used area stay in IndexedDB `meta` and never enter the file; the round-trip test asserts it.
- `withDefaults` builds `families` and `areas` by looping over the registry, never over stored keys, so unknown entries drop and missing ones get defaults. A stored or imported global `newCardMode: 'course'` with no `areas` goes to `AREAS_WITH_COURSES_AT_V4` (`['godot']`, `settings/load.ts`), frequency elsewhere. This migrates a 1.2.x device's own saved settings too, not only files.
- `parseExport` reads versions 1–4 and builds a fresh object from the known parts only (unknown top-level keys and stores are ignored). An unknown area in `settings.areas` logs a `console.warn` and is dropped. Version > 4: "This file was made by a newer version of the app. Update the app, then import it." (`NEWER_FILE_MESSAGE`; the import screen shows it after "Nothing was imported."). A custom card must have a string id, prompt and answer, three string distractors, a numeric rank, and a family in `FAMILIES`, or the file is refused in plain words; the rest keep only `Card`'s fields (plus `custom: true`).
- Mark done calls `markDoneSettings(course.area)`. The settings screen's one **Lesson cards first** switch is untouched on screen (decision 52): it shows on when any area is in course mode and sets every area.

### The one behaviour change: the overdue gate per area
Decision 21 as amended: overdue reviews in one area no longer hold back new cards in another. Proven by `session.test.ts` "Godot offers new cards while only GitHub reviews are overdue (decision 21, amended)", `run.test.ts` "a GitHub session is not held back by an overdue Godot review", `reminder.test.ts` "gates each area on its own overdue reviews", e2e `overdue.spec.ts` "decision 21, amended…". (That a session holds one area's cards, not all three families, is the area model itself, decision 46.)

### What proves the rest is preserved
- `session.test.ts` "with every family on and nothing overdue, the Godot plan is today's mixed plan minus its GitHub cards" (the pre-area plan for that input, written out) and "the same holds on the real decks: the area plans split today's plan between them".
- Every existing unit test kept its assertion and only gained an area: per-family budgets, rank order, the member-after-class rule over two weeks of real sessions (now run per area each day), skips, course mode, interleaving (a 10/9 two-family session still never runs longer than two), summaries.
- `areas.test.ts` "keeps the default budgets (10 / 5 / 5)"; `tokens.test.ts` "keeps the Godot look"; e2e `areas.spec.ts` checks Godot still wears `#242424`, Inter and dark controls.
- The e2e suite: 32 → 41 tests, all green. Edited only where a flow needs an area: the start-screen title, GitHub stats/cards behind `openArea`, Godot-only counts (15 new cards, not 20), export version 4.

### Contrast and axe, per area
- `docs/contrast-report.md`: "## Godot" — text 5 of 49 short (unchanged), non-text 8 of 15 short; "## Git & GitHub" — text 14 of 49 short, including the accent on the base (2.71:1), non-text 10 of 15 short. Godot's ratios moved by up to 0.08 (e.g. disabled text on the base 3.13 → 3.18): the report now reads colours from the token map, which carries alpha at 8 bits (`#ffffff59`) instead of the defaults file's float; no pass/fail changed.
- `docs/axe-contrast.md`: "## Godot" (11 findings) and "## Git & GitHub" (7; start, card, card answered, summary, courses). The GitHub card is answered right so its feedback, and the report, are the same on every run (a red "Not quite" on GitHub's box colour is 3.54:1 and made the report flip between runs).
- `layout.spec.ts`: the Git & GitHub area (start, card, answered card, courses) at 360 px, 320 px, 320 px with 200 % text, landscape; WCAG 1.4.12 text spacing injected in both areas (every Godot screen, the GitHub screens). All pass.

### Bundle, for GV-8b's budget
`pnpm build`, before → after: the entry chunk `index-*.js` **1,753.42 kB → 98.75 kB** (gzip 283.43 → 32.66 kB). Loaded on demand now: `cards.godot-api` 1,337.07 kB (gzip 193.50), `cards.gdscript` 126.50 kB (22.11), `cards.github` 122.73 kB (14.52), `course-1` 74.62 kB (22.35). CSS 16.80 kB. Opening the Godot area fetches about 1.54 MB of deck and course on top of the entry; the 1 MB first-load budget (decision 55) is GV-8b's to write and must decide whether the Godot deck counts as "first load" now that the app opens the home page.

### Gates
`pnpm typecheck`, `pnpm test` (172), `pnpm lint:css`, `pnpm build` and `pnpm e2e` (41/41) green on the final tree; e2e run twice on step 8 to confirm both reports are stable.

### Deviations and why
1. **`applyTokens(root, tokens, name)` takes the map's name.** The brief's two-argument form has no way to name the map in `data-theme` without module state; the caller passes the area id.
2. **Step 4 carried part of step 6.** Making the session per area broke every e2e flow that met a GitHub card on the mixed start screen, and the gates had to be green at each commit. So step 4 already gave `startScreen` its area, `Nav.start(area)`, the temporary links and `openArea`; step 6 then did the title, the unofficial line, `document.title`, the token switch and the courses screen's area.
3. **About and `THIRD_PARTY_NOTICES.md` gained GitHub Desktop and Primer (MIT)**, though the brief named only the README. Their colours ship in the app since step 3, and decision 48 puts their licence in both places. The notices file carries the MIT permission text; putting that text on the About screen itself is left to GV-8b (decision 62's list).
4. **README:** besides lines 38, 81 and 88–95 and the areas sentence, line 36 (the overdue gate is per area) and the Godot API card count (855 → 861, stale since GV-6b) were corrected to keep it honest.
5. **`contrast_color_1` = `--box-border-contrast-color` (#717b85).** One Godot token draws both the field and switch edges and the secondary button's fill; Desktop uses #717b85 for the first and $gray-800 for the second. The edge won, as it is the one that must be seen; secondary button text on it is 4.31:1 and is listed.
6. **Courses screen in an area without courses** says "No courses in this area yet." rather than an empty screen.

## GV-8b — v1.3.0: the home page, the GitHub theme on screen, the wipe (2026-10-14)

Done-criteria 67–74. Nine steps, eight commits plus the Android sync (step 9), none pushed, no tag. Every commit had `typecheck`, `test`, `lint:css` (now with the DOM lint), `build` (now with the budget check) and `e2e` green.

### The screens
- **Home** (`src/ui/screens/home.ts`), in its own theme (`src/theme/home.ts`). Heading "Areas" (the `h2` that `show()` focuses), one `<button class="gv-tile">` per `AREAS` entry: the label (700, primary grey, 20 px), "N due" / "Nothing due", "3 of 6 lessons" / "No courses yet", and "Last used" on the area entered last, all as secondary text; the icon after the label in the DOM, drawn first with `order: -1`, `alt=""` and `aria-hidden`. The button's accessible name is the visible lines joined with commas ("Godot, Nothing due, 0 of 6 lessons, Last used"), so it starts with the label. Under the tiles: "Unofficial; not affiliated with or endorsed by the Godot Foundation or GitHub." and a "More" row with About only.
- **Tile figures** (`tileFigures`): the due count is `dueCount()` over the area's *enabled* families, skipped cards left out, read from progress rows only (no deck load). The lesson figure counts `lessonsDone` against the registry's new `Area.lessonIds` (the written lessons, so the home never loads a course; `areas.test.ts` checks the list against the course files). Unit test: with GDScript switched off and a due API card skipped, the tile says 3, the same as the area page's `sessionSummary` total.
- **Icons:** Godot = `public/icons/Node.svg` (the class icon already shipped; never the logo). Git & GitHub = Octicons' `git-branch-24.svg`; "All areas" = `arrow-left-24.svg`. Both Octicons are copied byte for byte to `public/octicons/` by `scripts/copy-shipped.mjs` (also run by `pnpm generate`; `shipped.test.ts` compares the bytes) and loaded as `<img src>`. Octicons are drawn in black, so `.gv-octicon` inverts them to white (`filter: invert(1)`): the files stay as they are.
- **Last used:** `getLastArea()` / `setLastArea()`, a `meta` key (`lastArea`) like the reminder: never exported, untouched by import (the GV-8a round-trip test now also sets it and checks it survives a replace import). Read back through `getArea()`, so a stored value the app does not know reads as none.
- **Area page** (`start.ts`): titled with the area label; families' counts and Start as before; "All areas" (Octicon + text) in its own `nav aria-label="Areas"` at the top left, apart from the "More" row (Courses, Settings, Add card, About), which is the same in every area. GV-8a's temporary links are gone (unit test on the source; e2e on the "More" row). Settings still lists every family's switches in both areas (decision 52: the settings session changes that).
- **Looks:** `wear()` in `app.ts` applies a token map, sets `<meta name="theme-color">` (new in `index.html`) to its `--base-color`, and sets `document.title` ("Areas · Godot Vocabulary" on the home, "<Area> · Godot Vocabulary" inside). `main.ts` applies the home theme before `mountApp`.
- **GitHub screenshots:** I looked at `create-commit-details.png`, `windows-sign-in-github.png` and `mac-preview-pull-request.png`, then at my own home, GitHub area page and GitHub settings (Playwright screenshots from a throwaway spec, deleted). The area already matches Desktop's shapes where the kit draws them: 6 px corners, a filled blue primary with white text, outlined fields, blue switches. **Not matched:** Desktop's secondary buttons are outlined, the kit's are filled with `--contrast-color-1`; the steppers' − / + show it most. Changing it would change the measured pairs (GV-8a deviation 5), so it is left for a later session.

### Navigation and Back (`src/ui/app.ts`)
- Every screen change pushes one entry, `history.pushState({ screen, area?, lesson?, index, page }, '')`; `index` is the position in this page's history (0 = the home page, which `mountApp` writes with `replaceState`), `page` a random id per page load.
- The on-screen Back (every screen's), the summary's Done, the lesson's Back to courses and Mark done call `nav.back()` = `history.back()`; `popstate` draws the screen the entry records. So the phone's Back and the on-screen Back walk the same entries: Courses → area page → home. "All areas" (and the reminder) call `nav.home()` = `history.go(-index)`, back to entry 0, so after it the phone's Back leaves the app instead of returning to the area.
- About records the area of the screen that opened it (none on the home), so it wears that theme and Back returns there.
- A session's card cannot be redrawn: Start pushes one `session` entry, the cards replace each other without entries, the summary replaces it with `summary`. Back from a card or the summary lands on the area page and finishes the session (`finish()` sets the last-session date as End session does); a forward step onto a `session`/`summary` entry draws the area page instead.
- Entries read back go through `readEntry()`: an unknown screen, an area `getArea()` does not know, a lesson id that is not a plain id, or an entry left by an earlier page load all read as the home page (`history.test.ts`). The app always opens the home page, whatever entry a reload left.
- **The reminder:** `restoreReminder(openHome)` listens for `localNotificationActionPerformed` on the reminder's id and calls `nav.home()` (unit test with a stand-in plugin, `native.test.ts`). A cold start opens the home anyway (e2e: a reload while on Courses lands on the home page).

### The wipe (`src/ui/transition.ts`)
- `shouldAnimate(supported, reducedMotion)` = supported and not reduced (unit-tested). `switchTheme(apply, origin?)`: without the API, or under `prefers-reduced-motion: reduce`, it just calls `apply()`. Otherwise `document.startViewTransition(apply)`, then on `ready` the Web Animations API animates `::view-transition-new(root)` from `clip-path: circle(0px at x y)` to a circle reaching the farthest corner, 300 ms `ease-in`. `kit.css` turns off the default cross-fade (`animation: none; mix-blend-mode: normal` on old and new) and puts the new view on top (`z-index: 1`).
- **Load before wipe:** a tile tap sets `aria-busy` (the pressed grey) and appends "Loading…" at once, synchronously in the click handler. `nav.area(id, origin)` then pushes the entry and `draw()` builds the screen: `startScreen` awaits the area's `load()` (deck and courses) and builds the page; then `fontsFor()` waits for the area's font faces (`document.fonts.load` for Inter 400/700 and JetBrains Mono in Godot; nothing to fetch for system fonts), so the first Godot entry has no font swap mid-wipe; only then `switchTheme`. `apply` only sets the tokens and replaces the screen. Every theme change takes the same path, Back included (area → home wipes from the viewport's centre).
- **During a switch** (from the tap to `finished`) tile taps, on-screen Back and All areas are ignored; a phone Back pressed meanwhile cannot be cancelled, so it is applied once the switch has finished. The tile also ignores its own second tap.
- The root carries `data-switching` until `finished` resolves and `data-switched="wipe" | "instant"` after; the e2e waits on the first and reads the second. During a transition the browser hit-tests the view-transition overlay, so the e2e helpers (`startReady`, `homeReady`, `screenReady`) now wait for `data-switching` to clear before acting.

### The first-load budget (decision 55)
- `scripts/check-budget.mjs`, run by `pnpm build` after `vite build` (`build.manifest: true` in `vite.config.ts`; `dist/.vite/` is not precached, 755 entries before and after). It counts `index.html`, the local files it names (entry script and style, `registerSW.js`, `manifest.webmanifest`, `app-icon.svg`) and the entry's static closure from the build manifest (`imports`, `css`, recursively; `dynamicImports` excluded), in raw bytes on disk; it fails above 1,000,000 bytes or when a `src/data/cards.*.json` or `src/data/courses/course-*.json` chunk is in that closure.
- **First run (step 4, before anything else changed): 125,845 bytes** — entry JS 105,755, CSS 18,089, `index.html` 925, web manifest 547, icon 361, `registerSW.js` 168. (A run seconds earlier printed 124,769: the script then missed the files `index.html` names under the `/godot-vocabulary/` base; fixed before it was wired in.)
- **Forced failure:** `node scripts/check-budget.mjs --limit 100000` printed the same table and "FAIL: the first load is 125,845 bytes, over the 100,000-byte budget", exit 1.
- **At the end of the session: 127,752 bytes** (About's MIT text and the home code).
- **Not counted:** the home tiles' two icons (`Node.svg` 145 bytes, `git-branch-24.svg` 671 bytes), fetched by `<img>` after the page runs, and no font (the home uses the system font).
- **Per area, raw bytes, loaded on the first tap:** Godot 1,538,203 (`cards.godot-api` 1,337,071 + `cards.gdscript` 126,503 + `course-1` 74,629); Git & GitHub 122,732 (`cards.github`).
- **Tap to title, first open** (headless Chromium, local preview server, eight workers, from `wipe.spec.ts`): Godot about 105–123 ms to the title in the page, 407–437 ms to the wipe's end; Git & GitHub 45–117 ms and 374–421 ms, across the session's runs.
- The service worker still precaches everything, so the app is offline after the first load as before.

### Notices
- About shows the MIT permission notice once, in full (three paragraphs, `MIT_PERMISSION`), under "The MIT licence's permission notice"; every row whose work says "MIT licence" adds "Under the MIT licence; its permission notice is below." Octicons (`Copyright (c) 2026 GitHub Inc.`), Primer (`Copyright (c) 2018 GitHub Inc.`) and GitHub Desktop (`Copyright (c) GitHub, Inc.`) are copied from their licence files; `about.test.ts` compares each with the `Copyright` line of `public/licenses/LICENSE-*.txt` and the permission text word for word. The three licence files ship in `public/licenses/` (like the font licences, not precached). The CC BY 4.0 row gains `https://github.com/github/docs/blob/ae648a1d/data/glossaries/external.yml` and "Provided as-is, no warranties."
- About's disclosure paragraph, with a separate "Contrast report" link beside "Source code on GitHub" (an inline link would be under 44 px tall).

### Gates for the home and every area
- `docs/contrast-report.md` "## Home": 0 of 19 text pairs and 0 of 10 non-text pairs short; `contrast.test.ts` fails if either count is not 0. The tile border moved from `--contrast-color-1` (grey 4, 2.50:1 on the pressed tile) to `--contrast-color-2` (grey 6, 4.67:1 on it).
- axe: the home page and About opened from it with `color-contrast` failing; `docs/axe-contrast.md` "## Home": 0 findings, required by the spec. The Git & GitHub walk adds settings, add card and About (findings 7 → 25, all from those three screens; Godot unchanged at 11). Run twice; the report is stable.
- Layout: the home page and About from it at 360 px, 320 px, 320 px with 200 % text, landscape and with WCAG text spacing; the GitHub walk adds settings, add card and About.
- `scripts/lint-dom.mjs` (run by `pnpm lint:css`) fails on `innerHTML` / `outerHTML` assignments and `insertAdjacentHTML` calls under `src/`; there were none. Seen failing once on a planted file, which was then deleted.

### The Chief of Staff's calls, as built (open to Tyler's veto)
1. The home theme is dark: ten fixed greys, three text roles (primary #e6e6e6, secondary #b8b8b8, tertiary #a6a6a6), no accent fills (`--accent-color` is the primary grey, so headings, links and the focus ring are grey), 4 px corners, `system-ui, sans-serif`.
2. Tile icons: Godot's `Node` class icon; Octicons' `git-branch-24`. Loaded with `<img src>`.
3. Tile text: label primary 700; due, lessons and "Last used" as secondary grey text, no badge; label first in the DOM; icon `aria-hidden`; the name starts with the label.
4. Home heading "Areas"; the app name stays in the shell; "All areas" top left with `arrow-left-24`.
5. One history entry per screen change and `popstate` draws the recorded screen; ids from history and the last-used key go through `getArea()` and fall back to the home.
6. `main.ts` applies the home theme before `mountApp`.

### Security considerations
The app has no server and no account, so its trust boundaries are the few places data comes in from outside the running code. **The import file** is the main one: `parseExport` reads only the known parts of a version 1–4 file, checks every record's shape, refuses a newer version and unknown families in plain words, and keeps only `Card`'s fields of a custom card; nothing from a file is ever parsed as HTML (every screen builds the DOM with `el()` and `textContent`, and the new DOM lint keeps it that way). **Values read back from device storage and history state** (the last-used area, the reminder, `history.state` after Back or a reload) are treated as untrusted too: they pass through `getArea()`, `readEntry()` or the reminder's shape check, and anything unknown falls back to the home page or the default. **The update channel** is GitHub: the web app comes from GitHub Pages over HTTPS and the APK from GitHub Releases, signed with a key that is only in the repository's secrets; About links to Releases and the app never checks by itself. The phone's owner may change anything in their own copy (edit IndexedDB, hand-craft a file, patch the APK); that is their right on their own device, so no anti-tamper is ever built, and the checks above exist so a damaged file or stale entry fails safely, not to stop the owner. The one point of compromise is the publishing account: whoever controls talex444 on GitHub (and the signing secrets) controls what every install runs next, so that account's two-factor sign-in and the secrets are what protect users.

### What only the phone can prove
Done-criteria 73's four checks: the hardware Back stepping one screen through the WebView's history (Capacitor goes back while the WebView can, and closes the app from the home page); the wipe on the S24 and no font jump on the first Godot entry; the status bar following `theme-color` in the installed app (Chrome on Android honours it; the Capacitor WebView's status bar may follow the SystemBars plugin instead, which the phone will show); and a fresh install's home page. Also the reminder's tap bringing a running app to the home page.

### Gates
`pnpm typecheck`, `pnpm test` (192 tests), `pnpm lint:css` (colour and DOM lints), `pnpm build` (budget 127,752 of 1,000,000 bytes) and `pnpm e2e` (60/60) green on the final tree. The debug APK size from step 9 is in the session's final report.

### Deviations and why
1. **The release note's old-app message.** The brief's wording has an older app say the file "was made by a newer version". That message exists only from 1.3.0 on; a 1.2.x app refuses a version 4 file with "Not a godot-vocabulary export (version 1, 2 or 3)." The release note and README say what each version actually shows.
2. **`Nav.area` resolves a promise and takes the tap point**, and `Nav.courses()` / `Nav.lesson()` take no area: the screens open within the current entry's area, so the argument had no caller left.
3. **The e2e waits for `data-switching` to clear.** The brief asked to await the transition's `finished` promise; the page cannot hand that promise to Playwright, so the app clears the attribute when it resolves and the test waits on that.
4. **Session screens are one history entry**, not one per card (a card cannot be redrawn from history); Back from a card finishes the session and shows the area page.
5. **Tile border on `--contrast-color-2`**, not `--contrast-color-1`, so it holds 3:1 against the pressed tile (see the gates above).
6. **`vite.config.ts` writes the home's base colour as a literal** (`HOME_BASE_COLOR`), held equal to `homeTokens()` and `index.html`'s `theme-color` by a unit test: importing `src/theme/home.ts` into the config drew a Vite warning about extensionless imports. The manifest's `background_color` (the splash) follows it too, since the app opens on the home page.
7. **The GitHub area's secondary buttons stay filled** (see the screenshots paragraph above).
8. **`scripts/screenshot.mjs`** now opens through the home page (and shoots `home.png`) with reduced motion; it was not run this session (it needs a preview server, which this session does not start). Its GitHub skip shot has not matched since GV-8a made sessions per area; left as it is.

## GV-8c — v1.3.1: the home page: one warm colour, balanced tiles, words that say what to do next (2026-10-14)

Done-criteria 75–77, decisions 63 and 64. Five commits plus this one, none pushed, no tag: `feat(home): warm greys and one action colour`, `feat(home): due figure on the right, chevron, quieter heading, app glyph`, `feat(home): next lesson and today line; colour means do this next`, `test: home states and tile layout at 320 px`, `chore(release): version 1.3.1`. Every commit had `typecheck`, `test`, `lint:css`, `build` (with the budget check) and `e2e` green, with one narrowing: the test commit's last edit (the "spilling" check in the tile layout test) was run with `layout.spec.ts` alone against the same build, and the full suite ran green again before the version commit.

### The greys and the amber (`src/theme/home.ts`)
- **Ten greys rebuilt** in CIELAB LCh with a slight warm tint toward the amber's hue (chroma 1.6, hue 70°): the four surfaces step evenly by 5.5 L* from L* 7, the six inks by 10.4 L* from L* 48 up to white. #171513, #22201e, #2e2c2a, #3a3836 | #74726f, #8f8c8a, #aaa7a5, #c6c4c1, #e4e1de, #ffffff. The one gap (L* 24 → 48) is where the roles need it: tertiary text must hold 4.5:1 on the pressed tile (4.88:1) and white must hold 4.5:1 on the secondary button's fill (4.80:1), so the darkest ink cannot come down and the lightest surface cannot go up. 1.3.0's uneven darks (#161616 → #3a3a3a in growing steps) and the bunching of g4–g7 (#767676 to #b8b8b8, then a long step to #e6e6e6) are gone.
- The base colour moved from #161616 to #171513, so `vite.config.ts` (`HOME_BASE_COLOR`, the manifest's theme and background colour), `index.html`'s `theme-color` and four e2e specs moved with it.
- **The amber: `--home-action-color` #d59526** (HSL 38° 70% 49%). Chosen by bisecting HSL lightness at hues 36–42° and saturations 60–90 % for the darkest value that holds 4.5:1 on all four surfaces; every candidate lands at the same luminance (the pressed tile sets the floor), so the pick was the hue and saturation: 38° / 70 % reads amber, not orange (36°) or mustard (42°), and not neon (90 %). **Ratios: 7.07:1 on the page, 6.31:1 on a tile, 5.40:1 on a hovered tile, 4.53:1 on a pressed one.**
- It is its own role token; `--accent-color` stays the primary grey, so the heading, links and focus ring stay grey. The area maps write `--home-action-color: unset` (`HOME_ONLY` in `tokens.ts`), so every map keeps one key set and the amber never lingers inside an area.
- Corner radius 4 px → 6 px.
- `docs/contrast-report.md` "## Home": 0 of 23 text pairs short (the amber on all four surfaces added), 0 of 14 non-text (the chevron on all four surfaces added). Still a hard gate.

### The tile (`src/ui/screens/home.ts`, `screens.css`)
- A four-column grid: icon (32 px) | label and lines | due figure and "Last used" | chevron (16 px). The DOM is 1.3.0's: label, figure, lines, tag, then the icon and chevron; `.gv-tile__text` is `display: contents` so its children are the tile's grid items, the label, figure and tag are placed by grid area, and the lines fill column 2 from row 2 down. The accessible name is built by `tileName()` exactly as 1.3.0 built it ("Godot, Nothing due, 0 of 6 lessons, Last used"), unit-tested and e2e-tested.
- The figure: 1.5rem (the label is 1.25rem), 700, tabular numbers, `nowrap`, baseline-aligned with the label. The lessons line and "Loading…" are tertiary; "Last used" is secondary, under the figure.
- **Icons as masks.** The Godot glyph (`public/app-glyph-grey.svg`), `git-branch-24` and `chevron-right-16` are drawn as CSS masks over `--font-secondary-color`, the URL set on the element as `--glyph` with the CSSOM (no inline HTML), so they take the token's warm grey exactly; a filter on a black Octicon can only make a neutral grey. The Octicons stay byte for byte (`copy-shipped.mjs` gained the chevron; `shipped.test.ts` checks it). `.gv-octicon`'s white inversion stays for "All areas" inside the areas.
- **The grey glyph:** `app-icon.svg`'s rounded-rectangle and check-mark paths unchanged, the background square and the card's fill dropped, both strokes in the secondary grey (#c6c4c1, unit-tested against the token), the blue gone, the viewBox cropped to the card (80 80 352 352), and the card's outline 24 units instead of 8 so it does not vanish at 32 px (8 units would be 0.7 px).
- **Large text:** each tile's `li` is an inline-size container; below 16em (at 320 px that is 200 % text, also 150 %) the icon hides and the text stacks in one column in DOM order (label, figure, Next, lessons, tag) beside the chevron, so the label and figure never squeeze each other.
- The "Areas" heading: secondary grey, 1rem (one rule, `.gv-home .gv-heading`).

### The words and the colour (`tileView`, `todayText`)
- `tileView()` returns what a tile shows and which text carries the colour; `tile()` only builds it, so the four states are unit-tested in node. Due > 0: the figure "N due" is amber. Due 0 with courses: "Next: Lesson N" under the label is amber. "All lessons done" (every lesson done, nothing due) stays grey: nothing to do next (decision 64: "a tile with nothing to do … stays grey"). No courses: nothing amber.
- **"0 due" or no figure:** I kept **"0 due" in tertiary grey**. With no figure the right column holds only the chevron, which is the bare right side Tyler named; "0 due" keeps the column's weight while the amber Next line stays the one thing that stands out. (Seen in a screenshot at 360 px: the grey "0 due" is large but quieter than the amber line.)
- **N is the course list's number:** `Area.lessons` (renamed from `lessonIds`) carries each written lesson's id and `order`, so the home names the lesson without loading a course; `areas.test.ts` checks both against the course file. The first lesson is order 0, so a fresh install reads **"Next: Lesson 0"** and "Nothing due today. Next: Godot, Lesson 0.", matching "Lesson 0: What is a Godot game made of when it runs?" in the course list. The brief's examples say "Lesson 1"; I followed its rule ("use the lesson's `order` number").
- The today line (`.gv-today`, secondary grey, plain `<p>` under the heading): any due → "12 due in Godot. 3 due in Git & GitHub." (areas with reviews only); else the first area with a next lesson → "Nothing due today. Next: Godot, Lesson 0."; else "Nothing due today.". No greeting, streak or counter (a unit test reads the source without comments).
- Screen readers hear each tile as in 1.3.0 (decision 63 keeps the name); the today line is where the next step is said in words outside the tiles.

### Gates
- `pnpm test` 203 tests; `pnpm e2e` 62 tests (60 + "nothing due: one plain line names the next step…" in `areas.spec.ts` and "the home tiles at 360 and 320 px…" in `layout.spec.ts`; the latter checks fresh and both-due tiles at 360 and 320 px and at 320 px with 200 % text: the figure on one line, no part overlapping another, wider than its place or outside the tile, and runs the home layout checks in the both-due state). axe on the home page with `color-contrast` failing: unchanged, 0 findings (`docs/axe-contrast.md` did not change).
- **Budget:** 129,992 of 1,000,000 bytes (127,846 after step 1; the tile CSS and view code add about 2 KB). The new SVGs (`app-glyph-grey.svg` 311 bytes, `chevron-right-16.svg` 261 bytes) load after the page runs, so they are not counted; the precache grew from 755 to 757 entries.
- I looked at the home in throwaway Playwright screenshots (fresh and both-due, 360 and 320 px, 320 px at 200 %); the spec was deleted before committing.

### What only the phone can prove
Done-criteria 77's phone check: the four states on the S24 (fresh install; one area due; both due; "no courses" is not reachable with course 1 shipped, so it rests on the unit test) and Tyler's "tasteful" bound: whether #d59526 reads as warm amber on the S24's OLED or drifts toward orange or mustard, whether the warm tint in the greys is felt at all or reads as muddy, and whether the large grey "0 due" competes with the amber Next line. Also: the masks drawing the glyphs in the Android WebView (Chromium supports unprefixed `mask`; the `-webkit-` form is there too), and the status bar taking the new base #171513.

### Deviations and why
1. **The grey glyph is `public/app-glyph-grey.svg`, not `public/icons/app-glyph-grey.svg`:** `scripts/generate-api-cards.mjs` deletes and rebuilds `public/icons/` on every `pnpm generate`, which would delete a hand-made file there.
2. **The glyph's outline is thicker** than `app-icon.svg`'s (24 units, not 8) and the viewBox is cropped; the paths are the same.
3. **Icons and the chevron are CSS masks, not `<img>`**, so they match the secondary grey exactly (see the tile above); the e2e now counts four `aria-hidden` glyphs instead of two images.
4. **"Next: Lesson 0", not "Lesson 1"**, on a fresh install (see the words above).
5. **"All lessons done" is grey**, though the brief lists it with the amber line: decision 64 keeps a tile with nothing to do grey.
6. **The figure reads "0 due" from step 2 on**, a step early: "Nothing due" as a 1.5rem figure squeezed the label to a letter per line at 320 px.

### GV-8d — four review fixes inside 1.3.1 (2026-10-14)
The board reviewed the built 1.3.1 home from screenshots; Tyler agreed four fixes before it ships, so they land inside 1.3.1 (no version bump). Four commits, each with `typecheck`, `test`, `lint:css`, `build` and `e2e` green: `fix(home): a zero due figure is quiet`, `fix(home): tile name matches the words on screen`, `fix(home): packedscene icon on the godot tile`, `fix(home): underline the about link`.
1. **A zero figure is quiet** (`.gv-tile__figure--quiet`, `TileView.figure.quiet`): "0 due" keeps its place on the right above "Last used" but takes the lessons line's size and weight (1rem, 400) in the tertiary grey; only counts above zero are large and bold. Why: three seats saw the bold zero outrank the amber Next line on a fresh install (Schell Lens #66; RUI ch. 2; Krug ch. 3). The tertiary grey at 1rem was already in the hard gate. The four-state unit test asserts `quiet`; e2e `areas.spec.ts` checks the zero figure computes the lessons line's size, weight and colour.
2. **The tile announces the words it shows**: `tileView()` builds the name from the visible text in reading order: label, figure as shown, the Next or "All lessons done" line, the lessons line, "Last used" ("Godot, 0 due, Next: Lesson 0, 0 of 6 lessons"); `tileName()` returns it and `dueText()` ("Nothing due") is gone. Why: the name said "Nothing due" where the screen said "0 due" and left out the Next line (WCAG 2.5.3, label in name). This is the one intended change to the name since 1.3.0. "Loading…" no longer goes into the `aria-label`: a visually hidden `role="status"` line on the home says "Loading Godot…" (e2e `wipe.spec.ts` checks it and that the name is unchanged); the visible "Loading…" line on the tile stays.
3. **The Godot tile's icon is `icons/PackedScene.svg`**, Godot's own class icon (MIT, already shipped as the PackedScene card's icon, so `pnpm generate` keeps it), masked in the secondary grey like the branch icon; `public/app-glyph-grey.svg` is deleted (precache 757 → 756 entries). Why: two seats read the app glyph as a ticked checkbox beside "0 of 6 lessons". This also undoes deviations 1 and 2 above.
4. **About is underlined on the home** in its own grey (`text-decoration-color: currentcolor`), its 44 px target unchanged. Why: a flat grey word does not show it opens (About Face ch. 19, static hinting).
"Lesson 0" stays (Tyler: "personally i like it"). Decision 63's text still says the Godot icon is the app glyph and the name is unchanged; these fixes amend it, and the row was left for the Chief of Staff to update.
