// `pnpm lint:lessons` (also the first step of `pnpm build`): the term check of decision 34.
//
// A lesson may show an identifier in code font (`inline code`, a code block, a minimal-fix line, a
// blank's answer, a drawing's node type) only when it is a card the learner has met: one of this
// lesson's `cardIds` or of an earlier lesson's in the same course. Plain words are never checked.
//
// Identifier → card: a class name → `api:class:<Name>`; `Class.member` → that member card; a bare
// `member` or `member()` → any member card of that name or the `gd:*` card whose answer it is
// (keywords, annotations, lifecycle names, built-ins). A capitalised name with no card at all fails
// too; a lower-case name with no card (a local variable, say) is not vocabulary and passes.
// String literals and `#` comments inside code are skipped. Images must exist in public/courses/img.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain, ROOT } from './lib/io.mjs';

const IDENT = /@?[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/g;

/** token → card ids that teach it, built from the decks. */
export function buildIndex(cards) {
  const index = new Map();
  const add = (token, id) => index.set(token, [...(index.get(token) ?? []), id]);
  for (const card of cards) {
    if (card.family === 'godot-api') {
      const m = /^api:(class|method|prop|signal|const|enum):(.+)$/.exec(card.id);
      if (!m) continue;
      if (m[1] === 'class') add(m[2], card.id);
      else {
        add(m[2], card.id);
        add(m[2].split('.').pop(), card.id);
      }
    } else if (card.family === 'gdscript') {
      const word = card.answer.replace(/\(\)$/, '');
      if (/^@?[A-Za-z_][A-Za-z0-9_]*$/.test(word)) add(word, card.id);
    }
  }
  return index;
}

/** Identifiers written in code font in a line of lesson text. */
function inlineTokens(text) {
  return [...text.matchAll(/`([^`]+)`/g)].flatMap((m) => codeTokens(m[1]));
}

/** Identifiers in a piece of code, without string literals and comments. */
function codeTokens(code) {
  const bare = code
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, ' ')
    .replace(/#.*$/gm, ' ')
    .replace(/_{4,}/g, ' ');
  return [...bare.matchAll(IDENT)].map((m) => m[0]);
}

/** Every code-font identifier in a lesson, with where it was found. */
function lessonTokens(lesson) {
  const out = [];
  const visit = (value, where, mode = 'text') => {
    if (typeof value === 'string') {
      const tokens = mode === 'code' ? codeTokens(value) : mode === 'word' ? [value] : inlineTokens(value);
      for (const token of tokens) out.push({ token, where });
    } else if (Array.isArray(value)) value.forEach((v, i) => visit(v, `${where}[${i}]`, mode));
    else if (value && typeof value === 'object') {
      for (const [key, v] of Object.entries(value)) {
        if (['id', 'src', 'url', 'cardIds', 'alt', 'page'].includes(key)) continue;
        const plainFix = value.type === 'fix' && value.plain;
        const childMode =
          key === 'code' || (key === 'lines' && value.type === 'fix' && !plainFix)
            ? 'code'
            : (key === 'type' && 'depth' in value) || (key === 'answer' && value.type === 'blank')
              ? 'word'
              : key === 'type'
                ? 'skip'
                : 'text';
        if (childMode !== 'skip') visit(v, where ? `${where}.${key}` : key, childMode);
      }
    }
  };
  visit(lesson, '');
  return out;
}

/** Ids a token needs (any one of them), or `null` when the token is not vocabulary. */
function needs(token, index) {
  const word = token.replace(/\(\)$/, '');
  const parts = word.split('.');
  if (parts.length > 1 && /^[A-Z]/.test(parts[0])) {
    const member = index.get(`${parts[0]}.${parts[1]}`);
    if (member) return [{ token: `${parts[0]}.${parts[1]}`, ids: member }];
  }
  return parts.map((part, i) => {
    const ids = index.get(part) ?? [];
    if (ids.length > 0) return { token: part, ids };
    // A capitalised name with no card at all (not an ALL_CAPS constant) is a class the deck lacks.
    if (/^[A-Z][a-z0-9]/.test(part) && i === 0) return { token: part, ids: [] };
    return null;
  }).filter(Boolean);
}

/** Failure messages for one course; empty when every lesson passes. */
export function checkCourse(course, cards, options = {}) {
  const index = buildIndex(cards);
  const known = new Set(cards.map((c) => c.id));
  const imageExists = options.imageExists ?? (() => true);
  const errors = [];
  const met = new Set();
  for (const lesson of [...course.lessons].sort((a, b) => a.order - b.order)) {
    if (lesson.planned) continue;
    const name = `${course.id} lesson ${lesson.id} (“${lesson.title}”)`;
    for (const id of lesson.cardIds ?? []) {
      if (!known.has(id)) errors.push(`${name}: cardId ${id} is not a card in the decks`);
      met.add(id);
    }
    const seen = new Set();
    for (const { token, where } of lessonTokens(lesson)) {
      for (const need of needs(token, index)) {
        const key = need.token;
        if (seen.has(key) || need.ids.some((id) => met.has(id))) continue;
        seen.add(key);
        errors.push(
          need.ids.length === 0
            ? `${name}: \`${key}\` in code font (${where}) is not a card in the decks`
            : `${name}: \`${key}\` in code font (${where}) is not a card the learner has met; add ${need.ids.slice(0, 3).join(' or ')} to this lesson's or an earlier lesson's cardIds`,
        );
      }
    }
    const images = [];
    const collect = (v) => {
      if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === 'object') {
        if (typeof v.src === 'string' && typeof v.alt === 'string') images.push(v.src);
        Object.values(v).forEach(collect);
      }
    };
    collect(lesson);
    for (const src of images) if (!imageExists(src)) errors.push(`${name}: image ${src} is missing from public/courses/img`);
  }
  return errors;
}

export function loadDecks() {
  return ['godot-api', 'gdscript', 'github'].flatMap((f) => JSON.parse(readFileSync(join(ROOT, `src/data/cards.${f}.json`), 'utf8')));
}

export function loadCourses() {
  const dir = join(ROOT, 'src/data/courses');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

if (isMain(import.meta.url)) {
  const cards = loadDecks();
  const imageExists = (src) => existsSync(join(ROOT, 'public/courses/img', src));
  const errors = loadCourses().flatMap((course) => checkCourse(course, cards, { imageExists }));
  if (errors.length > 0) {
    console.error(`Lesson term check failed:\n${errors.join('\n')}`);
    process.exit(1);
  }
  console.log('lint:lessons: every code-font term is a card the learner has met');
}
