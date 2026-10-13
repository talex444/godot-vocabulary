# godot-vocabulary

A free, offline, installable web app (PWA) that drills Godot 4.7 API vocabulary, GDScript vocabulary and Git/GitHub vocabulary as four-choice cards scheduled by FSRS. It belongs to Tyler Alex (talex444); the Chief of Staff plans and verifies, agents build. It is a personal learning tool, open source under MIT. It has nothing to do with any other project on this machine; never reference, read, or link anything outside this folder.

Read `docs/decisions.md` (the 21 decisions behind every rule below) and `docs/done-criteria.md` (what "done" is) before changing anything.

## Rules that do not bend

- **No server, no accounts, no analytics, no network calls at runtime** except the app loading its own files. Everything the user does lives on the device (IndexedDB) and can be exported/imported as one JSON file. Hosting is GitHub Pages only.
- **Cards are four-choice questions with instant feedback**: the learner picks, sees right/wrong and the correct answer with a short explanation. New cards are asked before they are taught (pretesting). No self-grading, no typing answers in v1.
- **Scheduler is FSRS via `ts-fsrs`**, desired retention 0.9. Correct → `Rating.Good`, wrong → `Rating.Again`. Never write a scheduler.
- **Daily new cards are per family** (defaults: godot-api 10, gdscript 5, github 5), each adjustable; the settings screen shows the total and the projected review load (about ten reviews per new card). Above twenty total it warns in plain words and allows it. **No new cards while any review is overdue** (due before the start of today, local time).
- **Interleaving**: due reviews and new cards from every enabled family are shuffled together. No topic sorting, no "study only X" view. Each family has an on/off switch; all on by default.
- **New cards unlock in `rank` order** within a family (frequency order; the first-2D-game tutorial's classes pinned first). A member card (method/property/signal) never appears before its class card has been seen.
- **Content comes from generators, not hand edits**: `scripts/` read `data/sources/` (gitignored; `pnpm fetch-sources` re-creates it) and write the card JSON under `src/data/`. The only hand-written card file is `data/cards/gdscript.json` (language cards) and the GitHub allow-list. Users' own cards are stored on-device, never in the repo.
- **Look = Godot's own parts, no fake editor layout**: colours from `data/theme/godot-4.7-defaults.json` (stock 4.7 dark theme, derived like the engine does), Inter for interface text, JetBrains Mono for code, Godot's class icons beside API choices. One panel that fills a phone screen. Wording and control styles like the editor's, no docks, no menus, no imitation of the editor layout.
- **Attribution and licences**: the About screen and `THIRD_PARTY_NOTICES.md` carry: Godot Engine's copyright/licence line (MIT), the Godot docs line "Juan Linietsky, Ariel Manzur and the Godot community" (CC BY 3.0), GitHub Docs (CC BY 4.0), Inter and JetBrains Mono (SIL OFL 1.1), ts-fsrs and every runtime dependency. The app says it is an unofficial community project, not affiliated with the Godot Foundation or GitHub. **The Godot logo is never used** (it is a separate CC BY work); the app icon is its own glyph.
- **Stack**: TypeScript, Vite, plain DOM (no UI framework), `ts-fsrs`, `idb`, `vite-plugin-pwa`. Tests: `vitest` for units, `@playwright/test` with a phone viewport for end-to-end. Package manager: pnpm only. Prefer standard web platform APIs over libraries.
- **Mobile first**: every screen works at 360×780 CSS px with a 16 px gutter and no horizontal scroll; touch targets at least 44 px; installable (manifest + service worker), works offline after first load.

## Working here

- Scripts: `pnpm dev`, `pnpm build`, `pnpm preview`, `pnpm typecheck`, `pnpm test` (vitest), `pnpm e2e` (Playwright, builds first), `pnpm generate` (all generators), `pnpm fetch-sources`. All four gates (`typecheck`, `test`, `build`, `e2e`) green before every commit.
- Commits: conventional, lowercase subject under 100 characters, one logical change per commit. Never push; the Chief of Staff pushes and deploys.
- Headless sessions: one plain command per call, no `cd … &&` compounds, no `sed -i`, no redirects to temp files, no background processes; make file changes with the Edit/Write tools; read exit codes from the tool result.
- Keep `README.md` honest: what it is, how to install it on a phone, how to add your own cards, how to export/import, the licences.
