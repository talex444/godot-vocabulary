import { describe, expect, it } from 'vitest';
import type { Card } from '../../src/cards/types';
import gdscript from '../../src/data/cards.gdscript.json';

const cards = gdscript as Card[];
const KINDS = ['keyword', 'annotation', 'builtin', 'lifecycle', 'concept', 'operator'];

/** True when `answer` shows up in `text` as a whole token (words) or anywhere (symbols). */
function leaks(text: string, answer: string): boolean {
  const core = answer.replace(/\(\)$/, '');
  const unblanked = text.replaceAll('____', ' ');
  if (/^[@\w][\w ]*$/.test(core)) {
    const escaped = core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\w@])${escaped}(?!\\w)`, 'i').test(unblanked);
  }
  return unblanked.includes(core);
}

describe('language cards (data/cards/gdscript.json)', () => {
  it('has at least 100 cards covering every kind', () => {
    expect(cards.length).toBeGreaterThanOrEqual(100);
    expect(new Set(cards.map((c) => c.kind))).toEqual(new Set(KINDS));
  });

  it('uses stable ids, the gdscript family and a manual source', () => {
    for (const c of cards) {
      expect(c.family, c.id).toBe('gdscript');
      expect(KINDS, c.id).toContain(c.kind);
      expect(c.id.startsWith(`gd:${c.kind}:`), c.id).toBe(true);
      expect(c.source.doc, c.id).toBe('godot-docs 4.7');
      expect(c.source.version, c.id).toBe('4.7');
      expect(c.source.ref, c.id).toMatch(/^[\w/@.-]+#.+/);
    }
  });

  it('ranks the cards 0..n-1 with the keyword rows first', () => {
    const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
    expect(ranks).toEqual(cards.map((_, i) => i));
    const order = [...cards].sort((a, b) => a.rank - b.rank).map((c) => c.answer);
    expect(order.slice(0, 5)).toEqual(['extends', 'func', 'void', 'var', 'if']);
  });

  it('never shows the answer in the prompt or the code', () => {
    for (const c of cards) {
      expect(leaks(c.prompt, c.answer), `${c.id} prompt`).toBe(false);
      if (c.code) expect(leaks(c.code, c.answer), `${c.id} code`).toBe(false);
    }
  });

  it('gives snippet cards 3 to 6 lines with exactly one blank', () => {
    const snippets = cards.filter((c) => c.code);
    for (const c of snippets) {
      expect(c.code!.split('\n').length, c.id).toBeGreaterThanOrEqual(3);
      expect(c.code!.split('\n').length, c.id).toBeLessThanOrEqual(6);
      expect(c.code!.split('____').length - 1, c.id).toBe(1);
    }
    // Two prompt styles, roughly half each.
    expect(snippets.length / cards.length).toBeGreaterThan(0.35);
    expect(snippets.length / cards.length).toBeLessThan(0.65);
  });

  it('keeps explanations to one or two sentences', () => {
    for (const c of cards) {
      const sentences = c.explain.split(/[.!?](?:\s|$)/).filter((s) => s.trim());
      expect(sentences.length, c.id).toBeLessThanOrEqual(2);
    }
  });
});
