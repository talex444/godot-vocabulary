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

## Quality gates
26. `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e` all green; the README explains install, add-card, export/import, licences.
