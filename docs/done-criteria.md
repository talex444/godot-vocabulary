# Done criteria — v1 (2026-10-13)

Each line is checked twice: by the Chief of Staff driving the built app in a phone-sized browser (Playwright, 360×780, touch), and by a separate verification session that reads nothing but this file and the repo. A line passes only with evidence (a screenshot, a test name, a command output).

## Install and offline
1. `pnpm build` produces a static site that serves from a sub-path (`/godot-vocabulary/`) with a web manifest (name, short_name, icons 192 and 512, theme colour = Godot base colour, display standalone) and a registered service worker.
2. After one load, the app opens with the network disabled and a session can be completed.
3. Progress survives: close the app, reopen (and with the network off) → the same due counts, the same settings, the same custom cards.

## Session
4. Start screen shows, per enabled family, reviews due and new cards available today, and one "Start" button.
5. A card shows a prompt and exactly four choices; API choices show the class icon beside the class name when the answer kind is a class; language cards render code in JetBrains Mono with Godot's syntax colours.
6. Tapping a choice gives instant feedback: the tapped choice is marked right or wrong, the correct one is highlighted, a short explanation is shown, and a "Next" control advances. No second guess.
7. Correct → FSRS `Good`, wrong → FSRS `Again`; the next due time changes accordingly (unit test on the scheduler adapter).
8. New cards are asked before they are taught: the first time a card appears it is a question, not a reading card.
9. Due reviews and new cards from every enabled family are shuffled together in one session (unit test: order is not grouped by family).
10. New cards unlock in `rank` order per family; a method/property/signal card never appears before its class card has been seen (unit test).
11. On a day with overdue reviews (due before local midnight), no new cards are introduced until the overdue set is cleared (unit test + e2e).
12. A session ends with a summary: cards seen, right, wrong, and what is due tomorrow.

## Content
13. `pnpm generate` is deterministic: running it twice yields identical JSON.
14. API cards exist for every class with frequency > 0 in `data/class-frequency.json` (class cards), and member cards (methods, properties, signals with non-empty descriptions) for at least the top 40 classes by rank; the first-2D-game tutorial classes carry the lowest ranks.
15. BBCode in descriptions (`[member x]`, `[method y]`, `[code]…[/code]`, `[b]`, `[i]`, `[url]`) is rendered or stripped so no raw tags show (unit test on the converter).
16. Language cards: at least 100 cards in `data/cards/gdscript.json`, each with `source` naming the manual page and section; keywords, annotations, built-in functions, lifecycle callbacks, scene-tree concepts all represented.
17. GitHub cards: built from `data/sources/github/glossary.yml` through the allow-list; Liquid tokens (`{% data variables.… %}`) are resolved or the entry is skipped; no raw `{%` in any prompt.
18. Every card has four distinct choices, and the answer is one of them (unit test over the whole generated deck).

## Settings and data
19. Settings: per-family on/off; per-family new cards per day; the total and projected review load are shown; above 20 total a plain-words warning appears and the value is still accepted; desired retention is not exposed in v1.
20. Add your own card: family, prompt, answer, three wrong answers, optional explanation; it enters the deck as a new card and is included in export.
21. Export writes one JSON file (progress, settings, custom cards); import on a fresh install restores all three (e2e).
22. About screen: what the app is, unofficial statement, all attribution lines from CLAUDE.md, and a link to the repo.

## Look
23. Colours come from `data/theme/godot-4.7-defaults.json` through the derivation in `src/theme/`; no other colour literals in the stylesheet (lint or grep in CI).
24. Inter for interface text, JetBrains Mono for code, both bundled with their OFL licence files.
25. Fits 360×780 with a 16 px gutter, no horizontal scroll, touch targets ≥ 44 px (Playwright assertions).

## Accessibility (WCAG 2.2 AA + AAA target size; Tyler 2026-10-13)
27. axe-core (`@axe-core/playwright`, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) reports zero violations on every screen (start, card before and after answering, summary, settings, add-card, about) for every rule except `color-contrast`, whose findings are written to the report in item 28 rather than failing the run.
28. Godot's colours are never altered to pass a ratio (Tyler, 2026-10-13). A unit test computes the contrast of every text/background and control/background pair in the derived theme against 1.4.3 (4.5:1; 3:1 large text) and 1.4.11 (3:1) and writes the pairs that fall short to `docs/contrast-report.md`; the README names that file as a known deviation from WCAG.
29. Every tap target is at least 44×44 CSS px (2.5.5 AAA; 2.5.8 AA needs 24); Playwright measures each button and choice.
30. The whole app is usable with the keyboard only: tab order follows reading order, focus is always visible (2.4.7) and never obscured (2.4.11), choices and controls are native `<button>`s with accessible names (4.1.2), Enter/Space activate.
31. Reflow at 320 CSS px wide with no horizontal scrolling (1.4.10); browser text zoom at 200% loses nothing (1.4.4); portrait and landscape both work (1.3.4). Body text is never below 16 px (the app's own floor; WCAG sets none).

## Quality gates
26. `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e` all green; the README explains install, add-card, export/import, licences.

## v1.1 — after Tyler's first real session (decisions 23–30, 2026-10-13)
32. FSRS short-term steps are off: a new card answered correctly is next due at least one day later; answered wrongly, within about a day (unit test with the installed library's numbers).
33. First-session learning: a new card is asked up to three times in its first session; its showings are never adjacent and are spread as far apart as the queue allows (unit test: minimum gap ≥ min(8, queue/4)); a wrong answer brings it back until it is answered right; the first answer of the session sets the FSRS grade and repeats do not change it; a card in Review state is never shown twice in one day (unit tests; e2e shows the pattern on a 10-card session).
34. Every card carries a distractor pool of at least six where the data allows; the four choices are drawn fresh every showing and the same four never appear twice in one session for one card (unit test over 1,000 draws).
35. Second and third showings of a description card flip direction (the name shown, four descriptions to pick); snippet cards keep direction; the icon rule still holds (e2e screenshot of a flipped API card).
36. After answering, the panel shows the full description (BBCode converted, capped at a readable length with "…") and a link to the official docs page for that class, member, manual section or glossary term, opening in the browser; the app makes no request itself.
37. Skip this card: a flat control on the card screen with an optional reason; the card leaves the deck; Settings lists skipped cards with undo; skips travel in export/import (e2e).
38. Generator rules: no class card whose brief description is identical to a sibling's; no editor-only (`api_type="editor"`) classes; no prompt left with `____` or two words or fewer after masking; no member card whose description is four words or fewer; `pnpm generate` prints what each rule removed (unit test over the generated deck).
39. Course hooks: every card has a `topic` (string, from the manual page that introduces the class or keyword, via a committed mapping); the builder accepts `newCardMode: 'frequency' | 'course'` and, in course mode, a finished lesson's unseen cards come first (unit test); the store records `lessonsDone`; no courses UI yet.
40. The e2e suite and `docs/screenshots` reflect the new flow; the contrast and axe reports are regenerated.

## v1.1 — Android package (decisions 25, 27, 28)
41. A Capacitor Android project in `android/`, same web build, app id `io.github.talex444.godotvocabulary`; `pnpm android:build` produces a signed release APK locally when the keystore is present.
42. CI builds and signs the APK on a version tag (`v*`) from repository secrets and attaches it to a GitHub Release; the web deploy is unchanged.
43. A daily reminder: time set in Settings (Android only), scheduled with Capacitor Local Notifications, re-scheduled on launch; notification permission asked once from that setting; the "exact time" switch requests the exact-alarm setting and the plain sentence says the default is "about that time".
44. "Check for updates" in About opens the Releases page in the browser; the app itself makes no request.
45. Export and import work inside the package; progress moved from the web app by one export and one import (human check on the S24).
