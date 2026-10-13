import { COURSES } from '../../courses/index';
import { isPlanned } from '../../courses/types';
import { getLessonsDoneIds } from '../../store/db';
import type { Nav } from '../app';
import { button, el, heading, panel } from '../kit';

/** The course list (decision 37): each course's lessons in order, a tick on the done ones, any reopenable. */
export async function coursesScreen(nav: Nav): Promise<HTMLElement> {
  const done = new Set(await getLessonsDoneIds());
  const courses = COURSES.map((course, index) =>
    panel(
      [
        index === 0 ? heading('Courses') : null,
        el('h3', { class: 'gv-family__name', text: `Course ${index + 1}: ${course.title}` }),
        el(
          'ol',
          { class: 'gv-lessons' },
          course.lessons.map((lesson) => {
            const number = el('span', { class: 'gv-lesson-row__number', text: String(lesson.order), attrs: { 'aria-hidden': 'true' } });
            if (isPlanned(lesson)) {
              return el('li', { class: 'gv-lesson-row gv-lesson-row--planned', attrs: { 'data-lesson-id': lesson.id } }, [
                number,
                el('span', { class: 'gv-lesson-row__text' }, [
                  el('span', { class: 'gv-lesson-row__title', text: `Lesson ${lesson.order}: ${lesson.title}` }),
                  el('span', { class: 'gv-note', text: 'Coming in a later version.' }),
                ]),
              ]);
            }
            const finished = done.has(lesson.id);
            const row = el('button', { class: 'gv-lesson-row', attrs: { type: 'button' } }, [
              number,
              el('span', { class: 'gv-lesson-row__text' }, [
                el('span', { class: 'gv-lesson-row__title', text: `Lesson ${lesson.order}: ${lesson.title}` }),
                el('span', { class: 'gv-note', text: lesson.page.title }),
              ]),
              finished ? tick() : null,
              finished ? el('span', { class: 'gv-visually-hidden', text: ' (done)' }) : null,
            ]);
            row.addEventListener('click', () => nav.lesson(lesson.id));
            return el('li', { attrs: { 'data-lesson-id': lesson.id, 'data-done': String(finished) } }, [row]);
          }),
        ),
      ],
      { class: 'gv-stack' },
    ),
  );
  return el('div', { class: 'gv-screen' }, [
    ...courses,
    el('nav', { class: 'gv-links', attrs: { 'aria-label': 'Back' } }, [button('Back', { variant: 'secondary', onClick: () => nav.start() })]),
  ]);
}

/** The done tick, drawn like the editor's check glyph. */
function tick(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'gv-tick');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M3 8.5l3 3 7-7');
  svg.append(path);
  return svg;
}
