// Godot class reference (data/sources/godot-4.7/classes) → src/data/cards.godot-api.json.
// Class cards for every class the demo projects use plus the first-2D-game tutorial classes,
// member cards (methods, properties, signals) for the top classes by rank.
// Also copies the referenced class icons to public/icons and the fonts to public/fonts.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { bbcodeToText, firstSentences } from './lib/bbcode.mjs';
import { ROOT, isMain, writeJson } from './lib/io.mjs';

const VERSION = '4.7-stable';
const SRC = join(ROOT, 'data/sources/godot-4.7');
const DOCS = join(ROOT, 'data/sources/godot-docs');
const MEMBER_CLASSES = 40;
const MAX_METHODS = 10;
const MAX_PROPERTIES = 8;

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '#text',
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  // Builtin types have <constructor> elements, a name the parser refuses.
  transformTagName: (name) => (name === 'constructor' ? 'ctor' : name),
  isArray: (name) => ['method', 'member', 'signal', 'param'].includes(name),
});

const text = (node) => (typeof node === 'string' ? node : (node?.['#text'] ?? ''));
const flagged = (node) => node && (node.deprecated !== undefined || node.experimental !== undefined);

function loadClasses() {
  const dir = join(SRC, 'classes');
  const classes = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.xml')).sort(byName)) {
    const c = parser.parse(readFileSync(join(dir, file), 'utf8')).class;
    const entries = (list) => (list ?? []).map((m) => ({ ...m, text: bbcodeToText(text(m.description ?? m)) }));
    classes.set(c.name, {
      name: c.name,
      inherits: c.inherits ?? null,
      flagged: flagged(c),
      brief: bbcodeToText(text(c.brief_description)),
      description: bbcodeToText(text(c.description)),
      methods: entries(c.methods?.method),
      members: entries(c.members?.member),
      signals: entries(c.signals?.signal),
    });
  }
  return classes;
}

/** Class names in order of first mention across the first-2D-game tutorial pages. */
function tutorialClasses(classes) {
  const lower = new Map([...classes.keys()].map((k) => [k.toLowerCase(), k]));
  const files = readdirSync(DOCS).filter((f) => /^getting_started_first_2d_game_.*\.rst$/.test(f)).sort(byName);
  const seen = [];
  for (const file of files) {
    const rst = readFileSync(join(DOCS, file), 'utf8');
    for (const m of rst.matchAll(/:ref:`[^`]*?class_(\w+)>?`|``([A-Za-z_][A-Za-z0-9_]*)``/g)) {
      const name = m[1] ? lower.get(m[1].toLowerCase()) : classes.has(m[2]) ? m[2] : undefined;
      if (name && !seen.includes(name)) seen.push(name);
    }
  }
  return seen;
}

const usable = (c) => c && !c.name.startsWith('@') && c.brief !== '';

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Hides the answer where the prompt would give it away: as code always, as a bare word when asked. */
function mask(prompt, name, bareWords) {
  let out = prompt.replace(new RegExp(`\`(?:[A-Za-z0-9_]+\\.)?${escapeRegExp(name)}(?:\\(\\))?\``, 'g'), '`____`');
  if (bareWords || name.includes('_')) out = out.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g'), '____');
  return out;
}

function ancestors(classes, name) {
  const out = [];
  let cur = classes.get(name)?.inherits;
  while (cur && classes.has(cur) && !out.includes(cur)) {
    out.push(cur);
    cur = classes.get(cur).inherits;
  }
  return out;
}

/** Picks `n` distinct names from `pool`, starting after `answer`'s position so neighbours differ per card. */
function pickAround(pool, answer, n, taken = []) {
  const list = pool.filter((x, i) => x !== answer && !taken.includes(x) && pool.indexOf(x) === i);
  if (list.length <= n) return list;
  const at = pool.indexOf(answer);
  const start = at < 0 ? 0 : list.findIndex((x) => pool.indexOf(x) > at);
  const out = [];
  for (let i = 0; out.length < n; i++) out.push(list[((start < 0 ? 0 : start) + i) % list.length]);
  return out;
}

function classDistractors(classes, rankOf, deckOrder, name) {
  const order = (a, b) => (rankOf.get(a) ?? 1e9) - (rankOf.get(b) ?? 1e9) || byName(a, b);
  const candidates = (pred) =>
    [...classes.values()].filter((c) => usable(c) && c.name !== name && pred(c)).map((c) => c.name).sort(order);
  const self = classes.get(name);
  const out = [];
  out.push(...pickAround([name, ...candidates((c) => c.inherits === self.inherits)], name, 3, out));
  for (const anc of ancestors(classes, name)) {
    if (out.length >= 3) break;
    const lineage = [name, ...ancestors(classes, name)];
    out.push(...pickAround(candidates((c) => c.inherits === classes.get(anc).inherits && !lineage.includes(c.name)), name, 3 - out.length, out));
  }
  if (out.length < 3) out.push(...pickAround(deckOrder, name, 3 - out.length, out));
  return out.slice(0, 3);
}

function signature(kind, m) {
  const params = (m.param ?? [])
    .slice()
    .sort((a, b) => Number(a.index) - Number(b.index))
    .map((p) => `${p.name}: ${p.type}${p.default !== undefined ? ` = ${p.default}` : ''}`)
    .join(', ');
  if (kind === 'method') return `${m.name}(${params}) -> ${m.return?.type ?? 'void'}`;
  if (kind === 'signal') return `${m.name}(${params})`;
  return `${m.name}: ${m.type}${m.default !== undefined ? ` = ${m.default}` : ''}`;
}

const KINDS = [
  { kind: 'method', list: 'methods', id: 'method', max: MAX_METHODS, show: (n) => `${n}()` },
  { kind: 'property', list: 'members', id: 'prop', max: MAX_PROPERTIES, show: (n) => n },
  { kind: 'signal', list: 'signals', id: 'signal', max: Infinity, show: (n) => n },
];

function memberCards(classes, cls, classCard) {
  const lineage = ancestors(classes, cls.name);
  const inherited = (list, name) => lineage.some((a) => classes.get(a)[list].some((m) => m.name === name));
  const picked = [];
  for (const k of KINDS) {
    const all = cls[k.list].filter((m) => !flagged(m) && m.overrides === undefined);
    const eligible = all.filter((m) => m.text !== '' && !(k.kind === 'method' && inherited('methods', m.name))).slice(0, k.max);
    const pool = all.map((m) => k.show(m.name));
    const fallback = lineage.flatMap((a) => classes.get(a)[k.list].filter((m) => !flagged(m) && m.overrides === undefined).map((m) => k.show(m.name)));
    eligible.forEach((m, i) => {
      const answer = k.show(m.name);
      const distractors = pickAround(pool, answer, 3);
      if (distractors.length < 3) distractors.push(...pickAround(fallback, answer, 3 - distractors.length, distractors));
      if (distractors.length < 3) return;
      picked.push({ k, m, i, answer, distractors });
    });
  }
  // Round-robin by kind so a class's first members mix methods, properties and signals.
  picked.sort((a, b) => a.i - b.i || KINDS.indexOf(a.k) - KINDS.indexOf(b.k));
  return picked.map(({ k, m, answer, distractors }, index) => ({
    id: `api:${k.id}:${cls.name}.${m.name}`,
    family: 'godot-api',
    kind: k.kind,
    prompt: `${cls.name}: ${mask(firstSentences(m.text, 2), m.name, false)}`,
    answer,
    distractors,
    explain: `\`${signature(k.kind, m)}\`\n${firstSentences(m.text, 2)}`,
    source: { doc: 'godot-class-reference', ref: `${cls.name}.${m.name}`, version: VERSION },
    rank: Math.round((classCard.rank + (index + 1) / (picked.length + 1)) * 10000) / 10000,
    requires: classCard.id,
  }));
}

export function generateApiCards() {
  const classes = loadClasses();
  const frequency = JSON.parse(readFileSync(join(ROOT, 'data/class-frequency.json'), 'utf8')).classes;

  const tutorial = tutorialClasses(classes).filter((n) => usable(classes.get(n)));
  const used = frequency.filter((r) => r.projects > 0 && usable(classes.get(r.name))).map((r) => r.name);
  const deckOrder = [...tutorial, ...used.filter((n) => !tutorial.includes(n))];
  const rankOf = new Map(deckOrder.map((n, i) => [n, i]));

  const iconDir = join(SRC, 'icons');
  const classCards = deckOrder.map((name, rank) => {
    const c = classes.get(name);
    const prompt = mask(c.brief || firstSentences(c.description, 1), name, true);
    const card = {
      id: `api:class:${name}`,
      family: 'godot-api',
      kind: 'class',
      prompt,
      answer: name,
      distractors: classDistractors(classes, rankOf, deckOrder, name),
      explain: firstSentences(c.description, 2) || c.brief,
      source: { doc: 'godot-class-reference', ref: name, version: VERSION },
      rank,
    };
    if (existsSync(join(iconDir, `${name}.svg`))) card.icon = `icons/${name}.svg`;
    return card;
  });

  // The first MEMBER_CLASSES classes that have members to ask about (float, int, bool have none).
  const members = [];
  let withMembers = 0;
  for (let i = 0; i < deckOrder.length && withMembers < MEMBER_CLASSES; i++) {
    const cards = memberCards(classes, classes.get(deckOrder[i]), classCards[i]);
    if (cards.length) withMembers++;
    members.push(...cards);
  }
  const cards = [...classCards, ...members].sort((a, b) => a.rank - b.rank || byName(a.id, b.id));

  writeJson('src/data/cards.godot-api.json', cards);
  copyAssets(cards);
  console.log(`godot-api: ${classCards.length} class cards (${tutorial.length} tutorial classes pinned), ${members.length} member cards`);
  return cards;
}

function copyAssets(cards) {
  const icons = join(ROOT, 'public/icons');
  rmSync(icons, { recursive: true, force: true });
  mkdirSync(icons, { recursive: true });
  // Class-name choices show icons too, so copy the icon of every class name that can appear as a choice.
  const names = new Set();
  for (const c of cards) if (c.kind === 'class') for (const n of [c.answer, ...c.distractors]) names.add(n);
  for (const n of [...names].sort(byName)) {
    const from = join(SRC, 'icons', `${n}.svg`);
    if (existsSync(from)) copyFileSync(from, join(icons, `${n}.svg`));
  }
  const fonts = join(ROOT, 'public/fonts');
  mkdirSync(fonts, { recursive: true });
  for (const f of ['Inter_Regular.woff2', 'Inter_Bold.woff2', 'JetBrainsMono_Regular.woff2', 'LICENSE.Inter.txt', 'LICENSE.JetBrainsMono.txt']) {
    copyFileSync(join(SRC, 'fonts', f), join(fonts, f));
  }
}

if (isMain(import.meta.url)) generateApiCards();
