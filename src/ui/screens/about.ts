import { version } from '../../../package.json';
import { familyLabel } from '../../areas/registry';
import { FAMILIES, type Family } from '../../cards/types';
import deckCounts from '../../data/deck-counts.json';
import { listCustomCards } from '../../store/db';
import type { Nav } from '../app';
import { button, el, heading, panel, stat } from '../kit';

export const REPO_URL = 'https://github.com/talex444/godot-vocabulary';
/** New Android packages are published here (decision 28); the app itself never checks. */
export const RELEASES_URL = `${REPO_URL}/releases`;

/** Cards per generated deck, written by `pnpm generate` so About never loads a deck. */
const DECK_COUNTS = deckCounts as Record<Family, number>;

/** Every notice in THIRD_PARTY_NOTICES.md, as the learner reads it. */
export const ATTRIBUTIONS: readonly [work: string, notice: string][] = [
  [
    'Godot Engine 4.7 (class reference, class icons, editor theme colours), MIT licence',
    'Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md). Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.',
  ],
  [
    'Godot documentation, branch 4.7 (GDScript manual, first-2D-game tutorial), CC BY 3.0',
    'Juan Linietsky, Ariel Manzur and the Godot community. https://creativecommons.org/licenses/by/3.0/ — text adapted into question form.',
  ],
  [
    'Godot documentation, branch 4.7 (getting-started pages and their screenshots, in the courses), CC BY 3.0',
    'Juan Linietsky, Ariel Manzur and the Godot community. https://creativecommons.org/licenses/by/3.0/ — sentences quoted with framing text and questions added; screenshots unchanged.',
  ],
  [
    'GitHub Docs glossary, CC BY 4.0',
    '© GitHub, Inc. https://creativecommons.org/licenses/by/4.0/ — terms filtered by an allow-list and adapted into question form.',
  ],
  ['Godot demo projects, MIT licence (class frequency counts only; no demo code is shipped)', 'Copyright (c) Godot Engine contributors.'],
  ['GitHub Desktop (the dark theme’s colours, corner radius and font stacks, in the Git & GitHub area), MIT licence', 'Copyright (c) GitHub, Inc.'],
  ['Primer CSS colour system (the palette GitHub Desktop’s dark theme uses), MIT licence', 'Copyright (c) 2018 GitHub Inc.'],
  ['Inter, SIL Open Font License 1.1', 'Copyright (c) 2016 The Inter Project Authors.'],
  ['JetBrains Mono, SIL Open Font License 1.1', 'Copyright 2020, The JetBrains Mono Project Authors.'],
  ['ts-fsrs, MIT licence', 'Copyright (c) 2026 Open Spaced Repetition.'],
  ['idb, ISC licence', 'Copyright (c) 2016, Jake Archibald.'],
  ['Workbox (the offline service worker), MIT licence', 'Copyright Google LLC.'],
  ['Capacitor: @capacitor/core and @capacitor/android (the Android app), MIT licence', 'Copyright (c) 2017-present Drifty Co.'],
  ['@capacitor/local-notifications (the Android app’s daily reminder), MIT licence', 'Copyright 2020-present Ionic.'],
  ['AndroidX libraries (the Android app), Apache License 2.0', 'Copyright The Android Open Source Project.'],
];

/** What the app is, who made what it is built from, and where its code lives. */
export async function aboutScreen(nav: Nav): Promise<HTMLElement> {
  const custom = await listCustomCards();
  const counts = FAMILIES.map((family) => stat(familyLabel(family), DECK_COUNTS[family] ?? 0));

  return el('div', { class: 'gv-screen' }, [
    panel(
      [
        heading('About'),
        el('p', {
          text: 'Godot Vocabulary drills the words of the Godot 4.7 API, GDScript and Git/GitHub as four-choice cards, scheduled so each comes back just before you would forget it.',
        }),
        el('p', { text: 'It is free, works offline, and keeps everything on this device: no accounts, no tracking.' }),
        el('p', { class: 'gv-label', text: 'An unofficial community project. Not affiliated with or endorsed by the Godot Foundation or GitHub.' }),
        el('p', { class: 'gv-note', text: 'The Godot logo is not used; the app icon is its own glyph.' }),
      ],
      { class: 'gv-stack' },
    ),
    panel(
      [
        heading('Lessons and cards', 3),
        el('p', {
          text: 'Learning a word takes two paths. One is understanding: what a scene or a signal is, how the parts fit, why it works that way. The other is recall: the name coming to mind the moment you need it. The course lessons teach the first; they explain one idea at a time in the manual’s own words. The cards teach the second; they bring each name back until it comes without effort.',
        }),
        el('p', {
          text: 'Why memorise when the docs are a click away? Looking something up breaks the thread of what you were building. And the words you know pick the right meaning for the context you are in; a search cannot do that for you.',
        }),
      ],
      { class: 'gv-stack' },
    ),
    panel(
      [
        heading('Cards', 3),
        el('dl', { class: 'gv-stats' }, counts),
        el('p', { class: 'gv-note', text: `Plus ${custom.length} of your own.` }),
      ],
      { class: 'gv-stack' },
    ),
    panel(
      [
        heading('Credits and licences', 3),
        el(
          'ul',
          { class: 'gv-credits' },
          ATTRIBUTIONS.map(([work, notice]) => el('li', {}, [el('p', { class: 'gv-label', text: work }), el('p', { class: 'gv-note', text: notice })])),
        ),
        el('p', { text: 'The app’s own code is MIT-licensed.' }),
        el('a', { class: 'gv-link', text: 'Source code on GitHub', attrs: { href: REPO_URL, rel: 'noopener' } }),
        el('p', { class: 'gv-note', text: `Version ${version}` }),
        // Opens the browser (in the Android package too: the WebView hands other sites to Android).
        el('a', { class: 'gv-link', text: 'Check for updates', attrs: { href: RELEASES_URL, target: '_blank', rel: 'noopener' } }),
      ],
      { class: 'gv-stack' },
    ),
    el('nav', { class: 'gv-links', attrs: { 'aria-label': 'Back' } }, [button('Back', { variant: 'secondary', onClick: () => nav.start() })]),
  ]);
}
