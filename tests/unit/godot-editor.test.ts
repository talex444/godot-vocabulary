import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Card } from '../../src/cards/types';
import editor from '../../src/data/cards.godot-editor.json';

// Done-criteria 92: the godot-editor family, hand-written from the manual's "First look" page.

const cards = editor as Card[];
const handWritten = JSON.parse(readFileSync('data/cards/godot-editor.json', 'utf8')) as Card[];
const KINDS = ['dock', 'screen', 'panel', 'control'];
const PAGE = 'getting_started/introduction/first_look_at_the_editor';
const SECTIONS = ['The Project Manager', "First look at Godot's editor", 'The five main screens', 'Integrated class reference'];
// The page itself lives in the gitignored data/sources (`pnpm fetch-sources`), so on CI it is absent: the
// checks against its text run only where it is on disk, as deck.test.ts does with the class XML.
const rstPath = `data/sources/godot-docs/${PAGE.replace(/\//g, '_')}.rst`;
const rst = existsSync(rstPath) ? readFileSync(rstPath, 'utf8') : null;

describe('editor cards (data/cards/godot-editor.json)', () => {
  it('names the sixteen parts of the editor as the page writes them', () => {
    expect(cards.map((c) => c.answer).sort()).toEqual(
      [
        'Scene dock', 'Inspector', 'FileSystem dock', 'viewport', 'toolbar', 'bottom panel', '2D screen', '3D screen',
        'Script screen', 'Game screen', 'Asset Library', 'main menu', 'playtest buttons', 'scene tabs', 'Project Manager', 'class reference',
      ].sort(),
    );
  });

  it('is the hand-written file, enriched: same cards, same order, nothing hand-written changed', () => {
    expect(cards.map((c) => c.id)).toEqual(handWritten.map((c) => c.id));
    cards.forEach((c, i) => {
      for (const [key, value] of Object.entries(handWritten[i]!)) expect(c[key as keyof Card], `${c.id}.${key}`).toEqual(value);
    });
  });

  it('uses stable ids, the godot-editor family and a section of the page as its source', () => {
    for (const c of cards) {
      expect(c.family, c.id).toBe('godot-editor');
      expect(KINDS, c.id).toContain(c.kind);
      expect(c.id, c.id).toMatch(new RegExp(`^editor:${c.kind}:[a-z0-9-]+$`));
      expect(c.source, c.id).toEqual({ doc: 'godot-docs 4.7', ref: expect.stringMatching(new RegExp(`^${PAGE}#`)), version: '4.7' });
      expect(SECTIONS, c.id).toContain(c.source.ref.split('#')[1]);
    }
    if (rst !== null) for (const section of SECTIONS) expect(rst, section).toContain(`\n${section}\n`);
  });

  it('ranks the cards 0..n-1, the parts course 1 uses first', () => {
    expect(cards.map((c) => c.rank).sort((a, b) => a - b)).toEqual(cards.map((_, i) => i));
    const first = [...cards].sort((a, b) => a.rank - b.rank).slice(0, 3).map((c) => c.answer);
    expect(first).toEqual(['Scene dock', 'Inspector', 'FileSystem dock']);
  });

  it('has prompts and answers, never the answer in its prompt, and three wrong answers from the other parts', () => {
    const answers = new Set(cards.map((c) => c.answer));
    for (const c of cards) {
      expect(c.prompt.trim(), c.id).not.toBe('');
      expect(c.answer.trim(), c.id).not.toBe('');
      expect(c.prompt.toLowerCase(), c.id).not.toContain(c.answer.toLowerCase());
      expect(c.distractors, c.id).not.toContain(c.answer);
      for (const d of c.distractors) expect(answers.has(d), `${c.id}: ${d}`).toBe(true);
      expect(c.distractorPool!.length, c.id).toBeGreaterThanOrEqual(6);
      expect(c.distractorPool, c.id).not.toContain(c.answer);
    }
  });

  it('quotes only the page: every “…” in a prompt is the page’s own words', () => {
    // The page wraps its lines; compare on single spaces, with the bold marks taken out.
    if (rst === null) return;
    const page = rst.replace(/\*\*/g, '').replace(/\s+/g, ' ');
    for (const c of cards) {
      for (const [, quote] of c.prompt.matchAll(/“([^”]+)”/g)) expect(page, `${c.id}: ${quote}`).toContain(quote!.replace(/’/g, "'"));
    }
  });

  it('keeps explanations to one sentence', () => {
    for (const c of cards) expect(c.explain.split(/[.!?](?:\s|$)/).filter((s) => s.trim()).length, c.id).toBe(1);
  });
});
