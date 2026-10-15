import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadDecks } from '../../scripts/check-lessons.mjs';
import type { Card } from '../../src/cards/types';
import { judgeRecall } from '../../src/courses/blank';
import { termName } from '../../src/courses/index';
import { isCodeName, termAnchor, TERM_PARTS, termPage, type TermPageItem } from '../../src/courses/terms';
import { termLesson, TERM_CLASSES } from '../fixtures/term-lesson';

// Decision 71 on the page: the term list, one section per term with six labelled parts, a recall step
// after every fourth term and after the last. `lesson.ts` draws `termPage` as it is (no DOM here).

const byId = new Map((loadDecks() as Card[]).map((c) => [c.id, c]));
const nameOf = (id: string) => {
  const card = byId.get(id);
  return card ? termName(card) : undefined;
};

/** The page as a list of words: a term by its name, a recall by the term count above it. */
const outline = (items: TermPageItem[]) => items.map((i) => (i.kind === 'term' ? i.name : `Recall after ${i.after}`));

describe('a term section (decision 71)', () => {
  it('has six labelled parts in the decision’s order', () => {
    expect(TERM_PARTS).toEqual(['What it is', 'When you’d reach for it', 'Where it lives', 'Example', 'Not to be confused with', 'Check']);
    // The page draws the definition list from these labels, a dt and a dd each, in this order.
    const source = readFileSync(new URL('../../src/ui/screens/lesson.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/el\('dl', \{ class: 'gv-term' \}, TERM_PARTS\.flatMap\(\(label, i\) => \[el\('dt', \{ class: 'gv-label', text: label \}\), el\('dd', \{\}, parts\[i\]!\)\]\)\)/);
    expect(source).toMatch(/const parts: \(Node \| null\)\[\]\[\] = \[\n\s+\[\.\.\.paragraphs\(term\.what\.text\), manualLink\(term\.what\.page\)\],\n\s+paragraphs\(term\.when\),\n\s+\[\.\.\.paragraphs\(term\.where\.text\)/);
  });

  it('is headed by the card’s name, with an id the term list links to', () => {
    const page = termPage(termLesson(), nameOf);
    const terms = page.items.filter((i) => i.kind === 'term');
    expect(terms.map((t) => t.name)).toEqual(['Node', 'Node2D', 'Sprite2D', 'Camera2D', 'Timer']);
    expect(terms.map((t) => t.anchor)).toEqual(['term-api-class-node', 'term-api-class-node2d', 'term-api-class-sprite2d', 'term-api-class-camera2d', 'term-api-class-timer']);
    expect(page.list).toEqual(terms.map((t) => ({ name: t.name, href: `#${t.anchor}` })));
    expect(new Set(page.list.map((l) => l.href)).size).toBe(5);
    expect(termAnchor('gh:term:pull-request')).toBe('term-gh-term-pull-request');
  });

  it('places a recall after term 4 and after the last: 5 terms and 8 terms', () => {
    expect(outline(termPage(termLesson(), nameOf).items)).toEqual(['Node', 'Node2D', 'Sprite2D', 'Camera2D', 'Recall after 4', 'Timer', 'Recall after 5']);
    expect(outline(termPage(termLesson(TERM_CLASSES.slice(0, 8)), nameOf).items)).toEqual([
      'Node', 'Node2D', 'Sprite2D', 'Camera2D', 'Recall after 4', 'Timer', 'Area2D', 'Label', 'Button', 'Recall after 8',
    ]);
    // Each recall carries its own check, in order.
    const recalls = termPage(termLesson(TERM_CLASSES.slice(0, 8)), nameOf).items.filter((i) => i.kind === 'recall');
    expect(recalls.map((r) => [r.index, r.check.answer])).toEqual([[0, 'Camera2D'], [1, 'Button']]);
  });

  it('a chunk lesson has no term page', () => {
    const lesson = termLesson();
    delete lesson.terms;
    expect(termPage(lesson, nameOf)).toEqual({ list: [], items: [] });
  });
});

describe('the typed recall check', () => {
  it('marks a class name right only when exact, with a case hint, then the answer after two misses', () => {
    expect(judgeRecall(' Sprite2D ', 'Sprite2D', 0, true)).toEqual({ verdict: 'right', misses: 0 });
    expect(judgeRecall('sprite2d', 'Sprite2D', 0, true)).toEqual({ verdict: 'case', misses: 1 });
    expect(judgeRecall('Node2D', 'Sprite2D', 0, true)).toEqual({ verdict: 'wrong', misses: 1 });
    expect(judgeRecall('Node2D', 'Sprite2D', 1, true)).toEqual({ verdict: 'shown', misses: 2 });
    expect(judgeRecall('   ', 'Sprite2D', 1, true)).toEqual({ verdict: 'empty', misses: 1 });
  });

  it('marks a name that is not code without case, spaces tidied', () => {
    expect(judgeRecall('scene   DOCK', 'Scene dock', 0, false)).toEqual({ verdict: 'right', misses: 0 });
    expect(judgeRecall('Inspector', 'Scene dock', 0, false)).toEqual({ verdict: 'wrong', misses: 1 });
  });

  it('is case-sensitive for API and GDScript cards, and so for the recall that asks for one', () => {
    expect([isCodeName('api:class:Node'), isCodeName('gd:keyword:extends'), isCodeName('gh:term:repository')]).toEqual([true, true, false]);
    const page = termPage(termLesson(), nameOf);
    expect(page.items.every((i) => i.caseSensitive)).toBe(true);
  });
});
