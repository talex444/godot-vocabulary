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
import { switchTheme, type Point } from './transition';

/** Moves between screens; one is visible at a time, and every move is one history entry (no URL changes). */
export interface Nav {
  /** The home page: one tile per area (the first history entry, so this steps back to it). */
  home(): void;
  /**
   * An area's page, entered from the home page: loaded and built first, then wiped in from `origin`
   * (the tapped tile). Resolves when the wipe has finished; ignored while another switch runs. With
   * `lesson`, the tile's promise (decision 66): that lesson opens through the same wipe, over the
   * area page, so Back goes to the area page and then home.
   */
  area(area: AreaId, origin?: Point, lesson?: string): Promise<void>;
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
  /** A lesson opened from its home tile: the area page lies under it, not the course list. */
  fromHome?: true;
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
    if (typeof s.lesson !== 'string' || !/^[\w-]{1,64}$/.test(s.lesson)) return { screen: 'area', area, index };
    return s.fromHome === true ? { screen, area, lesson: s.lesson, fromHome: true, index } : { screen, area, lesson: s.lesson, index };
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

  /** Builds the screen an entry records. A session or its summary cannot be built again: its area page stands in. */
  const build = (entry: Entry): Promise<HTMLElement> => {
    switch (entry.screen) {
      case 'home':
        return homeScreen(nav);
      case 'courses':
        return coursesScreen(nav, areaOf(entry));
      case 'settings':
        return settingsScreen(nav);
      case 'addCard':
        return addCardScreen(nav);
      case 'about':
        return aboutScreen(nav);
      case 'lesson':
        return lessonScreen(nav, entry.lesson!, areaOf(entry), entry.fromHome ? 'Back' : 'Back to courses');
      default:
        return startScreen(nav, deviceDeps, areaOf(entry));
    }
  };

  // While a theme switch runs (from the tap, through the load, to the wipe's end) taps on tiles and
  // Back are ignored; a phone Back pressed meanwhile is applied once the switch has finished.
  let switching = false;
  let poppedWhileSwitching = false;

  /**
   * Draws the screen an entry records. Within one theme it just swaps the screen. Across themes the
   * order is fixed (decision 51): the area's deck and courses load and its screen is built (and its
   * font faces are ready, so the first Godot entry has no font jump) before the wipe starts.
   */
  const draw = async (entry: Entry, origin?: Point) => {
    const look = entry.area ? getArea(entry.area) : undefined;
    const crossing = document.documentElement.dataset.theme !== (look?.id ?? 'home');
    if (crossing) switching = true;
    try {
      const screen = await build(entry).catch((error: unknown) => placeholderScreen(nav, 'Something went wrong', String(error)));
      if (entry !== current) return;
      const apply = () => {
        dress(entry);
        show(screen);
      };
      if (!crossing) return apply();
      await fontsFor(look?.theme ?? homeTokens());
      await switchTheme(apply, origin);
    } finally {
      if (crossing) {
        switching = false;
        if (poppedWhileSwitching) {
          poppedWhileSwitching = false;
          popped(history.state);
        }
      }
    }
  };

  /** A new screen: one history entry on top of the current one. */
  const go = (entry: Omit<Entry, 'index' | 'page'>, origin?: Point) => {
    current = { ...entry, index: current.index + 1, page };
    history.pushState(current, '');
    return draw(current, origin);
  };

  const leaveSession = () => {
    if (live) void live.finish().catch(() => undefined);
    live = undefined;
  };

  // The phone's Back (and the browser's) moves through the same entries the on-screen Back does.
  const popped = (state: unknown) => {
    leaveSession();
    current = { ...readEntry(state, page), page };
    if (current.screen === 'session' || current.screen === 'summary') current = { ...current, screen: 'area' };
    history.replaceState(current, '');
    void draw(current);
  };
  window.addEventListener('popstate', (event) => {
    if (switching) poppedWhileSwitching = true;
    else popped(event.state);
  });

  const nav: Nav = {
    home: () => {
      if (switching) return;
      if (current.index > 0) history.go(-current.index);
      else {
        current = home;
        history.replaceState(current, '');
        void draw(current);
      }
    },
    area: async (next, origin, lesson) => {
      if (switching) return;
      const area = getArea(next)?.id ?? AREAS[0]!.id;
      if (lesson === undefined) return go({ screen: 'area', area }, origin);
      // The area page's entry goes under the lesson unbuilt; Back draws it then (decision 66).
      current = { screen: 'area', area, index: current.index + 1, page };
      history.pushState(current, '');
      await go({ screen: 'lesson', area, lesson, fromHome: true }, origin);
    },
    back: () => {
      if (switching) return;
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
    settings: () => void go({ screen: 'settings', area: areaOf(current) }),
    addCard: () => void go({ screen: 'addCard', area: areaOf(current) }),
    about: () => void go(current.area ? { screen: 'about', area: current.area } : { screen: 'about' }),
    courses: () => void go({ screen: 'courses', area: areaOf(current) }),
    lesson: (id) => void go({ screen: 'lesson', area: areaOf(current), lesson: id }),
    placeholder: (title) => show(placeholderScreen(nav, title)),
  };

  // The app always opens the home page (decision 49), whatever entry a reload left behind.
  history.replaceState(home, '');
  void draw(home);
  return nav;
}

/** Waits for the font faces a token map names (Inter and JetBrains Mono for Godot; none for system fonts). */
async function fontsFor(tokens: ThemeTokens): Promise<void> {
  const faces = [`400 16px ${tokens['--font-ui']}`, `700 16px ${tokens['--font-ui']}`, `400 16px ${tokens['--font-code']}`];
  await Promise.all(faces.map((font) => document.fonts.load(font))).catch(() => undefined);
}
