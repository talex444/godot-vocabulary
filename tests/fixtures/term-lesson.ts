import { recallAfter, type Course, type CourseLesson, type RecallCheck, type TermTreatment } from '../../src/courses/types';

// A term lesson (decision 71) built from real class cards, for the schema, the term check and the
// page's structure. Its words are placeholders: no course file carries a term lesson yet (GV-8m).

/** Class names with cards in the decks, in teaching order. */
export const TERM_CLASSES = ['Node', 'Node2D', 'Sprite2D', 'Camera2D', 'Timer', 'Area2D', 'Label', 'Button', 'AnimationPlayer'] as const;

const PAGE = { title: "Overview of Godot's key concepts", url: 'https://docs.godotengine.org/en/4.7/getting_started/introduction/key_concepts_overview.html' };

export function termTreatment(name: string, i: number, others: readonly string[]): TermTreatment {
  const choices = [name, ...others.filter((o) => o !== name).slice(0, 3)] as [string, string, string, string];
  return {
    cardId: `api:class:${name}`,
    what: { text: `The manual says a \`${name}\` “is one of the building blocks of a game.”`, page: PAGE },
    when: 'You reach for it when the game needs this part.',
    where: {
      text: 'It shows in the Scene dock, at the top left of the editor.',
      ...(i === 0 ? { image: { src: 'key_concepts_character_nodes.webp', alt: 'The Scene dock.', caption: 'The Scene dock.', width: 609, height: 295 } } : {}),
    },
    example: {
      text: 'Built node by node in the Scene dock.',
      ...(i === 0 ? { drawing: { caption: 'A small tree.', nodes: [{ name: 'Player', type: 'Node2D', depth: 0 }, { name: 'Sprite', type: 'Sprite2D', depth: 1 }] } } : {}),
    },
    // A phrase that names no card is plain words ("Scene dock" is a card since GV-8n).
    contrast: { other: i === 0 ? 'Inspector dock' : TERM_CLASSES[0], text: 'The other one is a different thing.' },
    // Every second term is typed, the rest picked from four names.
    check: { prompt: 'Which class is the building block described above?', answer: name, why: 'That is its description.', ...(i % 2 === 0 ? { choices } : {}) },
  };
}

/** A written term lesson teaching `names`, with its recall checks, valid against `validateCourse` and the term check. */
export function termLesson(names: readonly string[] = TERM_CLASSES.slice(0, 5)): CourseLesson {
  const terms = names.map((name, i) => termTreatment(name, i, names.length >= 4 ? names : TERM_CLASSES));
  const recall: RecallCheck[] = recallAfter(terms.length).map((after) => ({
    prompt: 'Without scrolling up: which class was the last building block above?',
    answer: names[after - 1]!,
    why: 'It was the section just above.',
  }));
  return {
    id: 'tl-0',
    order: 0,
    title: 'What is a term lesson made of?',
    page: PAGE,
    cardIds: names.map((n) => `api:class:${n}`),
    need: 'A paragraph that develops the question.',
    agenda: ['One.', 'Two.', 'Three.'],
    terms,
    recall,
    compare: {
      a: { title: 'A', text: 'One example.' },
      b: { title: 'B', text: 'Another example.' },
      question: { prompt: 'What do they share?', choices: ['a', 'b', 'c', 'd'], answer: 0, why: 'Because.' },
    },
    exercises: [{ type: 'predict', prompt: 'What happens?', choices: ['a', 'b', 'c', 'd'], answer: 1, why: 'Because.' }],
    errors: [
      { what: 'One error.', fix: 'Its fix.', source: "Godot manual, Overview of Godot's key concepts" },
      { what: 'Another error.', fix: 'Its fix.', source: "Godot manual, Overview of Godot's key concepts" },
    ],
    exitStem: 'A term lesson is made of …',
  };
}

export function termCourse(names?: readonly string[]): Course {
  return { id: 'term-course', area: 'godot', title: 'Term course', lessons: [termLesson(names)] };
}
