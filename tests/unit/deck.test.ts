import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIN_POOL } from '../../scripts/generate-api-cards.mjs';
import { RAW_TAG_PATTERN } from '../../scripts/lib/bbcode.mjs';
import type { Card } from '../../src/cards/types';
import api from '../../src/data/cards.godot-api.json';
import editor from '../../src/data/cards.godot-editor.json';
import gdscript from '../../src/data/cards.gdscript.json';
import github from '../../src/data/cards.github.json';

const ROOT = join(__dirname, '../..');
const deck = [...(editor as Card[]), ...(api as Card[]), ...(github as Card[]), ...(gdscript as Card[])];
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

describe('distractor pools, full descriptions, links and topics (done-criteria 34, 36, 39)', () => {
  it('gives every card a pool of at least four, six or more for at least 90%', () => {
    const sizes = new Map<number, number>();
    for (const c of deck) {
      const pool = c.distractorPool!;
      sizes.set(pool.length, (sizes.get(pool.length) ?? 0) + 1);
      expect(pool.length, c.id).toBeGreaterThanOrEqual(4);
      expect(pool, c.id).not.toContain(c.answer);
      expect(new Set(pool).size, c.id).toBe(pool.length);
      expect(c.distractors, c.id).toEqual(pool.slice(0, 3));
      expect(c.distractorIds, c.id).toHaveLength(pool.length);
    }
    console.log('pool sizes (size: cards)', Object.fromEntries([...sizes].sort((a, b) => a[0] - b[0])));
    expect(deck.filter((c) => c.distractorPool!.length >= 6).length / deck.length).toBeGreaterThanOrEqual(0.9);
  });

  it('points pool ids at cards whose answer is that pool entry, where the card exists', () => {
    for (const c of deck) {
      c.distractorIds!.forEach((id, i) => {
        const other = byId.get(id);
        if (other) expect(other.answer, `${c.id} → ${id}`).toBe(c.distractorPool![i]);
      });
    }
    const flippable = deck.filter((c) => c.kind === 'class' && c.distractorIds!.filter((id) => byId.has(id)).length >= 3);
    expect(flippable.length).toBeGreaterThan(300);
  });

  it('has a full description of at most 1,200 characters, ending in "…" when cut, with no raw BBCode', () => {
    for (const c of deck) {
      const full = c.explainFull!;
      expect(full.trim(), c.id).not.toBe('');
      expect(full.length, c.id).toBeLessThanOrEqual(1200);
      expect(RAW_TAG_PATTERN.test(full), c.id).toBe(false);
      expect((full.match(/```/g) ?? []).length % 2, c.id).toBe(0);
    }
    expect((api as Card[]).some((c) => c.explainFull!.endsWith('…'))).toBe(true);
  });

  it('links every card to its official docs page in the verified URL shapes', () => {
    const godot = 'https://docs.godotengine.org/en/4.7/';
    for (const c of deck) expect(c.docsUrl, c.id).toMatch(/^https:\/\/docs\.(godotengine\.org\/en\/4\.7|github\.com\/en)\/\S+$/);
    expect(byId.get('api:class:Timer')!.docsUrl).toBe(`${godot}classes/class_timer.html`);
    expect(byId.get('api:prop:Timer.one_shot')!.docsUrl).toBe(`${godot}classes/class_timer.html#class-timer-property-one-shot`);
    expect(byId.get('api:signal:Timer.timeout')!.docsUrl).toBe(`${godot}classes/class_timer.html#class-timer-signal-timeout`);
    expect(byId.get('api:method:Timer.start')!.docsUrl).toBe(`${godot}classes/class_timer.html#class-timer-method-start`);
    expect(byId.get('gd:keyword:if')!.docsUrl).toBe(`${godot}tutorials/scripting/gdscript/gdscript_basics.html#if-else-elif`);
    expect(byId.get('editor:dock:scene')!.docsUrl).toBe(`${godot}getting_started/introduction/first_look_at_the_editor.html#first-look-at-godot-s-editor`);
    expect(byId.get('editor:screen:game')!.docsUrl).toBe(`${godot}getting_started/introduction/first_look_at_the_editor.html#the-five-main-screens`);
    expect(byId.get('gh:term:pull-request')!.docsUrl).toBe(
      'https://docs.github.com/en/get-started/learning-about-github/github-glossary#pull-request',
    );
  });

  it('gives every card a topic', () => {
    for (const c of deck) expect(c.topic?.trim(), c.id).toBeTruthy();
    expect(new Set((github as Card[]).map((c) => c.topic))).toEqual(new Set(['Git basics', 'Branches and pull requests', 'GitHub features']));
    expect(new Set((editor as Card[]).map((c) => c.topic))).toEqual(new Set(['First look at the editor']));
    // The first staged page that mentions the class: step by step comes before the first 2D game.
    expect(byId.get('api:class:Area2D')!.topic).toBe('Signals');
    expect(byId.get('api:class:AnimatedSprite2D')!.topic).toBe('Your first 2D game');
    for (const c of (api as Card[]).filter((c) => c.requires)) expect(c.topic, c.id).toBe(byId.get(c.requires!)!.topic);
  });
});

describe('generator rules (done-criteria 38)', () => {
  const removed = JSON.parse(readFileSync(join(ROOT, 'data/removed-cards.json'), 'utf8')) as Record<string, string[]>;
  const classes = (api as Card[]).filter((c) => c.kind === 'class');
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const words = (s: string) => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w.replace(/_{4}/g, ''))).length;

  it('reports what each rule removed', () => {
    console.log('removed per rule', Object.fromEntries(Object.entries(removed).map(([k, v]) => [k, v.length])));
    for (const ids of Object.values(removed)) for (const id of ids) expect(byId.has(id), id).toBe(false);
  });

  it('(a) keeps no two class cards with the same prompt', () => {
    const seen = new Map<string, string>();
    for (const c of classes) {
      const key = normalise(c.prompt);
      expect(seen.get(key), `${c.id} repeats ${seen.get(key)}`).toBeUndefined();
      seen.set(key, c.id);
    }
    // Keep one of each pair: the twin that is not deprecated, else the more frequent one (CoS ruling, GV-4b).
    const pairs = [
      ['TileMapLayer', 'TileMap'],
      ['CheckButton', 'CheckBox'],
      ['NavigationMeshSourceGeometryData2D', 'NavigationMeshSourceGeometryData3D'],
    ];
    for (const [kept, dropped] of pairs) {
      expect(removed.duplicateBrief).toContain(`api:class:${dropped}`);
      expect(removed.duplicateBrief).not.toContain(`api:class:${kept}`);
      const card = byId.get(`api:class:${kept}`);
      expect(card, kept).toBeDefined();
      expect(card!.distractorPool, kept).not.toContain(dropped);
    }
    expect(removed.duplicateBrief).toHaveLength(4);
  });

  it('(b) has no editor-only class', () => {
    for (const c of classes) {
      const xml = join(ROOT, 'data/sources/godot-4.7/classes', `${c.answer}.xml`);
      if (existsSync(xml)) expect(readFileSync(xml, 'utf8'), c.id).not.toMatch(/<class [^>]*api_type="editor"/);
    }
    expect(removed.editor).toContain('api:class:EditorPlugin');
  });

  it('(c) leaves no API prompt with a blank or two words or fewer', () => {
    for (const c of api as Card[]) {
      expect(c.prompt, c.id).not.toContain('____');
      expect(words(c.prompt.replace(/^\w+: /, '')), c.id).toBeGreaterThan(2);
    }
  });

  it('gives every class card a pool with the icon parity of its answer (done-criteria 46)', () => {
    const icon = (name: string) => existsSync(join(ROOT, 'public/icons', `${name}.svg`));
    for (const c of classes) {
      expect(icon(c.answer), c.id).toBe(Boolean(c.icon));
      const odd = c.distractorPool!.filter((n) => icon(n) !== icon(c.answer));
      expect(odd, `${c.id} (${c.icon ? 'icon' : 'no icon'})`).toEqual([]);
    }
  });

  it('keeps no class card with a pool under MIN_POOL; parity shortfalls go to the removed list', () => {
    for (const c of classes) expect(c.distractorPool!.length, c.id).toBeGreaterThanOrEqual(MIN_POOL);
    for (const id of removed.smallPool ?? []) expect(byId.has(id), id).toBe(false);
  });

  it('(d) has no member card whose description is four words or fewer', () => {
    for (const c of (api as Card[]).filter((c) => c.requires)) {
      expect(words(c.explain.split('\n').slice(1).join(' ')), c.id).toBeGreaterThan(4);
    }
  });
});

describe('API family', () => {
  const classes = (api as Card[]).filter((c) => c.kind === 'class').sort((a, b) => a.rank - b.rank);
  const frequency = JSON.parse(readFileSync(join(ROOT, 'data/class-frequency.json'), 'utf8')) as {
    classes: { name: string; projects: number }[];
  };

  it('has a class card for every used class that has a brief description, unless a generator rule removed it', () => {
    const removed = Object.values(JSON.parse(readFileSync(join(ROOT, 'data/removed-cards.json'), 'utf8')) as Record<string, string[]>).flat();
    const names = new Set([...classes.map((c) => c.answer), ...removed.map((id) => id.replace(/^api:class:/, ''))]);
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
