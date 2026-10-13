# Decisions (Tyler, 2026-10-13, grill-me rounds 1–7)

The learning-science basis is Benedict Carey, *How We Learn* (2014): pretesting and the fluency illusion (ch. 5), spacing intervals (ch. 4), interleaving (ch. 8), context cues (ch. 3), and the appendix line "the best self-quizzes force you to choose the right answer from several possibilities and give immediate feedback".

| # | Decision | Chosen |
|---|----------|--------|
| 1 | What v1 trains | Vocabulary recall (API, language, GitHub). Concept pre-exposure cards later. |
| 2 | Card format | Four choices, instant right/wrong, correct answer + short explanation shown. Asked before taught. |
| 3 | Anki first? | No. Build the tool. |
| 4 | Platform | Not a Godot project (that is phase two). Must run on a Samsung Galaxy S24 and be usable by iPhone friends → PWA on GitHub Pages, installable, offline. |
| 5 | Content scope | The whole engine's docs, not scoped to GDQuest. |
| 6 | Who builds, where | Agents, in `C:\Users\Beeef\VSCode Projects\Godot Learning\godot-vocabulary`, own git repo, own CLAUDE.md. |
| 7 | Phone delivery | PWA on GitHub Pages (works for Android and iPhone). |
| 8 | Card families | API cards from Godot 4.7's class reference (MIT) and language cards from the GDScript manual pages (CC BY 3.0). Both from day one, shuffled. |
| 9 | Order and rate | Frequency order from Godot's official demo projects; first-2D-game tutorial classes pinned first; new cards per day capped (see 21). |
| 10 | Scheduler | FSRS via `ts-fsrs`, retention 0.9. |
| 11 | Card generation | Deterministic scripts for API and GitHub cards; one reviewed JSON file for language cards; user's own cards in-app. |
| 12 | Progress | On the phone only (IndexedDB) with export/import. No server, no accounts, completely free. |
| 13 | Done today | Install on the S24, run a session, close, airplane mode, reopen, everything intact; export/import work. CoS drives it in a phone-sized browser; a separate session verifies. |
| 14 | Name, account, licence | `talex444/godot-vocabulary`, public, MIT code, attributions in-app. Completely separate from every other project and organization on the account. |
| 15 | Stack and pushes | TypeScript + Vite + plain DOM, ts-fsrs, idb, vite-plugin-pwa. Pushes to this one repo authorized for the 2026-10-13 build. |
| 16 | Which editor surface | API cards mimic the Create New Node dialog / help panel (class icon beside name); language cards mimic the script editor (JetBrains Mono, syntax colours). |
| 17 | Theme | Stock Godot 4.7 dark theme defaults. |
| 18 | How far | Colours, fonts, icons, Godot's wording and control styles. One panel. No imitation of the editor layout. "I just need it to feel familiar." |
| 19 | GitHub terms | Yes, a third family from GitHub's glossary (CC BY 4.0), filtered to Git and team-workflow terms. |
| 20 | Family switches | Per-family on/off; everything enabled still shuffles together. |
| 22 | Accessibility standard | WCAG 2.2 Level AA, plus the AAA 44×44 px target size, as the bar for buttons, text and contrast ("since this is designed for mobile, we should use WCAG"). **Godot wins over WCAG contrast when they conflict** ("to feel like godot id rather godot wins where they disagree"): colours are never altered; failing pairs are measured and disclosed in `docs/contrast-report.md`. Every other WCAG criterion is a hard gate, checked by axe-core in Playwright. |
| 21 | Per-family budgets vs cap | Each family has its own new-cards-per-day (defaults 10/5/5). Settings show the total and projected review load (~10 reviews per new card). Above 20 total: a plain-words warning, not a hard stop. No new cards while reviews are overdue. |

## Round 8 (Tyler, 2026-10-13 evening, after his first real session of 20)

| # | Decision | Chosen |
|---|----------|--------|
| 23 | Same-session repeats | **Keep, spaced and capped** (his challenge was right; Karpicke & Roediger 2008, Vaughn & Rawson 2011): a new card is asked up to three times in its first session, spread as far apart as the session allows, never adjacent; a wrong answer brings it back until answered right. The first answer sets the FSRS grade; repeats reinforce only. Cards in Review state never repeat the same day (FSRS short-term steps off). |
| 24 | Anti-memorisation guards | Fresh wrong answers drawn from a pool every showing (never the same four twice); later showings flip direction on description cards (name shown, description to pick); snippet cards keep direction; the after-answer panel shows the full description and a link to the official docs page. |
| 25 | Reminders | Android package via Capacitor with local notifications (no server). Web app on Android can only do best-effort background nudges; **Apple is out of scope** ("this is a personal project and im on android"). |
| 26 | Bad cards | Both halves: generator rules for the detectable kinds (identical sibling descriptions, editor-only classes, hollowed prompts, four-word member descriptions) and a **Skip this card** with an optional reason, an undo list in Settings, included in export. A real doc error is worth reporting upstream. |
| 27 | Reminder precision | Within a window by default (no exact-alarm permission); an "exact time" switch in Settings that sends the user to the Android setting. |
| 28 | Signing key and data move | Tyler keeps the keystore (generated once on his PC, base64 in repo secrets for CI, file backed up by him); one Export from the web app and one Import in the package moves progress. |
| 29 | Courses (phase three, after reading) | A courses section will come after the CoS reads *Teaching Tech Together*, *The Programmer's Brain*, *Make It Stick*, *How Learning Works* and the Dunlosky 2013 review; Mayer's pre-training principle is the basis (cards = pre-training, lessons = the scaffold). Lessons are mostly doing: pretest, one worked example, do-it, then the cards. Content from the manual's own step-by-step sequence (CC BY 3.0). |
| 30 | Course hooks now | Every card gets a `topic` from the manual page that introduces it; the session builder gets a course-led new-card mode (a finished lesson's unseen cards first, then frequency order); the store records lessons done. No courses UI until the architecture is grilled. |

Calls made by the Chief of Staff, open to veto: the app icon is not the Godot logo; the app states it is unofficial; distractors for API cards are siblings (same parent class / same class), for GitHub cards other glossary terms.

Not in v1: concept cards, typing and running code, a Godot-project version, sync, accounts.
