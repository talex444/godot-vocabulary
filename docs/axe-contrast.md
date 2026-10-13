# axe colour-contrast findings

Written by `tests/e2e/axe.spec.ts` on every `pnpm e2e` run; do not edit by hand.

axe-core runs with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` on every screen at 360×780.
Every rule except `color-contrast` must pass. The `color-contrast` findings below are reported, not failed:
they come from Godot 4.7’s own editor colours, which the app never alters to pass a ratio
(decision #22, Tyler, 2026-10-13). They are a known deviation from WCAG 1.4.3; see also
[`contrast-report.md`](contrast-report.md), which measures every theme pair directly.

The card screens show the first new card of each family (daily budgets set to one each), so the run is repeatable;
the flipped card is the Godot API card’s second look, and the skip field opens on the card after it.

Screens audited: start, settings, settings with the warning, settings (import choice), card (Godot API), card answered (Godot API), card (GDScript), card answered (GDScript), card (GitHub), card answered (GitHub), flipped card (Godot API), flipped card answered (Godot API), skip this card (reason field), summary, settings (skipped cards), add card, add card with errors, about, courses, lesson, lesson answered, lesson with code, lesson with the course table.

Findings: 12.

| Screen | Selector | Text | Background | Expected | Actual |
|--------|----------|------|------------|----------|--------|
| start | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| card answered (Godot API) | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| card answered (GDScript) | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| card answered (GitHub) | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| flipped card answered (Godot API) | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| summary | `button` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| add card | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| add card with errors | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| lesson | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| lesson answered | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| lesson with code | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
| lesson with the course table | `.gv-button--primary` | #ffffff | #579eff | 4.5:1 | 2.71:1 |
