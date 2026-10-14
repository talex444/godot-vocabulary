# Release notes

Newest first. Each entry: what changed, what it means for you, why, and anything you need to do.

## 1.3.1 — 2026-10-14

### Summary
- **One warm colour on the Areas screen, with one meaning: do this next.** An amber marks the one thing to do on each tile: the number of reviews due when there are some, otherwise the next lesson. A tile with nothing to do stays grey, and so does everything else on the page. The greys underneath are re-picked, evenly stepped and slightly warm, and the corners are a little rounder.
- **The tile is balanced.** The due count sits on the right as the tile's big figure ("12 due"), with **Last used** under it and a small arrow that says the tile opens; the lessons line sits quietly under the area's name. The Godot tile's icon is Godot's own PackedScene icon in grey (the old ring read as a plain "O").
- **The next lesson, in words.** With nothing due, the tile says **Next: Lesson N**, and one plain line under the heading says what today holds: "Nothing due today. Next: Godot, Lesson 0." or "12 due in Godot. 3 due in Git & GitHub." No greeting, no streaks.
- **After a review of the first build:** "0 due" is small and grey so it never outranks the next lesson; screen readers hear each tile in the words it shows; the Godot icon is PackedScene, not the app glyph that read as a ticked box; and About is underlined.

### Impact
- None on your data: progress, settings, lessons done and export files are unchanged.
- Screen readers hear each tile in the words on screen ("Godot, 0 due, Next: Lesson 0, 0 of 6 lessons" where 1.3.0 said "Nothing due"); "Loading…" is announced on its own when you open an area.

### Reasoning
Decisions 63 and 64 (`docs/decisions.md`), after Tyler's first look at 1.3.0: "the home page feels a little dry … very cold and corporate" and "the buttons on the home screen have a lot of text weight on the left side leaving the right side to be bare". The colour is "amber as long as its tasteful and doesnt end up looking like typical ai color drenching": one flat value, at most one mark per tile, and it passes WCAG's 4.5:1 for text on every surface of the page, the pressed tile included. The words always carry the meaning; the colour only repeats it.

### Actions required
- None.

## 1.3.0 — 2026-10-14

### Summary
- **A home page.** The app now opens on **Areas**: one tile per area (Godot; Git & GitHub) with the tool's icon, how many reviews are due, and how many lessons you have done. The area you used last says **Last used**. The home page has its own plain dark grey look that meets WCAG 2.2 AA in full.
- **Areas.** Each area has its own page, titled with its name, with **All areas** at the top left and the same links underneath (Courses, Settings, Add card, About). **Back**, on screen or the phone's own button, steps back one screen at a time: Courses → the area → Areas.
- **The GitHub Desktop theme.** The Git & GitHub area wears GitHub Desktop's dark theme (its colours, corners and your device's system font); the Godot area keeps Godot 4.7's editor look.
- **The wipe.** Opening an area loads it first (the tile says **Loading…**), then the area's look spreads from where you tapped over about 300 ms. With "reduce motion" on, or in a browser without View Transitions, the switch is instant.
- About now shows the MIT licence's permission notice in full, and the Octicons, Primer and GitHub Desktop notices.

### Impact
- **Sessions are per area.** A session holds one area's cards: Godot API and GDScript mix in the Godot area; GitHub cards are in the Git & GitHub area. Overdue reviews in one area no longer hold back new cards in the other.
- **Export is version 4.** Files exported from 1.3.0 store **Lesson cards first** per area. 1.3.0 still imports every older file (versions 1 to 3); their single setting goes to the Godot area.
- The first download is about 128 KB; each area's cards load the first time you open it (Godot about 1.5 MB, Git & GitHub about 120 KB), and everything still works offline after the first visit.

### Reasoning
Decisions 46–51 (`docs/decisions.md`): an area is one tool and a session belongs to one area (46); each area wears its tool's own default look (47), using the tool's own assets where the licence allows and never a logo (48); the home page is neutral, shows only real areas, and remembers the last one (49); area pages share one navigation, and Back always agrees with the phone (50); the switch between looks is a wipe, not a flash, because going from one tool's colours to another's at once "would be like a flashbang going off" (51).

### Actions required
- **Install the 1.3.0 APK before importing a file exported from 1.3.0 or later.** An older app (1.2.x) cannot read a version 4 file: it says "Nothing was imported. Not a godot-vocabulary export (version 1, 2 or 3)." From 1.3.0 on, a file from a later version gets "This file was made by a newer version of the app. Update the app, then import it."
- Moving progress between the web version and the Android app: both must be on 1.3.0 or later.
