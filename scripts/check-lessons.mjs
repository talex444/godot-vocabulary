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
//
// A term lesson (decision 71) is checked for its shape too: every cardId has exactly one term, every
// term has its six parts, its "what it is" quotes the manual, and the recall checks (one after every
// fourth term and one after the last) each ask for a term whose section is above them.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain, ROOT } from './lib/io.mjs';

const IDENT = /@?[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/g;

const MEMBER_KINDS = new Set(['method', 'property', 'signal']);

/** A card's displayed name; mirrors `termName` in src/courses/index.ts (a unit test keeps them equal). */
export function termName(card) {
  const owner = card.requires?.replace(/^api:class:/, '');
  return owner && MEMBER_KINDS.has(card.kind) ? `${owner}.${card.answer}` : card.answer;
}

/** How many terms stand above each recall check; mirrors `recallAfter` in src/courses/types.ts. */
export function recallAfter(termCount) {
  return Array.from({ length: Math.ceil(termCount / 4) }, (_, i) => Math.min(4 * (i + 1), termCount));
}

/** Every picture a lesson (or a course) names, wherever it sits: a chunk, an example, a term's where or example. */
export function lessonImages(value) {
  const images = [];
  const collect = (v) => {
    if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') {
      if (typeof v.src === 'string' && typeof v.alt === 'string') images.push(v.src);
      Object.values(v).forEach(collect);
    }
  };
  collect(value);
  return images;
}

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

/**
 * Every code-font identifier in a lesson, with where it was found. Text fields are read for `inline
 * code`; `code` and a fix's lines as code; a drawing node's type, a blank's answer, a recall check's
 * answer (`check.answer`, `recall[].answer`) and a contrast's `other` are each one name ("word").
 */
function lessonTokens(lesson) {
  const out = [];
  const visit = (value, where, mode = 'text') => {
    if (typeof value === 'string') {
      const tokens = mode === 'code' ? codeTokens(value) : mode === 'word' ? [value] : inlineTokens(value);
      for (const token of tokens) out.push({ token, where, mode });
    } else if (Array.isArray(value)) value.forEach((v, i) => visit(v, `${where}[${i}]`, mode));
    else if (value && typeof value === 'object') {
      for (const [key, v] of Object.entries(value)) {
        if (['id', 'src', 'url', 'cardIds', 'cardId', 'alt', 'page'].includes(key)) continue;
        const plainFix = value.type === 'fix' && value.plain;
        const childMode =
          key === 'code' || (key === 'lines' && value.type === 'fix' && !plainFix)
            ? 'code'
            : (key === 'type' && 'depth' in value) || (key === 'answer' && typeof v === 'string') || key === 'other'
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

/**
 * Ids a one-name field needs: a card whose displayed name it is (a dock, a member, a class), else the
 * identifier rule of `needs`. A phrase with a space that names no card is plain words.
 */
function wordNeeds(word, index, names) {
  const ids = names.get(word);
  if (ids) return [{ token: word, ids }];
  return /\s/.test(word) ? [] : needs(word, index);
}

const PARTS = [
  ['(1) What it is', (t) => t.what?.text],
  ['(2) When you’d reach for it', (t) => t.when],
  ['(3) Where it lives', (t) => t.where?.text],
  ['(4) Example', (t) => t.example?.text],
  ['(5) Not to be confused with', (t) => t.contrast?.other && t.contrast?.text],
  ['(6) Check', (t) => t.check?.prompt && t.check?.answer && t.check?.why],
];

/** The shape of a term lesson (decision 71): one term per card, six parts each, a quotation, the recall checks. */
function termFailures(lesson, name, byId) {
  const errors = [];
  const terms = Array.isArray(lesson.terms) ? lesson.terms : [];
  const cardIds = lesson.cardIds ?? [];
  const label = (t, i) => `term ${i + 1} of ${terms.length} (${t?.cardId ?? 'no cardId'})`;
  const first = new Map();
  terms.forEach((t, i) => {
    if (!cardIds.includes(t?.cardId)) errors.push(`${name}: ${label(t, i)} teaches a card that is not in the lesson's cardIds`);
    if (first.has(t?.cardId)) errors.push(`${name}: ${label(t, i)} teaches the same card as term ${first.get(t.cardId) + 1}; each card has one term`);
    else first.set(t?.cardId, i);
    for (const [part, read] of PARTS) {
      const value = read(t ?? {});
      if (typeof value !== 'string' || !value.trim()) errors.push(`${name}: ${label(t, i)} skips part ${part}`);
    }
    if (typeof t?.what?.text === 'string' && t.what.text.trim() && !/“[^”]+”/.test(t.what.text)) {
      errors.push(`${name}: ${label(t, i)} part (1) What it is has no “…” quotation from the manual`);
    }
  });
  for (const id of cardIds) if (!first.has(id)) errors.push(`${name}: cardId ${id} has no term; a term lesson gives every card its six parts`);
  const after = recallAfter(terms.length);
  const recall = Array.isArray(lesson.recall) ? lesson.recall : [];
  if (recall.length !== after.length) {
    errors.push(`${name}: ${recall.length} recall check${recall.length === 1 ? '' : 's'} for ${terms.length} terms; it needs ${after.length}, after term${after.length === 1 ? '' : 's'} ${after.join(', ')}`);
  }
  const nameOfTerm = (t) => (byId.has(t?.cardId) ? termName(byId.get(t.cardId)) : t?.check?.answer);
  recall.forEach((r, i) => {
    const above = terms.slice(0, after[i] ?? terms.length).map(nameOfTerm);
    if (!above.includes(r?.answer)) {
      errors.push(`${name}: recall ${i + 1} (after term ${after[i] ?? terms.length}) asks for “${r?.answer}”, which is not a term above it (${above.join(', ')})`);
    }
  });
  return errors;
}

/** Failure messages for one course; empty when every lesson passes. */
export function checkCourse(course, cards, options = {}) {
  const index = buildIndex(cards);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const names = new Map();
  for (const card of cards) names.set(termName(card), [...(names.get(termName(card)) ?? []), card.id]);
  const imageExists = options.imageExists ?? (() => true);
  const errors = [];
  const met = new Set();
  for (const lesson of [...course.lessons].sort((a, b) => a.order - b.order)) {
    if (lesson.planned) continue;
    const name = `${course.id} lesson ${lesson.id} (“${lesson.title}”)`;
    for (const id of lesson.cardIds ?? []) {
      if (!byId.has(id)) errors.push(`${name}: cardId ${id} is not a card in the decks`);
      met.add(id);
    }
    if (lesson.terms) errors.push(...termFailures(lesson, name, byId));
    const seen = new Set();
    for (const { token, where, mode } of lessonTokens(lesson)) {
      for (const need of mode === 'word' ? wordNeeds(token, index, names) : needs(token, index)) {
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
    for (const src of lessonImages(lesson)) if (!imageExists(src)) errors.push(`${name}: image ${src} is missing from public/courses/img`);
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
