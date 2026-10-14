/**
 * The switch between themes (decision 51): the new screen spreads from the tapped tile as a growing
 * circle over 300 ms, through the View Transitions API. The browser snapshots the old screen, so its
 * colours and fonts stay put while the new one wipes over them. Instant where the API is missing and
 * under `prefers-reduced-motion: reduce`.
 *
 * `apply` must be synchronous (it only sets the tokens and swaps the screen): the caller loads the
 * area and builds its screen first, so the wipe never waits on the network.
 */

export interface Point {
  x: number;
  y: number;
}

export const WIPE_MS = 300;

/** Pure: animate only where the API exists and the learner has not asked for less motion. */
export function shouldAnimate(supported: boolean, reducedMotion: boolean): boolean {
  return supported && !reducedMotion;
}

/** Runs `apply` inside a circular wipe from `origin` (the viewport's centre when omitted), or at once. */
export async function switchTheme(apply: () => void, origin?: Point): Promise<void> {
  const root = document.documentElement;
  const supported = typeof document.startViewTransition === 'function';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!shouldAnimate(supported, reduced)) {
    apply();
    root.dataset.switched = 'instant';
    return;
  }
  const { x, y } = origin ?? { x: innerWidth / 2, y: innerHeight / 2 };
  // The circle ends where it covers the farthest corner.
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = document.startViewTransition(apply);
  // `data-switching` lasts until `finished` resolves; `data-switched` says how the last switch ran.
  root.dataset.switched = 'wipe';
  root.dataset.switching = '';
  try {
    await transition.ready;
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: WIPE_MS, easing: 'ease-in', pseudoElement: '::view-transition-new(root)' },
    );
  } catch {
    // The transition was skipped (the page was hidden, say): `apply` has still run.
  }
  await transition.finished.catch(() => undefined);
  delete root.dataset.switching;
}
