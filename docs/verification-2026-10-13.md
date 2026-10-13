# Independent verification against the done criteria — 2026-10-13

- **Commit verified:** `708bfb3cd8779a51bb7b2dc7ac411b1d993ef05f` (`docs: session gv-3 notes`), working tree clean.
- **Verifier:** a fresh session (GV-VERIFY) that did not build the app. Inputs: `docs/done-criteria.md` and the repository. `docs/session-notes.md` was not read.
- **Environment:** Windows 11, Node 22.22.3, pnpm 11.9.0, Playwright Chromium, `phone` project (360×780).
- **Method:** I ran every gate myself, read the unit and e2e specs that claim each item, and checked the generated data with one-off `node -e` scripts. I also wrote a throwaway spec (`tests/e2e/verify-gv.spec.ts`, deleted before this commit) that measured every screen and answered 30 cards in a row.

## Gate results

| Command | Exit | Tail of output |
|---|---|---|
| `pnpm install --frozen-lockfile` | 0 | `Already up to date` / `Done in 434ms using pnpm v11.9.0` |
| `pnpm typecheck` | 0 | `$ tsc --noEmit` (no diagnostics) |
| `pnpm test` | 0 | `Test Files  14 passed (14)` / `Tests  83 passed (83)` |
| `pnpm lint:css` | 0 | `lint:css: no colour literals outside src/theme/derive.ts` |
| `pnpm build` | 0 | `PWA v2.0.0 mode generateSW precache 691 entries (1136.71 KiB)`, `dist/sw.js`, `dist/manifest.webmanifest`. One warning: the JS chunk is 711.54 kB, over Vite's 500 kB hint (not a gate). |
| `pnpm e2e` | 0 | `22 passed (10.2s)` |
| `pnpm generate` (1st) | 0 | `godot-api: 431 class cards (26 tutorial classes pinned), 455 member cards` / `github: 96 term cards` / `gdscript: 120 cards` / icons |
| `git status --short` | 0 | (empty) |
| `pnpm generate` (2nd) | 0 | identical output |
| `git status --short` | 0 | (empty): both runs are byte-identical to the committed files |
| Verifier spec `pnpm exec playwright test --config playwright.config.ts tests/e2e/verify-gv.spec.ts` | 0 | `1 passed (5.3s)` on the second run. The first run timed out because of a bug in my own spec (it waited for "Next" on a card it had not yet answered), not because of the app. |

## Per-item verdicts

| # | Verdict | Evidence | Note |
|---|---|---|---|
| 1 | PASS | `dist/manifest.webmanifest`: `name "Godot Vocabulary"`, `short_name "GodotVocab"`, `start_url`/`scope` `/godot-vocabulary/`, `display "standalone"`, `theme_color "#242424"` (= `base_color` in `data/theme/godot-4.7-defaults.json:4`), icons 192 and 512 (+ maskable 512). Built CSS fonts resolve to `/godot-vocabulary/fonts/…`. e2e `install-offline.spec.ts:9 › installs, runs offline and keeps progress…` ok: it asserts `navigator.serviceWorker.ready.active` and a controlling SW. | |
| 2 | PASS (browser) / NOT VERIFIABLE HERE (device) | The same e2e test calls `context.setOffline(true)`, reloads, answers a card and reaches the summary with `Cards seen 1`. | A human must still try it in airplane mode on the phone. |
| 3 | PASS (browser) | The same e2e test closes the page, opens a new one with the network still off, and asserts identical Due/New/Overdue per family, GitHub new-per-day `6`, and the custom card `rebase` still listed. | The real app-close on Android is a human check. |
| 4 | PASS | e2e `session.spec.ts:20 › 4: Start shows due, new and overdue per family and one Start button` ok; `docs/screenshots/start.png`. | |
| 5 | PASS | e2e `session.spec.ts:28` (four choices), `:40 › an API class card shows the class icon beside every choice`, `:54 › a language snippet card renders code in JetBrains Mono with syntax colours` all ok; unit `tokenizer.test.ts` 4/4. My spec found `.gv-choice` count = 4 on all 30 cards it answered. | |
| 6 | PASS | e2e `session.spec.ts:64 › 6: one tap locks all four, marks it, reveals the answer, explains, and offers Next` ok. My spec found 0 enabled choices after each of 30 answers (no second guess). Screenshot `card-answered.png` shows "Your answer" / "Correct answer" and the explanation. | |
| 7 | PASS | unit `fsrs.test.ts › pushes due later after a correct answer than after a wrong one`, `› follows the library numbers: 10-minute step, then 2 days, then 11 days`, `› sends a wrong answer after correct ones to Relearning…` all ✓. | |
| 8 | PASS | e2e `session.spec.ts:28 › 5, 8: a new card is a question…` ok. On a fresh install (all cards new), my spec found all four choices enabled before answering on every one of 30 cards. | |
| 9 | PASS | unit `session.test.ts › interleaving › mixes reviews and new cards from every family, never grouped by family` ✓. My spec's run order: `GitHub \| Godot API \| GitHub \| Godot API \| … GDScript \| Godot API …` | |
| 10 | PASS | unit `session.test.ts › introduces the first newPerDay unseen cards of each family, in rank order`, `› holds a member card back until its class card was seen in an earlier session`, `› never shows an API member before its class over two weeks of real sessions` ✓; `deck.test.ts › points every requires at an existing card that ranks earlier` ✓. | |
| 11 | PASS | unit `session.test.ts › introduces zero new cards while any review is overdue` and `› lets new cards back in once the overdue set is cleared` ✓; `fsrs.test.ts › isOverdue compares with local midnight` ✓; e2e `overdue.spec.ts:10 › with one overdue review, the session is that review first, then new cards follow` ok. | New cards join the same session once the overdue set is cleared (`run.test.ts › asks overdue reviews first and appends new cards once they are cleared`). That fits the wording "until the overdue set is cleared". |
| 12 | PASS | e2e `session.spec.ts:86 › 12: the summary shows cards seen, right, wrong and due tomorrow` ok. My spec's summary read `Session done Cards seen 8 Right 4 Wrong 4 Due tomorrow 4`. | Right/Wrong count each card once (its first answer in the session); cards answered again in the same session are not counted twice. |
| 13 | PASS | Two `pnpm generate` runs; `git status --short` was empty after each (table above). | |
| 14 | PASS | `node -e` over `data/class-frequency.json` and `src/data/cards.godot-api.json`: `used 430 classcards 431 missing 0`. unit `deck.test.ts › gives member cards to the top 40 classes…` and `› ranks the first-2D-game tutorial classes before every other class` ✓ (rank 0 = `Area2D`). | Among the top-ranked classes, six get no member cards because the class reference gives them no members of their own (`float`, `int`, `bool`, `VBoxContainer`, `HBoxContainer`, `StandardMaterial3D`). The test spells this out, and at least 40 classes still have member cards. |
| 15 | PASS | unit `bbcode.test.ts` 7/7 ✓, including `› leaves no raw tags in a real description`. My scan of all API and GitHub prompts and explanations for `[member`/`[method`/`[code]`/`[b]`/`[i]`/`[url`: `rawBBCode 0`. | |
| 16 | PASS | `data/cards/gdscript.json`: 120 cards; kinds `keyword 36, builtin 23, concept 27, operator 14, annotation 10, lifecycle 10`; all 120 have a `source.ref` with a `#section` anchor (e.g. `gdscript_basics#Inheritance`); 16 sources point at scene/node pages. unit `gdscript.test.ts › has at least 100 cards covering every kind` ✓. | |
| 17 | PASS | `scripts/generate-github-cards.mjs:40-47` reads `data/sources/github/glossary.yml` and walks `scripts/github-terms-allowlist.json`; `:23-26` resolves `{% data … %}` and returns null (skips the entry) if any Liquid is left. My scan of `cards.github.json`: `github 96 rawLiquid 0`. | |
| 18 | PASS | unit `deck.test.ts › gives every card four distinct choices with the answer among them once` ✓ (whole generated deck). | |
| 19 | PASS | e2e `data.spec.ts:33 › settings switches and steppers persist; totals, projection and the above-twenty warning` ok; unit `settings.test.ts › warns only above twenty, and still accepts the value` ✓. `grep -i retention src/ui` finds nothing; my spec found no "retention" text on any screen. Screenshot `settings-warning.png`: 21 per day, "about 210" reviews, plain-words warning. | |
| 20 | PASS | unit `custom-card.test.ts` 6/6 ✓, including `› is offered as a new card by the session builder`; e2e `data.spec.ts:65 › add a card, export, then a fresh install imports it all back with replace` ok. | |
| 21 | PASS | The same e2e test, plus unit `file.test.ts › restores progress, settings and custom cards on a fresh device…` and `store.test.ts › restores everything on a fresh install (replace)` ✓. | |
| 22 | PASS | e2e `about.spec.ts:18 › About carries every attribution, the unofficial statement and the repository link` ok; unit `about.test.ts` 2/2 ✓; `src/ui/screens/about.ts:10` `REPO_URL = 'https://github.com/talex444/godot-vocabulary'`; screenshot `about.png`. | |
| 23 | PASS | `pnpm lint:css` (also step `deploy.yml:32` in CI). My grep for `#hex`/`rgb(`/`hsl(` in `src/` outside `src/theme/` found none (the only hits outside are `from_ok_hsl()` card text). unit `theme.test.ts › matches every derived value recorded in the defaults file` ✓. | |
| 24 | PASS | `public/fonts/Inter_Regular.woff2`, `Inter_Bold.woff2`, `JetBrainsMono_Regular.woff2` with `LICENSE.Inter.txt`, `LICENSE.JetBrainsMono.txt` tracked; `src/ui/kit.css:7-25` `@font-face`. My spec: body `font-family` = `Inter, system-ui, sans-serif` on every screen. | |
| 25 | PASS | e2e `layout.spec.ts:109 › 360×780 portrait: no horizontal scroll, every target 44×44, text at least 16 px` ok. My spec on start/settings/add card/about/card/card answered/summary: `scroll 0`, gutters `16`/`16`, `minH 44`, `small 0`. | |
| 26 | PASS | All four gates exit 0 (table above). README headings: "Install it on your phone", "Add your own cards", "Export and import", "Licences and attributions". | |
| 27 | PASS | e2e `axe.spec.ts:75 › every screen passes axe (WCAG 2.2 AA) apart from reported contrast` ok. It runs the five required tags with `color-contrast` disabled on start, settings (plus warning and import choice), each family's card before and after answering, summary, add card (plus errors) and about. It then writes the contrast findings to `docs/axe-contrast.md`, which was unchanged after the run. | |
| 28 | PASS | unit `contrast.test.ts › matches the committed docs/contrast-report.md` ✓ (it rewrites the file and fails if the file was out of date); README:61-64 names `docs/contrast-report.md` and `docs/axe-contrast.md` as the known deviation from 1.4.3/1.4.11. The theme still matches Godot's own derivation (`theme.test.ts` 6/6 ✓), so no colour was changed to pass a ratio. | |
| 29 | PASS | e2e `layout.spec.ts:109`, `:115`, `:118` ok (they measure each button and choice). My spec found the smallest target on each screen at 44 px or more in both width and height. | |
| 30 | PASS | e2e `keyboard.spec.ts:42 › a card by keyboard: Tab reaches the four choices in order, Space answers, Enter goes on`, `:76 › every stop on every screen: reading order, focus visible and not obscured`, `:105 › settings by keyboard…` ok. | |
| 31 | PASS | e2e `layout.spec.ts:115/118/121` (320 px, including 200% text), `:128 › landscape 780×360 (WCAG 1.3.4)`, `:136 › text at 200% (root font size proxy)` ok. My spec: smallest text = 16 px on every screen. | The 200% check scales the root font size rather than using the browser's own text zoom. Android's system font scaling on the S24 is worth a look by hand. |

## Implied checks

| Check | Result | Evidence |
|---|---|---|
| (a) No colour literals outside `src/theme/` | PASS | Grep of `src/` (excluding `theme/`) for `#[0-9a-f]{3,8}`, `rgba?(`, `hsla?(`: only `from_ok_hsl()` in card text. `pnpm lint:css` agrees. |
| (b) No runtime network calls other than the app's own files | PASS | `src/` (excluding `data/`): no `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`. The only URLs are SVG namespaces (`src/ui/kit/index.ts:145,157`), the repo link and the licence links on About (`about.ts:10,22,26`), which open only when tapped. In `dist/`, the one `fetch(` in the app bundle is Vite's same-origin modulepreload polyfill, and the one in `workbox-*.js` is the service worker's own precache. `index.html` loads no external resources. |
| (c) No reference to another project or organization (`SARGOS`, case-insensitive) | PASS | Zero files match across the whole repo. |
| (d) `THIRD_PARTY_NOTICES.md` licences match runtime dependencies | PASS | `package.json` dependencies: `idb` 8.0.4 (installed `license: ISC`) and `ts-fsrs` 5.4.2 (`MIT`). The notices list idb ISC and ts-fsrs MIT, plus Workbox MIT for the generated service worker. unit `about.test.ts › names every runtime dependency, as THIRD_PARTY_NOTICES.md does` ✓. |

## Screenshots against `docs/ui-reference/from-godot-docs/`

Compared mainly with `nodes_and_scenes_03_create_node_window.webp` (Create New Node dialog).

- **start.png:** Reads as a Godot panel. It has the `#242424` base, a darker inset panel, blue accent heading and button, and Inter in grey and white, matching the editor dialog's palette and type. There are no docks or menus.
- **card-api.png:** The most Godot-like screen. Each class name sits beside its real editor icon (AnimatedSprite2D, CollisionShape2D, VisibleOnScreenNotifier2D), as rows do in the Create New Node tree.
- **card-answered.png:** Uses Godot's own success green and error red outlines, and inline code in JetBrains Mono on a darker chip, like the help panel in `editor_intro_help_class_animated_sprite.webp`.
- **card-code.png:** Reads like the script editor (`editor_ui_script_editor_coding_area.webp`): line numbers, Godot's GDScript colours (`func` in pink-red, a teal engine type, yellow strings) and JetBrains Mono. The long line wraps at 360 px, which the editor wouldn't do, but it is needed for reflow.
- **summary.png:** Same panel and label-over-value style as Start. Plainly Godot-coloured, if sparse.
- **settings-warning.png:** The switches are accent-blue Godot toggles and the −/+ steppers are grey Godot-style buttons. The warning uses Godot's warning yellow. It reads as an editor inspector section.
- **add-card-errors.png:** The inputs look like Godot `LineEdit`s (dark fill, thin border), with error-red borders on the clashing fields and a plain-words error. It reads as an editor dialog.
- **about.png:** Text-heavy, but in the same panels, accent headings and Inter body text. It reads as a Godot help page more than a generic web page.
- **settings.png, add-card.png:** Not shown by the image reader in this session. Their states are covered by `settings-warning.png` and `add-card-errors.png` above.

## What a human still has to do

1. **Install to the home screen on the Galaxy S24.** Open the GitHub Pages URL in Chrome, choose "Add to Home screen"/"Install app", then check that the icon is the app's own glyph (not the Godot logo) and that it opens standalone with a `#242424` status bar.
2. **Airplane mode.** After one online load, turn on airplane mode, force-close the app, reopen it from the home screen and finish a full session.
3. **Persistence on the device.** Change a setting and add a card, swipe the app away, reopen it offline and check the counts, setting and card are unchanged.
4. **A real session on the S24.** Do a normal day's session (default 20 new cards) by thumb, in portrait and landscape, with Android's font size raised. Check that nothing is cut off and that the long explanations stay comfortable to read.
5. **Export/import across devices.** Export on the phone, find the JSON in Downloads, and import it on a second browser or a cleared install.

## Verdict

At commit `708bfb3` the app meets every numbered done criterion that can be checked off a phone. Typecheck, 83 unit tests, the CSS lint, the build and 22 Playwright tests all passed when I ran them, and the generators are deterministic. My own measurements matched the builders' tests: no horizontal scroll, 16 px gutters, 44 px targets, 16 px minimum text, always four live choices before an answer and none after. All 430 used classes have a card, and the decks contain no raw BBCode or Liquid. The colour, network, other-project and licence checks are all clean. The only known deviation is the one the project chose and discloses: some Godot colour pairs fall below WCAG contrast ratios, listed in `docs/contrast-report.md` and `docs/axe-contrast.md`. Items 2 and 3 pass in a browser with the network cut, but the real phone install, airplane mode and a full session on the S24 still need a person.
