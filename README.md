# Godot Vocabulary

Godot Vocabulary is a small app for your phone that drills the words of the Godot 4.7 API, GDScript and Git/GitHub as four-choice cards. A spaced-repetition scheduler (FSRS) brings each card back just before you would forget it. It is free, works offline, and keeps everything on your device.

It is an **unofficial community project**. It is not affiliated with or endorsed by the Godot Foundation, the Godot Engine project or GitHub. The Godot logo is not used; the app icon is its own glyph.

The app lives at **https://talex444.github.io/godot-vocabulary/**.

## Install it on your phone

- **Android (Chrome):** open the link, tap the **⋮** menu, then **Install app** (or **Add to Home screen**).
- **iPhone (Safari):** open the link, tap **Share**, then **Add to Home Screen**.

After the first load it works with no network at all, including in airplane mode. There are no accounts, no tracking and no analytics, and the app never sends your data anywhere.

## How a session works

- **Four choices, instant feedback.** Each card asks one question with four answers. Tap one: it is marked right or wrong, the correct answer is highlighted, the full description appears, and **Next** moves on. There is no second guess.
- **Asked before taught.** A new card is a question the first time you see it, not a page to read. Guessing first and then seeing the answer helps it stick.
- **Reviews first.** Cards that are due come back in the same session. If any review is **overdue** (it was due before today), no new cards appear until the overdue ones are answered.
- **Daily new cards per family.** Godot API 10, GDScript 5, GitHub 5 by default. Change them in **Settings**, which shows the total and the review load it leads to (about ten reviews a day for each new card a day). Above twenty a day, Settings warns you in plain words, and still lets you do it.
- **Mixed together.** Due reviews and new cards from every family that is switched on are shuffled into one session. You can switch a family off in Settings.
- **New cards in a sensible order.** API cards follow how often each class appears in Godot's demo projects, with the classes from the "Your first 2D game" tutorial first. You always meet a class before its methods, properties and signals.

A new card is asked up to three times on its first day, spread out and never twice in a row; a wrong answer brings it back until you get it right. Each time, the three wrong answers are drawn fresh, and on the second and third look a description card turns around: it shows the name (with its class icon) and asks you to pick the right description out of four. After every answer the panel shows the full description and a link to the official Godot or GitHub docs page. The summary counts **cards learned** (three looks, the last one right) and the ones to **continue tomorrow**. If a card is wrong or confusing, **Skip this card** (under the choices) takes it out of your deck, with an optional reason. **Settings → Skipped cards** lists them with an **Undo** each.

Only the first answer of the day is graded: right counts as FSRS **Good**, wrong as **Again**, at a desired retention of 0.9. The repeats help you learn and do not change the schedule.

## Where the cards come from

- **Godot API** (855 cards): generated from Godot 4.7's class reference XML.
- **GDScript** (120 cards): written by hand in `data/cards/gdscript.json` from the GDScript pages of the Godot manual. Each card names its source section.
- **GitHub** (96 cards): generated from the GitHub Docs glossary, filtered by `scripts/github-terms-allowlist.json` to Git and team-workflow terms.

To regenerate them:

```sh
pnpm fetch-sources   # clones/downloads the sources into data/sources/ (not committed)
pnpm generate        # writes src/data/cards.*.json; running it twice gives the same files
```

## Add your own cards

On the Start screen, tap **Add card**. Pick a family, write the question, the right answer, three wrong answers and an optional explanation, then **Save**. The app tells you in plain words if something is missing, if two answers are the same, or if the question gives the answer away. Your card becomes the family's next new card. **Your cards** below the form lists them, each with a **Delete**.

Your cards stay on your phone. They are never added to this repository.

## Export and import

In **Settings → Data**:

- **Export** saves one JSON file (`godot-vocabulary-YYYY-MM-DD.json`) with your progress, your settings, your own cards and your skipped cards. Files from older versions still import.
- **Import** reads such a file and offers two choices:
  - **Merge with this device** keeps your settings here, adds the file's cards and, for each card, keeps whichever progress was reviewed last.
  - **Replace everything on this device** wipes this device and restores the file's progress, settings and cards.

Use it to back up, or to move to a new phone. The file only goes where you put it.

## Accessibility, and one known deviation

The bar is WCAG 2.2 Level AA, plus the AAA target size: every tap target is at least 44×44 CSS px. Every screen works at 320 CSS px wide, in portrait and landscape, with text at 200%, and by keyboard alone. axe-core checks every screen on every test run.

**Known deviation from WCAG 1.4.3 / 1.4.11 (contrast):** the app uses Godot 4.7's own editor colours and never changes them to pass a ratio. A few pairs fall short, most visibly white text on the blue accent button (2.71:1). They are measured and listed, not hidden:

- [`docs/contrast-report.md`](docs/contrast-report.md): every text/background and control/background pair in the theme, with the ones below 4.5:1 (text) or 3:1 (controls).
- [`docs/axe-contrast.md`](docs/axe-contrast.md): what axe-core's `color-contrast` rule finds on each screen.

## Licences and attributions

The app's code is MIT-licensed (see [`LICENSE`](LICENSE)). It is built from:

- Godot Engine 4.7: class reference, class icons and editor theme colours (MIT, © Godot Engine contributors, Juan Linietsky, Ariel Manzur).
- Godot documentation: "Juan Linietsky, Ariel Manzur and the Godot community" (CC BY 3.0).
- GitHub Docs glossary (CC BY 4.0, © GitHub, Inc.).
- Inter and JetBrains Mono fonts (SIL Open Font License 1.1).
- ts-fsrs (MIT), idb (ISC) and Workbox (MIT).

The full notices are in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and on the app's **About** screen.

## Run it locally

You need Node 22 and pnpm.

```sh
pnpm install
pnpm dev                                      # development server
pnpm typecheck                                # TypeScript
pnpm test                                     # unit tests (Vitest)
pnpm lint:css                                 # no colour literals outside the theme
pnpm exec playwright install chromium         # once, for the end-to-end tests
pnpm e2e                                      # build, then Playwright at a 360×780 phone viewport (with axe-core)
pnpm build && pnpm preview                    # the production build at http://localhost:4173/godot-vocabulary/
```

Pushes to `main` build, test and deploy to GitHub Pages through `.github/workflows/deploy.yml`.
