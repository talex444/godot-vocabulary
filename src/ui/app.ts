import { AREAS, getArea, type AreaId } from '../areas/registry';
import { deviceDeps } from '../session/deck';
import { Session, type SessionResult } from '../session/run';
import { setLastArea } from '../store/db';
import { homeTokens } from '../theme/home';
import { applyTokens } from '../theme/tokens';
import { aboutScreen } from './screens/about';
import { addCardScreen } from './screens/add-card';
import { cardScreen } from './screens/card';
import { coursesScreen } from './screens/courses';
import { homeScreen } from './screens/home';
import { lessonScreen } from './screens/lesson';
import { placeholderScreen } from './screens/placeholder';
import { settingsScreen } from './screens/settings';
import { startScreen } from './screens/start';
import { summaryScreen } from './screens/summary';

/** Moves between screens; one is visible at a time, no router and no URL changes. */
export interface Nav {
  /** The home page: one tile per area. */
  home(): void;
  /** An area's page; without an argument, the area last opened. */
  area(area?: AreaId): void;
  begin(session: Session): void;
  card(session: Session): void;
  summary(result: SessionResult): void;
  settings(): void;
  addCard(): void;
  about(): void;
  /** An area's course list; without an argument, the area last opened. */
  courses(area?: AreaId): void;
  /** A lesson of the area last opened. */
  lesson(id: string): void;
  placeholder(title: string): void;
}

/** The home page's look: its own neutral theme (decision 49), applied before the first paint. */
export function applyHomeTheme(): void {
  const root = document.documentElement;
  if (root.dataset.theme !== 'home') applyTokens(root, homeTokens(), 'home');
  document.title = 'Areas · Godot Vocabulary';
}

export function mountApp(host: HTMLElement): Nav {
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

  // The area the screens belong to: the one entered last.
  let area: AreaId = AREAS[0]!.id;

  // Entering an area puts on its look (decision 47) and records it for the home tile's tag.
  const enter = (next: AreaId | undefined) => {
    const entered = getArea(next ?? area) ?? AREAS[0]!;
    area = entered.id;
    const root = document.documentElement;
    if (root.dataset.theme !== entered.id) applyTokens(root, entered.theme, entered.id);
    document.title = `${entered.label} · Godot Vocabulary`;
    void setLastArea(area).catch(() => undefined);
    return area;
  };

  const nav: Nav = {
    home: () => {
      applyHomeTheme();
      void showAsync(homeScreen(nav));
    },
    area: (next) => showAsync(startScreen(nav, deviceDeps, enter(next))),
    begin: (session) => nav.card(session),
    card: (session) => show(cardScreen(session, nav)),
    summary: (result) => show(summaryScreen(result, nav)),
    settings: () => showAsync(settingsScreen(nav)),
    addCard: () => showAsync(addCardScreen(nav)),
    about: () => showAsync(aboutScreen(nav)),
    courses: (next) => showAsync(coursesScreen(nav, enter(next))),
    lesson: (id) => showAsync(lessonScreen(nav, id, area)),
    placeholder: (title) => show(placeholderScreen(nav, title)),
  };
  // The app always opens the home (decision 49).
  nav.home();
  return nav;
}
