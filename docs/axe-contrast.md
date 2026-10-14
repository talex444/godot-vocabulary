# axe colour-contrast findings

Written by `tests/e2e/axe.spec.ts` on every `pnpm e2e` run; do not edit by hand.

axe-core runs with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` on every screen at 360×780,
in the theme of the area the screen belongs to. Every rule except `color-contrast` must pass. The
`color-contrast` findings below are reported, not failed: they come from the tool’s own colours (Godot 4.7’s
editor theme in the Godot area, GitHub Desktop’s dark theme in Git & GitHub), which the app never alters
to pass a ratio (decisions 22 and 54). They are a known deviation from WCAG 1.4.3; see also
[`contrast-report.md`](contrast-report.md), which measures every theme pair directly.

The card screens show the first new card of each family (daily budgets set to one each), so the run is repeatable;
the flipped card is the Godot API card’s second look, and the skip field opens on the card after it. The
GitHub card is answered right, so its feedback is the same on every run.

## Godot

Screens audited: start, settings, settings with the warning, settings (import choice), card (Godot API), card answered (Godot API), card (GDScript), card answered (GDScript), flipped card (Godot API), flipped card answered (Godot API), skip this card (reason field), summary, settings (skipped cards), add card, add card with errors, about, courses, lesson, lesson answered, lesson with code, lesson with the course table.

Findings: 11.

| Screen | Selector | Text | Background | Expected | Actual |
|--------|----------|------|------------|----------|--------|
| start | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| card answered (Godot API) | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| card answered (GDScript) | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| flipped card answered (Godot API) | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| summary | `button` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| add card | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| add card with errors | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| lesson | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| lesson answered | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| lesson with code | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| lesson with the course table | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |

## Git & GitHub

Screens audited: start, card (GitHub), card answered (GitHub), summary, courses.

Findings: 7.

| Screen | Selector | Text | Background | Expected | Actual |
|--------|----------|------|------------|----------|--------|
| start | `h2` | #0366d6 | #1d2125 | 3:1 | 2.98:1 |
| card (GitHub) | `h2` | #0366d6 | #1d2125 | 3:1 | 2.98:1 |
| card answered (GitHub) | `a` | #0366d6 | #1d2125 | 4.5:1 | 2.98:1 |
| card answered (GitHub) | `h2` | #0366d6 | #1d2125 | 3:1 | 2.98:1 |
| summary | `h2` | #0366d6 | #1d2125 | 3:1 | 2.98:1 |
| courses | `button` | #ffffff | #717b85 | 4.5:1 | 4.3:1 |
| courses | `h2` | #0366d6 | #1d2125 | 3:1 | 2.98:1 |
