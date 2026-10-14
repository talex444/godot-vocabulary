import type { Nav } from '../app';
import { button, el, heading, panel } from '../kit';

/** A title, one message and Back; used when a screen fails to load. */
export function placeholderScreen(nav: Nav, title: string, message?: string): HTMLElement {
  return el('div', { class: 'gv-screen' }, [
    panel(
      [
        heading(title),
        el('p', { text: message ?? `The ${title} screen is not available.` }),
        button('Back', { variant: 'secondary', onClick: () => nav.back() }),
      ],
      { class: 'gv-stack' },
    ),
  ]);
}
