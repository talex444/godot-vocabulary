/**
 * A small GDScript tokenizer for the snippet cards: enough to colour a few lines the way the
 * script editor does. It works line by line (no multi-line strings) and guesses engine types from
 * their PascalCase spelling, since snippets never declare their own classes.
 */
export type TokenKind =
  | 'text' | 'keyword' | 'control' | 'annotation' | 'string' | 'number' | 'comment' | 'doc-comment'
  | 'function' | 'function-def' | 'global-function' | 'base-type' | 'engine-type' | 'member'
  | 'symbol' | 'node-path' | 'blank';

export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set([
  'extends', 'class_name', 'class', 'func', 'var', 'const', 'signal', 'enum', 'static', 'is', 'as', 'in',
  'and', 'or', 'not', 'self', 'super', 'preload', 'true', 'false', 'null', 'PI', 'TAU', 'INF', 'NAN',
  'breakpoint', 'set', 'get',
]);

const CONTROL = new Set(['if', 'elif', 'else', 'for', 'while', 'match', 'when', 'break', 'continue', 'pass', 'return', 'await', 'yield']);

const BASE_TYPES = new Set([
  'void', 'bool', 'int', 'float', 'String', 'StringName', 'NodePath', 'Vector2', 'Vector2i', 'Vector3', 'Vector3i',
  'Vector4', 'Vector4i', 'Color', 'Rect2', 'Rect2i', 'Transform2D', 'Transform3D', 'Basis', 'Quaternion', 'AABB',
  'Plane', 'Projection', 'RID', 'Array', 'Dictionary', 'Callable', 'Signal', 'Variant', 'PackedByteArray',
  'PackedInt32Array', 'PackedInt64Array', 'PackedFloat32Array', 'PackedFloat64Array', 'PackedStringArray',
  'PackedVector2Array', 'PackedVector3Array', 'PackedColorArray',
]);

/** @GlobalScope and @GDScript functions the editor colours as global functions. */
const GLOBAL_FUNCTIONS = new Set([
  'print', 'prints', 'printt', 'print_debug', 'push_error', 'push_warning', 'range', 'len', 'load', 'str',
  'abs', 'clamp', 'clampf', 'clampi', 'lerp', 'lerpf', 'min', 'max', 'randi', 'randf', 'randi_range',
  'randf_range', 'randomize', 'sign', 'sqrt', 'pow', 'floor', 'ceil', 'round', 'sin', 'cos', 'deg_to_rad',
  'rad_to_deg', 'is_instance_valid', 'typeof', 'type_string', 'move_toward', 'wrapf', 'wrapi', 'snapped',
  'char', 'ord', 'instance_from_id', 'weakref', 'is_equal_approx', 'is_zero_approx', 'fmod', 'posmod',
]);

const RULES: [TokenKind | 'word' | 'space', RegExp][] = [
  ['space', /\s+/y],
  ['doc-comment', /##.*/y],
  ['comment', /#.*/y],
  ['blank', /_{4,}/y],
  ['string', /[&^]?(?:"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)/y],
  ['annotation', /@[A-Za-z_]\w*/y],
  ['node-path', /[$%](?:"[^"]*"|[A-Za-z_][\w/]*)/y],
  ['number', /(?:0x[0-9a-fA-F_]+|0b[01_]+|\d[\d_]*(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+)/y],
  ['word', /[A-Za-z_]\w*/y],
  ['symbol', /->|:=|[+\-*/%=<>!&|^~]=?|[^\s\w]/y],
];

function classifyWord(word: string, previous: Token | undefined, rest: string): TokenKind {
  if (previous?.text === 'func') return 'function-def';
  if (KEYWORDS.has(word)) return 'keyword';
  if (CONTROL.has(word)) return 'control';
  if (BASE_TYPES.has(word)) return 'base-type';
  if (/^[A-Z]/.test(word) && /[a-z]/.test(word)) return 'engine-type';
  const afterDot = previous?.text === '.';
  if (/^\s*\(/.test(rest)) return !afterDot && GLOBAL_FUNCTIONS.has(word) ? 'global-function' : 'function';
  if (afterDot) return 'member';
  return 'text';
}

/** Tokens of one line, in order; concatenating their text gives the line back. */
export function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let previous: Token | undefined;
  let i = 0;
  while (i < line.length) {
    let matched = false;
    for (const [kind, pattern] of RULES) {
      pattern.lastIndex = i;
      const m = pattern.exec(line);
      if (!m || m[0].length === 0) continue;
      const text = m[0];
      const token: Token = {
        kind: kind === 'space' ? 'text' : kind === 'word' ? classifyWord(text, previous, line.slice(i + text.length)) : kind,
        text,
      };
      tokens.push(token);
      if (kind !== 'space') previous = token;
      i += text.length;
      matched = true;
      break;
    }
    if (!matched) {
      tokens.push({ kind: 'text', text: line[i]! });
      i++;
    }
  }
  return tokens;
}

export function tokenize(code: string): Token[][] {
  return code.split('\n').map(tokenizeLine);
}
