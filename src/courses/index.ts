import type { Card } from '../cards/types';
import course1 from '../data/courses/course-1.json';
import type { Lesson } from '../session/build';
import { isPlanned, type Course, type CourseLesson } from './types';

/** Every course, in the order the list shows them. */
export const COURSES: readonly Course[] = [course1 as Course];

/** Pretest size (decision 35). */
export const PRETEST_SIZE = 3;

export function findLesson(id: string): { course: Course; lesson: CourseLesson } | undefined {
  for (const course of COURSES) {
    const lesson = course.lessons.find((l) => l.id === id);
    if (lesson && !isPlanned(lesson)) return { course, lesson };
  }
  return undefined;
}

/** The pretest: the lesson's three cards with the best frequency rank. */
export function pretestCards(lesson: CourseLesson, cards: readonly Card[]): Card[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return lesson.cardIds
    .map((id) => byId.get(id))
    .filter((c): c is Card => c !== undefined)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, PRETEST_SIZE);
}

/** The written lessons as the session builder sees them (course mode puts their cards first). */
export function sessionLessons(): Lesson[] {
  return COURSES.flatMap((course) =>
    course.lessons
      .filter((l): l is CourseLesson => !isPlanned(l))
      .sort((a, b) => a.order - b.order)
      .map((l) => ({ id: l.id, title: l.title, topic: l.page.title, cardIds: l.cardIds })),
  );
}
