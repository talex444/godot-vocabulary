import type { Nav } from '../app';
import { button, el, heading, panel } from '../kit';

/** Settings, Add card and About arrive in session GV-2c; until then this screen says so. */
export function placeholderScreen(nav: Nav, title: string, message?: string): HTMLElement {
  return el('div', { class: 'gv-screen' }, [
    panel(
      [
        heading(title),
        el('p', { text: message ?? `The ${title} screen arrives in the next build (session GV-2c).` }),
        button('Back', { variant: 'secondary', onClick: () => nav.start() }),
      ],
      { class: 'gv-stack' },
    ),
  ]);
}
