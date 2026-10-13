import type { Family } from '../cards/types';
import { deviceDeps } from '../session/deck';
import { Session, type SessionResult } from '../session/run';
import { cardScreen } from './screens/card';
import { placeholderScreen } from './screens/placeholder';
import { settingsScreen } from './screens/settings';
import { startScreen } from './screens/start';
import { summaryScreen } from './screens/summary';

/** Moves between screens; one is visible at a time, no router and no URL changes. */
export interface Nav {
  start(): void;
  begin(session: Session): void;
  card(session: Session): void;
  summary(result: SessionResult): void;
  settings(): void;
  addCard(): void;
  about(): void;
  placeholder(title: string): void;
}

export const FAMILY_LABEL: Record<Family, string> = {
  'godot-api': 'Godot API',
  gdscript: 'GDScript',
  github: 'GitHub',
};

export function mountApp(host: HTMLElement): void {
  const show = (screen: HTMLElement) => {
    host.replaceChildren(screen);
    window.scrollTo(0, 0);
    // Move focus to the new screen's first heading or marked target so keyboard and screen-reader users follow.
    const target = screen.querySelector<HTMLElement>('[data-autofocus]') ?? screen.querySelector<HTMLElement>('h2');
    if (target) {
      if (!target.hasAttribute('tabindex') && !(target instanceof HTMLButtonElement)) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  };

  const showAsync = (screen: Promise<HTMLElement>) =>
    screen.then(show, (error: unknown) => show(placeholderScreen(nav, 'Something went wrong', String(error))));

  const nav: Nav = {
    start: () => showAsync(startScreen(nav, deviceDeps)),
    begin: (session) => nav.card(session),
    card: (session) => show(cardScreen(session, nav)),
    summary: (result) => show(summaryScreen(result, nav)),
    settings: () => showAsync(settingsScreen(nav)),
    addCard: () => nav.placeholder('Add card'),
    about: () => nav.placeholder('About'),
    placeholder: (title) => show(placeholderScreen(nav, title)),
  };
  nav.start();
}
