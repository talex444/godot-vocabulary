# Godot Vocabulary

Godot Vocabulary is a small app for your phone that drills the words of Godot 4.7's editor and API, GDScript and Git/GitHub as four-choice cards. A spaced-repetition scheduler (FSRS) brings each card back just before you would forget it. It is free, works offline, and keeps everything on your device.

The app has two **areas**, one per tool: **Godot** (the Godot editor, Godot API and GDScript cards, and the courses) and **Git & GitHub** (the GitHub cards). It opens on the **Areas** screen: one tile per area with the tool's icon, how many reviews are ready (on the right, only when there are some, as in "12 ready"), how many lessons the area has ("6 lessons", then "1 of 6 lessons" once you finish one) and, when nothing is ready, the next lesson, plus a **Last used** tag on the area you were in last. When no tile has reviews ready, one line above them says where to start. Tap a tile to open the area: it loads, then its look spreads from where you tapped (instantly if your phone is set to reduce motion). A tile with no reviews ready and a lesson to do opens that lesson straight away; **Back** from it goes to the area's page, then to the Areas screen. Each area wears its tool's look: the Godot area uses Godot 4.7's editor colours, and the Git & GitHub area follows GitHub Desktop's dark theme (its colours, rounded corners, Octicons) and your device's system font. The Areas screen has a dark, warm grey look of its own with one warm amber that means "do this next": it marks the ready count and nothing else, so a screen with nothing ready has no colour at all. Every area page has **All areas** at the top left and the same links underneath: **Courses**, **Settings**, **Add card**, **About**. **Back** (on screen or your phone's) goes back one screen at a time.

It is an **unofficial community project**. It is not affiliated with or endorsed by the Godot Foundation, the Godot Engine project or GitHub. The Godot logo is not used; the app icon is its own glyph.

The app lives at **https://talex444.github.io/godot-vocabulary/**.

## Install it on your phone

- **Android (Chrome):** open the link, tap the **⋮** menu, then **Install app** (or **Add to Home screen**).
- **iPhone (Safari):** open the link, tap **Share**, then **Add to Home Screen**.

After the first load it works with no network at all, including in airplane mode. There are no accounts, no tracking and no analytics, and the app never sends your data anywhere.

The first visit downloads only what the Areas screen needs, about 130 KB; each area's cards and courses load the first time you open it. That first download has a written budget of 1 MB (1,000,000 bytes on disk), and `pnpm build` fails if it grows past it or if any deck or course creeps into it.

## Android app

There is also an Android app. It is the same app, plus one thing the web version cannot do: a **daily reminder**. In the app, **Settings → Reminder** has an on/off switch and a time (8 pm unless you change it). The reminder says how many cards are waiting, and tapping it opens the app on the Areas screen. By default Android sends it at *about* that time: it may hold it back a while to save battery. If you want it at the exact minute, turn on **Exact time**: it opens Android's "Alarms & reminders" setting for the app. The first time you turn the reminder on, Android asks whether the app may send notifications.

**Download:** the newest `godot-vocabulary-vX.Y.Z.apk` is on the [Releases page](https://github.com/talex444/godot-vocabulary/releases). **About → Check for updates** opens that page; the app never checks by itself.

**Install it on a Samsung (or any Android phone):**

1. Open the Releases page in the phone's browser (Samsung Internet or Chrome) and tap the `.apk` file to download it.
2. Open the downloaded file. Android says the browser is not allowed to install apps: tap **Settings**, switch on **Allow from this source**, then go back.
3. Tap **Install**. To update later, download the newer APK and install it over the old one. Your progress stays.

**Your progress does not move by itself.** The Android app keeps its own storage, separate from the browser's. To bring your progress across once: in the web version, open an area, then **Settings → Export**; in the Android app, **Settings → Import** and pick that file (choose **Replace everything on this device** on a fresh install). **Both must be on 1.3.0 or later:** a 1.2.x app cannot read a file exported from 1.3.0, so install the 1.3.0 APK first (see [`docs/release-notes.md`](docs/release-notes.md)). In the Android app, **Export** opens Android's "Save as" screen, so you choose where the file goes.

The web version keeps working as before for everyone else, on any phone. The Android app is for people who want the reminder. There is no iPhone app.

## How a session works

- **Four choices, instant feedback.** Each card asks one question with four answers. Tap one: it is marked right or wrong, the correct answer is highlighted, the full description appears, and **Next** moves on. There is no second guess.
- **Asked before taught.** A new card is a question the first time you see it, not a page to read. Guessing first and then seeing the answer helps it stick.
- **Reviews first.** Cards whose day has come are **ready** and come back in the same session. If any ready review in an area is **from before today**, that area's new cards begin only after those reviews are answered; the area page counts them under **From before today** (they are part of the ready ones, not extra). Reviews from before today in one area do not hold back new cards in the other.
- **Daily new cards per family.** Godot editor 5, Godot API 10, GDScript 5, GitHub 5 by default. Change them in **Settings**, which shows the total and the review load it leads to (about ten reviews a day for each new card a day). Above twenty a day, Settings warns you in plain words, and still lets you do it. The four defaults add up to 25, so the warning shows until you lower one or switch a family off.
- **One area at a time, its families mixed together.** A session belongs to one area. The due reviews and new cards of that area's families that are switched on are shuffled into one session: in the Godot area, Godot editor, Godot API and GDScript cards come mixed. You can switch a family off in Settings.
- **New cards in a sensible order.** API cards follow how often each class appears in Godot's demo projects, with the classes from the "Your first 2D game" tutorial first. You always meet a class before its methods, properties and signals.

A new card is asked up to three times on its first day, spread out and never twice in a row; a wrong answer brings it back until you get it right. Each time, the three wrong answers are drawn fresh, and on the second and third look a description card turns around: it shows the name (with its class icon) and asks you to pick the right description out of four. After every answer the panel shows the full description and a link to the official Godot or GitHub docs page. The summary counts **cards learned** (three looks, the last one right) and the ones to **continue tomorrow**. If a card is wrong or confusing, **Skip this card** (under the choices) takes it out of your deck, with an optional reason. **Settings → Skipped cards** lists them with an **Undo** each.

Only the first answer of the day is graded: right counts as FSRS **Good**, wrong as **Again**, at a desired retention of 0.9. The repeats help you learn and do not change the schedule.

## Where the cards come from

- **Godot editor** (16 cards): written by hand in `data/cards/godot-editor.json` from the manual's "First look at Godot's interface" page, one card per part of the editor it names (the docks, the viewport and its toolbar, the bottom panel, the five main screens…). Each prompt quotes the page.
- **Godot API** (861 cards): generated from Godot 4.7's class reference XML.
- **GDScript** (120 cards): written by hand in `data/cards/gdscript.json` from the GDScript pages of the Godot manual. Each card names its source section.
- **GitHub** (96 cards): generated from the GitHub Docs glossary, filtered by `scripts/github-terms-allowlist.json` to Git and team-workflow terms.

To regenerate them:

```sh
pnpm fetch-sources   # clones/downloads the sources into data/sources/ (not committed)
pnpm generate        # writes src/data/cards.*.json; running it twice gives the same files
```

## Courses

From the **Areas** screen, open **Godot**, then tap **Courses**. Course 1 is six lessons, one per page of the Godot manual, in the manual's order:

0. "What is a Godot game made of when it runs?" (Overview of Godot's key concepts)
1. "What is a scene made of, and how do you run one?" (Nodes and Scenes)
2. "How can one scene appear many times in a game?" (Creating instances)
3. "How does a script make a node move?" (Creating your first script)
4. "How does a script know which key the player is pressing?" (Listening to player input)
5. "How does one node make code run in another?" (Using signals)

Lessons 3 to 5 show GDScript from the manual, and some of their exercises put the blank or the wrong line inside the code. The app never runs code. The course ends with a table, `Node2D`, `Control` and `Node3D` against three questions, with every cell covered: guess, then tap to reveal. It stays on the course list once lesson 5 is done. A lesson is one scrolling page: three of its cards as a pretest, then short explanations in the manual's own words with its pictures, a check after each, a comparison, exercises (four-choice, type the missing word, find the wrong line), the common mistakes with their fixes, and an optional exit ticket you write in your own words. Nothing in a lesson is scored, and there is no Next button inside it: you scroll. **Finish lesson: add N cards** at the bottom puts the lesson's cards ahead of your other new cards, then says so in place and offers **Next: Lesson N** and **Back to courses**. Settings shows this as **Lesson cards first**, which turns on by itself with your first finished lesson.

## Add your own cards

From the **Areas** screen, open an area, then tap **Add card**. Pick a family, write the question, the right answer, three wrong answers and an optional explanation, then **Save**. The app tells you in plain words if something is missing, if two answers are the same, or if the question gives the answer away. Your card becomes the family's next new card. **Your cards** below the form lists them, each with a **Delete**.

Your cards stay on your phone. They are never added to this repository.

## Export and import

In any area, **Settings → Data**:

- **Export** saves one JSON file (`godot-vocabulary-YYYY-MM-DD.json`, version 4) with your progress, your settings (including each area's own **Lesson cards first** setting), your own cards, your skipped cards, your finished lessons and your exit tickets. The reminder and the **Last used** tag stay settings of the phone and are not in the file. Files from older versions still import: their single **Lesson cards first** setting goes to the Godot area. A file made by a newer version of the app is refused with a message asking you to update the app first.
- **Import** reads such a file and offers two choices:
  - **Merge with this device** keeps your settings here, adds the file's cards and, for each card, keeps whichever progress was reviewed last.
  - **Replace everything on this device** wipes this device and restores the file's progress, settings and cards.

Use it to back up, or to move to a new phone. The file only goes where you put it.

## Accessibility, and one known deviation

The bar is WCAG 2.2 Level AA, plus the AAA target size: every tap target is at least 44×44 CSS px. Every screen works at 320 CSS px wide, in portrait and landscape, with text at 200%, with WCAG's text-spacing values, and by keyboard alone, on the Areas screen and in each area's theme. axe-core checks every screen on every test run. The Areas screen and the navigation meet WCAG 2.2 AA in full, contrast included: a contrast shortfall there fails the build.

**Known deviation from WCAG 1.4.3 / 1.4.11 (contrast):** inside an area the app uses the tool's own colours (Godot 4.7's editor theme; GitHub Desktop's dark theme) and never changes them to pass a ratio. Some pairs fall short: text pairs, and non-text pairs such as focus rings, control edges and selection. The most visible are white text on Godot's blue accent button (2.71:1) and GitHub Desktop's blue accent on its dark background (about 2.7:1). They are measured and listed per area, not hidden:

- [`docs/contrast-report.md`](docs/contrast-report.md): one section for the Areas screen (none short) and one per area, with every text/background pair and every non-text pair (control edges, focus, selection), and the ones below 4.5:1 (text) or 3:1 (large text and controls).
- [`docs/axe-contrast.md`](docs/axe-contrast.md): what axe-core's `color-contrast` rule finds on each screen, one section per area.

## Licences and attributions

The app's code is MIT-licensed (see [`LICENSE`](LICENSE)). It is built from:

- Godot Engine 4.7: class reference, class icons and editor theme colours (MIT, © Godot Engine contributors, Juan Linietsky, Ariel Manzur).
- Godot documentation: "Juan Linietsky, Ariel Manzur and the Godot community" (CC BY 3.0), including the sentences and screenshots quoted in the course lessons.
- GitHub Docs glossary (CC BY 4.0, © GitHub, Inc.).
- The Git & GitHub area's colours: GitHub Desktop's dark theme and the Primer colour palette it uses (both MIT, © GitHub, Inc.). Its icons are Octicons, unchanged (MIT, © GitHub Inc.). No GitHub logo is used. Their licence files ship with the app in `public/licenses/`, and About shows the MIT permission notice in full.
- Inter and JetBrains Mono fonts (SIL Open Font License 1.1).
- ts-fsrs (MIT), idb (ISC) and Workbox (MIT).
- The Android app also contains Capacitor and its Local Notifications plugin (MIT) and the AndroidX libraries (Apache 2.0).

The full notices are in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and on the app's **About** screen.

## Run it locally

You need Node 22 and pnpm.

```sh
pnpm install
pnpm dev                                      # development server
pnpm typecheck                                # TypeScript
pnpm test                                     # unit tests (Vitest)
pnpm lint:css                                 # no colour literals outside the theme; no innerHTML under src/
pnpm exec playwright install chromium         # once, for the end-to-end tests
pnpm e2e                                      # build, then Playwright at a 360×780 phone viewport (with axe-core)
pnpm build && pnpm preview                    # the production build (fails above the 1 MB first-load budget) at http://localhost:4173/godot-vocabulary/
```

Pushes to `main` build, test and deploy to GitHub Pages through `.github/workflows/deploy.yml`.

### The Android app

You also need Android Studio (for the Android SDK and its bundled JDK 21). On Windows the scripts find both in their default places; elsewhere set `JAVA_HOME` and `ANDROID_HOME`.

```sh
pnpm build:android     # web build with relative paths, then copies it into android/ (cap sync)
pnpm android:debug     # debug APK: android/app/build/outputs/apk/debug/app-debug.apk
pnpm android:build     # release APK: android/app/build/outputs/apk/release/
```

`pnpm android:build` signs the APK when `android/keystore.properties` exists (it is gitignored, like every keystore):

```properties
storeFile=C:/path/to/godot-vocabulary.keystore
storePassword=…
keyAlias=godot-vocabulary
keyPassword=…
```

Without it the release APK comes out unsigned (`app-release-unsigned.apk`). A version tag (`v1.1.0`, matching `package.json`) runs `.github/workflows/android.yml`, which signs the APK from the repository secrets and attaches `godot-vocabulary-<tag>.apk` to that tag's GitHub Release.
