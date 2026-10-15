import { recallAfter, type CourseLesson, type RecallCheck, type TermTreatment } from './types';

/**
 * The structure of a term lesson's page (decision 71), apart from the DOM so it can be tested: the term
 * list, then one section per term, with a recall step after every fourth term and after the last.
 * `src/ui/screens/lesson.ts` draws exactly this.
 */

/** The six labels of a term section, in order: the `dt`s of its definition list. */
export const TERM_PARTS = ['What it is', 'When you’d reach for it', 'Where it lives', 'Example', 'Not to be confused with', 'Check'] as const;

/** The id of a term section's heading, the target of its link in the term list. */
export function termAnchor(cardId: string): string {
  return `term-${cardId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

/** Whether a term's name is code (an API or GDScript card): typed answers to it are case-sensitive. */
export function isCodeName(cardId: string): boolean {
  return /^(api|gd):/.test(cardId);
}

export type TermPageItem =
  | { kind: 'term'; index: number; name: string; anchor: string; term: TermTreatment; caseSensitive: boolean }
  | { kind: 'recall'; index: number; after: number; check: RecallCheck; caseSensitive: boolean };

export interface TermPage {
  /** "In this lesson:", each name a same-page link to its section. */
  list: { name: string; href: string }[];
  items: TermPageItem[];
}

/** The term list and the sections in page order; `nameOf` gives a card's displayed name (`termName`). */
export function termPage(lesson: CourseLesson, nameOf: (cardId: string) => string | undefined): TermPage {
  const terms = lesson.terms ?? [];
  const sections = terms.map((term, index) => ({
    kind: 'term' as const,
    index,
    name: nameOf(term.cardId) ?? term.check.answer,
    anchor: termAnchor(term.cardId),
    term,
    caseSensitive: isCodeName(term.cardId),
  }));
  const after = recallAfter(terms.length);
  const items: TermPageItem[] = [];
  for (const section of sections) {
    items.push(section);
    after.forEach((count, index) => {
      const check = lesson.recall?.[index];
      if (count !== section.index + 1 || !check) return;
      const asked = sections.find((s) => s.name === check.answer);
      items.push({ kind: 'recall', index, after: count, check, caseSensitive: asked?.caseSensitive ?? true });
    });
  }
  return { list: sections.map((s) => ({ name: s.name, href: `#${s.anchor}` })), items };
}
