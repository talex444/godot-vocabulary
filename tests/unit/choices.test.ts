import { describe, expect, it } from 'vitest';
import type { Card } from '../../src/cards/types';
import api from '../../src/data/cards.godot-api.json';
import gdscript from '../../src/data/cards.gdscript.json';
import github from '../../src/data/cards.github.json';
import { seededRng } from '../../src/session/build';
import { canFlip, drawChoices } from '../../src/session/choices';

const deck = [...(api as Card[]), ...(gdscript as Card[]), ...(github as Card[])];
const byId = new Map(deck.map((c) => [c.id, c]));

describe('drawChoices (done-criteria 34, 35)', () => {
  it('never repeats a set of four for one card in a session, over 1,000 draws', () => {
    const rng = seededRng(11);
    let draws = 0;
    for (let s = 0; draws < 1000; s++) {
      const card = deck[Math.floor(rng() * deck.length)]!;
      const previous: string[] = [];
      // Sets of three wrong answers a pool of n allows: n choose 3 (4 for the smallest pools).
      const n = card.distractorPool!.length;
      const sets = (n * (n - 1) * (n - 2)) / 6;
      let forward = 0;
      // A card shown up to five times (three showings, plus wrong-until-right repeats).
      for (let showing = 0; showing < 5; showing++, draws++) {
        const draw = drawChoices(card, showing, rng, previous, byId);
        if (draw.direction === 'forward' && ++forward > sets) continue; // every set used: a repeat is unavoidable
        expect(draw.choices, card.id).toHaveLength(4);
        expect(new Set(draw.choices.map((c) => c.text)).size, card.id).toBe(4);
        expect(draw.choices.filter((c) => c.correct), card.id).toHaveLength(1);
        const right = draw.choices.find((c) => c.correct)!;
        expect(right.text, card.id).toBe(draw.direction === 'flipped' ? card.prompt : card.answer);
        if (draw.direction === 'forward') {
          const pool = card.distractorPool!;
          for (const c of draw.choices.filter((x) => !x.correct)) expect(pool, card.id).toContain(c.text);
        }
        expect(previous, `${card.id} showing ${showing}`).not.toContain(draw.key);
        previous.push(draw.key);
      }
    }
  });

  it('draws fresh wrong answers each showing while the pool lasts', () => {
    const card = byId.get('api:class:Timer')!;
    const previous: string[] = [];
    const wrong = new Set<string>();
    for (const showing of [0, 3]) {
      const draw = drawChoices(card, showing, seededRng(showing), previous, byId);
      for (const c of draw.choices.filter((x) => !x.correct)) {
        expect(wrong.has(c.text), c.text).toBe(false);
        wrong.add(c.text);
      }
      previous.push(draw.key);
    }
  });

  it('flips description cards on showings 2 and 3 only, and never snippet cards', () => {
    const rng = seededRng(5);
    const timer = byId.get('api:class:Timer')!;
    expect(drawChoices(timer, 0, rng, [], byId).direction).toBe('forward');
    expect(drawChoices(timer, 1, rng, [], byId).direction).toBe('flipped');
    expect(drawChoices(timer, 2, rng, [], byId).direction).toBe('flipped');
    expect(drawChoices(timer, 3, rng, [], byId).direction).toBe('forward');
    const flipped = drawChoices(timer, 1, rng, [], byId);
    for (const c of flipped.choices) expect(byId.get(c.cardId!)!.prompt).toBe(c.text);

    const snippets = (gdscript as Card[]).filter((c) => c.code);
    expect(snippets.length).toBeGreaterThan(50);
    for (const c of snippets) {
      expect(canFlip(c), c.id).toBe(false);
      expect(drawChoices(c, 1, rng, [], byId).direction, c.id).toBe('forward');
    }
    for (const kind of ['class', 'method', 'property', 'signal', 'term']) {
      expect(deck.some((c) => c.kind === kind && drawChoices(c, 1, rng, [], byId).direction === 'flipped'), kind).toBe(true);
    }
    expect((gdscript as Card[]).some((c) => !c.code && drawChoices(c, 2, rng, [], byId).direction === 'flipped')).toBe(true);
  });

  it('falls back to forward when fewer than three pool entries have cards of their own', () => {
    const card: Card = {
      ...byId.get('api:class:Timer')!,
      distractorIds: ['api:class:Gone1', 'api:class:Gone2', 'api:class:Node3D', 'api:class:Gone3', 'x', 'y', 'z', 'w'],
    };
    expect(drawChoices(card, 1, seededRng(1), [], byId).direction).toBe('forward');
    // Custom cards (no pool, kind custom) always draw forward from their three wrong answers.
    const custom: Card = { ...card, kind: 'custom', distractorPool: undefined, distractorIds: undefined };
    const draw = drawChoices(custom, 1, seededRng(1), [], byId);
    expect(draw.direction).toBe('forward');
    expect(draw.choices.map((c) => c.text).sort()).toEqual([custom.answer, ...custom.distractors].sort());
  });
});
