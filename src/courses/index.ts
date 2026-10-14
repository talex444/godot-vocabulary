import { AREAS, getArea, type AreaId } from '../areas/registry';
import type { Card } from '../cards/types';
import type { Lesson } from '../session/build';
import { isPlanned, type Course, type CourseLesson } from './types';

/** An area's courses, in the order its list shows them; they load with the area (decision 55). */
export async function coursesFor(area: AreaId): Promise<Course[]> {
  return (await (getArea(area) ?? AREAS[0]!).load()).courses;
}

/** Pretest size (decision 35). */
export const PRETEST_SIZE = 3;

export function findLesson(id: string, courses: readonly Course[]): { course: Course; lesson: CourseLesson } | undefined {
  for (const course of courses) {
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
export function sessionLessons(courses: readonly Course[]): Lesson[] {
  return courses.flatMap((course) =>
    course.lessons
      .filter((l): l is CourseLesson => !isPlanned(l))
      .sort((a, b) => a.order - b.order)
      .map((l) => ({ id: l.id, title: l.title, topic: l.page.title, cardIds: l.cardIds })),
  );
}
