import type { SessionResult } from '../../session/run';
import type { Nav } from '../app';
import { button, el, heading, panel, stat } from '../kit';

/** The end of a session: seen, right, wrong, and what tomorrow holds. */
export function summaryScreen(result: SessionResult, nav: Nav): HTMLElement {
  const done = button('Done', { variant: 'primary', onClick: () => nav.start() });
  done.classList.add('gv-wide');
  const learning = result.learned + result.continueTomorrow > 0;
  return el('div', { class: 'gv-screen' }, [
    panel(
      [
        heading('Session done'),
        el('dl', { class: 'gv-stats gv-stats--summary' }, [
          stat('Cards seen', result.seen),
          stat('Right', result.right),
          stat('Wrong', result.wrong),
          stat('Due tomorrow', result.dueTomorrow),
          learning ? stat('Cards learned', result.learned) : null,
          learning ? stat('Continue tomorrow', result.continueTomorrow) : null,
        ]),
        learning
          ? el('p', {
              class: 'gv-note',
              text: 'A new card counts as learned after three looks with the last one right. The rest carry on at their next review.',
            })
          : null,
        el('p', {
          class: 'gv-note',
          text: result.seen === 0 ? 'No cards answered this time.' : 'Progress is saved on this device after every answer.',
        }),
        done,
      ],
      { class: 'gv-stack' },
    ),
  ]);
}
