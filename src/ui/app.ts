import { AREAS, getArea, type AreaId } from '../areas/registry';
import { deviceDeps } from '../session/deck';
import { Session, type SessionResult } from '../session/run';
import { setLastArea } from '../store/db';
import { homeTokens } from '../theme/home';
import { applyTokens, type ThemeTokens } from '../theme/tokens';
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

/** Moves between screens; one is visible at a time, and every move is one history entry (no URL changes). */
export interface Nav {
  /** The home page: one tile per area (the first history entry, so this steps back to it). */
  home(): void;
  /** An area's page; without an argument, the area last opened. */
  area(area?: AreaId): void;
  /** One screen back: the same screen the phone's Back button shows (decision 50). */
  back(): void;
  begin(session: Session): void;
  card(session: Session): void;
  summary(result: SessionResult): void;
  settings(): void;
  addCard(): void;
  /** About, in the theme of the screen that opened it. */
  about(): void;
  /** The current area's course list. */
  courses(): void;
  /** A lesson of the current area. */
  lesson(id: string): void;
  placeholder(title: string): void;
}

/** What a history entry records: enough to draw the screen again. A session's card cannot be redrawn. */
type ScreenName = 'home' | 'area' | 'courses' | 'settings' | 'addCard' | 'about' | 'lesson' | 'session' | 'summary';

interface Entry {
  screen: ScreenName;
  /** The area whose theme the screen wears; none on the home page and on About opened from it. */
  area?: AreaId;
  lesson?: string;
  /** Position in this app's history: 0 is the home page. */
  index: number;
  /** Which page load wrote the entry; entries a reload left behind read as the home page. */
  page?: string;
}

const SCREENS: readonly ScreenName[] = ['home', 'area', 'courses', 'settings', 'addCard', 'about', 'lesson', 'session', 'summary'];
const HOME: Entry = { screen: 'home', index: 0 };

/**
 * A history entry read back from `history.state`. It comes from outside the app's control (another
 * version of the app, a stale entry), so every field is checked: an unknown screen or area, or a
 * missing one where the screen needs it, reads as the home page.
 */
export function readEntry(state: unknown, page: string): Entry {
  const s = (state ?? {}) as Partial<Record<keyof Entry, unknown>>;
  const screen = SCREENS.find((name) => name === s.screen);
  const index = typeof s.index === 'number' && Number.isInteger(s.index) && s.index >= 0 ? s.index : 0;
  if (s.page !== page) return HOME;
  if (!screen || screen === 'home') return { ...HOME, index };
  const area = typeof s.area === 'string' ? getArea(s.area)?.id : undefined;
  if (screen === 'about') return area ? { screen, area, index } : { screen, index };
  if (!area) return { ...HOME, index };
  if (screen === 'lesson') {
    return typeof s.lesson === 'string' && /^[\w-]{1,64}$/.test(s.lesson) ? { screen, area, lesson: s.lesson, index } : { screen: 'area', area, index };
  }
  return { screen, area, index };
}

/** Puts on a look: the token map, the browser's theme colour (the phone's status bar) and the title. */
function wear(tokens: ThemeTokens, name: string, title: string): void {
  const root = document.documentElement;
  if (root.dataset.theme !== name) applyTokens(root, tokens, name);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tokens['--base-color']!);
  document.title = `${title} · Godot Vocabulary`;
}

/** The home page's look: its own neutral theme (decision 49), applied before the first paint. */
export function applyHomeTheme(): void {
  wear(homeTokens(), 'home', 'Areas');
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

  const page = Math.random().toString(36).slice(2);
  const home: Entry = { ...HOME, page };
  // The screen on view, as its history entry records it.
  let current: Entry = home;
  // The session on the card screen, finished if the learner leaves it with Back.
  let live: Session | undefined;

  const areaOf = (entry: Entry): AreaId => entry.area ?? AREAS[0]!.id;

  /** The look a screen wears: its area's (recorded as the area used last), or the home page's. */
  const dress = (entry: Entry) => {
    const area = entry.area ? getArea(entry.area) : undefined;
    if (!area) return applyHomeTheme();
    wear(area.theme, area.id, area.label);
    void setLastArea(area.id).catch(() => undefined);
  };

  /** Draws the screen an entry records. A session or its summary cannot be drawn again: its area page stands in. */
  const draw = (entry: Entry) => {
    dress(entry);
    switch (entry.screen) {
      case 'home':
        return void showAsync(homeScreen(nav));
      case 'courses':
        return void showAsync(coursesScreen(nav, areaOf(entry)));
      case 'settings':
        return void showAsync(settingsScreen(nav));
      case 'addCard':
        return void showAsync(addCardScreen(nav));
      case 'about':
        return void showAsync(aboutScreen(nav));
      case 'lesson':
        return void showAsync(lessonScreen(nav, entry.lesson!, areaOf(entry)));
      default:
        return void showAsync(startScreen(nav, deviceDeps, areaOf(entry)));
    }
  };

  /** A new screen: one history entry on top of the current one. */
  const go = (entry: Omit<Entry, 'index' | 'page'>) => {
    current = { ...entry, index: current.index + 1, page };
    history.pushState(current, '');
    draw(current);
  };

  const leaveSession = () => {
    if (live) void live.finish().catch(() => undefined);
    live = undefined;
  };

  // The phone's Back (and the browser's) moves through the same entries the on-screen Back does.
  window.addEventListener('popstate', (event) => {
    leaveSession();
    current = { ...readEntry(event.state, page), page };
    if (current.screen === 'session' || current.screen === 'summary') current = { ...current, screen: 'area' };
    history.replaceState(current, '');
    draw(current);
  });

  const nav: Nav = {
    home: () => {
      if (current.index > 0) history.go(-current.index);
      else {
        current = home;
        history.replaceState(current, '');
        draw(current);
      }
    },
    area: (next) => go({ screen: 'area', area: getArea(next ?? current.area)?.id ?? AREAS[0]!.id }),
    back: () => {
      if (current.index > 0) history.back();
      else nav.home();
    },
    begin: (session) => {
      live = session;
      current = { screen: 'session', area: areaOf(current), index: current.index + 1, page };
      history.pushState(current, '');
      nav.card(session);
    },
    card: (session) => show(cardScreen(session, nav)),
    summary: (result) => {
      live = undefined;
      current = { ...current, screen: 'summary' };
      history.replaceState(current, '');
      show(summaryScreen(result, nav));
    },
    settings: () => go({ screen: 'settings', area: areaOf(current) }),
    addCard: () => go({ screen: 'addCard', area: areaOf(current) }),
    about: () => go(current.area ? { screen: 'about', area: current.area } : { screen: 'about' }),
    courses: () => go({ screen: 'courses', area: areaOf(current) }),
    lesson: (id) => go({ screen: 'lesson', area: areaOf(current), lesson: id }),
    placeholder: (title) => show(placeholderScreen(nav, title)),
  };

  // The app always opens the home page (decision 49), whatever entry a reload left behind.
  history.replaceState(home, '');
  draw(home);
  return nav;
}
