import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAW_TAG_PATTERN } from '../../scripts/lib/bbcode.mjs';
import type { Card } from '../../src/cards/types';
import api from '../../src/data/cards.godot-api.json';
import gdscript from '../../src/data/cards.gdscript.json';
import github from '../../src/data/cards.github.json';

const ROOT = join(__dirname, '../..');
const deck = [...(api as Card[]), ...(github as Card[]), ...(gdscript as Card[])];
const byId = new Map(deck.map((c) => [c.id, c]));

describe('generated deck', () => {
  it('has cards in the API and GitHub families', () => {
    expect(api.length).toBeGreaterThan(300);
    expect(github.length).toBeGreaterThan(50);
  });

  it('has unique ids and numeric ranks', () => {
    expect(byId.size).toBe(deck.length);
    for (const c of deck) expect(Number.isFinite(c.rank), c.id).toBe(true);
  });

  it('gives every card four distinct choices with the answer among them once', () => {
    for (const c of deck) {
      expect(c.distractors, c.id).toHaveLength(3);
      expect(new Set([c.answer, ...c.distractors]).size, c.id).toBe(4);
      expect(c.distractors, c.id).not.toContain(c.answer);
      for (const choice of [c.answer, ...c.distractors]) expect(choice.trim(), c.id).not.toBe('');
    }
  });

  it('has non-empty prompts and explanations with no raw BBCode or Liquid', () => {
    for (const c of deck) {
      expect(c.prompt.trim(), c.id).not.toBe('');
      expect(c.explain.trim(), c.id).not.toBe('');
      for (const text of [c.prompt, c.explain]) {
        expect(RAW_TAG_PATTERN.test(text), `${c.id}: ${text}`).toBe(false);
        expect(text, c.id).not.toContain('{%');
      }
    }
  });

  it('points every requires at an existing card that ranks earlier', () => {
    for (const c of deck.filter((c) => c.requires)) {
      const parent = byId.get(c.requires!);
      expect(parent, c.id).toBeDefined();
      expect(parent!.rank, c.id).toBeLessThan(c.rank);
    }
  });

  it('ships every referenced icon', () => {
    for (const c of deck.filter((c) => c.icon)) expect(existsSync(join(ROOT, 'public', c.icon!)), c.icon).toBe(true);
  });
});

describe('API family', () => {
  const classes = (api as Card[]).filter((c) => c.kind === 'class').sort((a, b) => a.rank - b.rank);
  const frequency = JSON.parse(readFileSync(join(ROOT, 'data/class-frequency.json'), 'utf8')) as {
    classes: { name: string; projects: number }[];
  };

  it('has a class card for every used class that has a brief description', () => {
    const names = new Set(classes.map((c) => c.answer));
    const missing = frequency.classes
      .filter((r) => r.projects > 0 && !r.name.startsWith('@'))
      .filter((r) => !names.has(r.name))
      .filter((r) => {
        const xml = join(ROOT, 'data/sources/godot-4.7/classes', `${r.name}.xml`);
        if (!existsSync(xml)) return false; // sources absent on a fresh clone: nothing to compare
        return /<brief_description>\s*\S/.test(readFileSync(xml, 'utf8'));
      });
    expect(missing.map((r) => r.name)).toEqual([]);
  });

  it('gives member cards to the top 40 classes, skipping only builtins with nothing to ask', () => {
    const withMembers = new Set((api as Card[]).filter((c) => c.requires).map((c) => c.requires));
    const covered = classes.filter((c) => withMembers.has(c.id));
    expect(covered.length).toBeGreaterThanOrEqual(40);
    const last = covered[39]!.rank;
    const skipped = classes.filter((c) => c.rank <= last && !withMembers.has(c.id)).map((c) => c.answer);
    // float, int and bool have no methods, properties or signals in the class reference; the two box
    // containers and StandardMaterial3D only inherit theirs (from BoxContainer and BaseMaterial3D).
    expect(skipped).toEqual(['float', 'int', 'bool', 'VBoxContainer', 'HBoxContainer', 'StandardMaterial3D']);
  });

  it('ranks the first-2D-game tutorial classes before every other class', () => {
    const rank = (name: string) => classes.find((c) => c.answer === name)?.rank ?? NaN;
    // Classes the tutorial names (Dodge the Creeps) and the most-used classes it never mentions.
    const tutorial = ['Area2D', 'CharacterBody2D', 'AnimatedSprite2D', 'CollisionShape2D', 'RigidBody2D',
      'VisibleOnScreenNotifier2D', 'Timer', 'Marker2D', 'Path2D', 'PathFollow2D', 'CanvasLayer', 'Label', 'Button'];
    const notInTutorial = ['Script', 'Vector2', 'Texture2D', 'PackedScene', 'NodePath', 'Node3D'];
    const lastTutorial = Math.max(...tutorial.map(rank));
    for (const name of notInTutorial) expect(rank(name), name).toBeGreaterThan(lastTutorial);
    expect(classes[0]!.answer).toBe('Area2D');
  });
});
