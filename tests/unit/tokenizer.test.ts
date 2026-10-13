import { describe, expect, it } from 'vitest';
import cards from '../../src/data/cards.gdscript.json';
import { tokenize, tokenizeLine, type TokenKind } from '../../src/ui/kit/gdscript';

const kinds = (line: string) => tokenizeLine(line).filter((t) => t.text.trim()).map((t) => [t.text, t.kind] as [string, TokenKind]);

describe('GDScript tokenizer (done-criteria 5)', () => {
  it('colours a function definition, types and the return arrow', () => {
    expect(kinds('func _physics_process(delta: float) -> void:')).toEqual([
      ['func', 'keyword'],
      ['_physics_process', 'function-def'],
      ['(', 'symbol'],
      ['delta', 'text'],
      [':', 'symbol'],
      ['float', 'base-type'],
      [')', 'symbol'],
      ['->', 'symbol'],
      ['void', 'base-type'],
      [':', 'symbol'],
    ]);
  });

  it('tells control flow, calls, members, engine types, strings and numbers apart', () => {
    expect(kinds('\tif Input.is_action_pressed("ui_accept"): velocity.y = 4.5')).toEqual([
      ['if', 'control'],
      ['Input', 'engine-type'],
      ['.', 'symbol'],
      ['is_action_pressed', 'function'],
      ['(', 'symbol'],
      ['"ui_accept"', 'string'],
      [')', 'symbol'],
      [':', 'symbol'],
      ['velocity', 'text'],
      ['.', 'symbol'],
      ['y', 'member'],
      ['=', 'symbol'],
      ['4.5', 'number'],
    ]);
  });

  it('handles annotations, node paths, global functions, comments and the blank', () => {
    expect(kinds('@onready var sprite = $Sprite2D # the sprite')).toEqual([
      ['@onready', 'annotation'],
      ['var', 'keyword'],
      ['sprite', 'text'],
      ['=', 'symbol'],
      ['$Sprite2D', 'node-path'],
      ['# the sprite', 'comment'],
    ]);
    expect(kinds('print(clamp(x, 0, 1)) ## doc')).toContainEqual(['print', 'global-function']);
    expect(kinds('print(clamp(x, 0, 1)) ## doc')).toContainEqual(['## doc', 'doc-comment']);
    expect(kinds('func ____(delta):')[1]).toEqual(['____', 'blank']);
    expect(kinds('x.____()')[2]).toEqual(['____', 'blank']);
  });

  it('gives every snippet card its text back, with exactly one blank', () => {
    for (const card of cards as { id: string; code?: string }[]) {
      if (!card.code) continue;
      const lines = tokenize(card.code);
      expect(lines.map((tokens) => tokens.map((t) => t.text).join('')).join('\n'), card.id).toBe(card.code);
      expect(lines.flat().filter((t) => t.kind === 'blank'), card.id).toHaveLength(1);
    }
  });
});
