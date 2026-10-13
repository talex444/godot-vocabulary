// Godot class reference (data/sources/godot-4.7/classes) → src/data/cards.godot-api.json.
// Class cards for every class the demo projects use plus the first-2D-game tutorial classes,
// member cards (methods, properties, signals) for the top classes by rank.
// Also copies the referenced class icons to public/icons and the fonts to public/fonts.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { bbcodeToText, capText, firstSentences, wordCount } from './lib/bbcode.mjs';
import { classUrl, memberUrl } from './lib/docs.mjs';
import { ROOT, isMain, writeJson } from './lib/io.mjs';
import { classTopics } from './lib/topics.mjs';

const VERSION = '4.7-stable';
const SRC = join(ROOT, 'data/sources/godot-4.7');
const DOCS = join(ROOT, 'data/sources/godot-docs');
const MEMBER_CLASSES = 40;
const MAX_METHODS = 10;
const MAX_PROPERTIES = 8;
/** Distractor pool size (decision 24): enough for fresh wrong answers on every showing. */
export const POOL_SIZE = 8;
/** Smallest pool a card may ship with. */
export const MIN_POOL = 4;
/** `explainFull` cap in characters (done-criteria 36). */
export const FULL_MAX = 1200;

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
      editor: c.api_type === 'editor',
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
/** Classes that may stand as a wrong answer: usable and not editor-only. */
const choosable = (c) => usable(c) && !c.editor;
const normalise = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Hides the answer where the prompt would give it away: as code always, as a bare word when asked. */
function mask(prompt, name, bareWords) {
  let out = prompt.replace(new RegExp(`\`(?:[A-Za-z0-9_]+\\.)?${escapeRegExp(name)}(?:\\(\\))?\``, 'g'), '`____`');
  if (bareWords || name.includes('_')) out = out.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g'), '____');
  return out;
}

/** Rule (c): a prompt is hollow when masking left a blank in it or two words or fewer. */
const hollow = (prompt) => prompt.includes('____') || wordCount(prompt) <= 2;

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

/** Siblings under the same parent, then the nearest ancestor's other children, then rank neighbours. */
function classPool(classes, rankOf, deckOrder, name) {
  const order = (a, b) => (rankOf.get(a) ?? 1e9) - (rankOf.get(b) ?? 1e9) || byName(a, b);
  const candidates = (pred) =>
    [...classes.values()].filter((c) => choosable(c) && c.name !== name && pred(c)).map((c) => c.name).sort(order);
  const self = classes.get(name);
  const lineage = [name, ...ancestors(classes, name)];
  const out = [];
  out.push(...pickAround([name, ...candidates((c) => c.inherits === self.inherits)], name, POOL_SIZE, out));
  for (const anc of ancestors(classes, name)) {
    if (out.length >= POOL_SIZE) break;
    out.push(...pickAround(candidates((c) => c.inherits === classes.get(anc).inherits && !lineage.includes(c.name)), name, POOL_SIZE - out.length, out));
  }
  if (out.length < POOL_SIZE) out.push(...pickAround(deckOrder, name, POOL_SIZE - out.length, out));
  return out.slice(0, POOL_SIZE);
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

function memberCards(classes, cls, classCard, removed) {
  const lineage = ancestors(classes, cls.name);
  const inherited = (list, name) => lineage.some((a) => classes.get(a)[list].some((m) => m.name === name));
  const listed = (owner, k) => owner[k.list].filter((m) => !flagged(m) && m.overrides === undefined);
  const picked = [];
  for (const k of KINDS) {
    const all = listed(cls, k);
    const eligible = all.filter((m) => m.text !== '' && !(k.kind === 'method' && inherited('methods', m.name))).slice(0, k.max);
    // Same-kind members of this class, then of its ancestors; ids say whose member each one is.
    const own = all.map((m) => ({ show: k.show(m.name), id: `api:${k.id}:${cls.name}.${m.name}` }));
    const parents = lineage.flatMap((a) => listed(classes.get(a), k).map((m) => ({ show: k.show(m.name), id: `api:${k.id}:${a}.${m.name}` })));
    // Later entries win: the class's own member, then the nearest ancestor's.
    const idOf = new Map([...[...parents].reverse(), ...own].map((e) => [e.show, e.id]));
    eligible.forEach((m, i) => {
      const id = `api:${k.id}:${cls.name}.${m.name}`;
      // Rule (d): a description of four words or fewer says too little to ask about.
      if (wordCount(m.text) <= 4) return void removed.shortMember.push(id);
      let prompt = mask(firstSentences(m.text, 2), m.name, false);
      if (hollow(prompt)) prompt = mask(firstSentences(m.text, 1), m.name, false);
      if (hollow(prompt)) return void removed.hollow.push(id);
      const answer = k.show(m.name);
      const pool = pickAround(own.map((e) => e.show), answer, POOL_SIZE);
      if (pool.length < POOL_SIZE) pool.push(...pickAround(parents.map((e) => e.show), answer, POOL_SIZE - pool.length, pool));
      if (pool.length < MIN_POOL) return void removed.smallPool.push(id);
      picked.push({ k, m, i, id, prompt, answer, pool, poolIds: pool.map((p) => idOf.get(p)) });
    });
  }
  // Round-robin by kind so a class's first members mix methods, properties and signals.
  picked.sort((a, b) => a.i - b.i || KINDS.indexOf(a.k) - KINDS.indexOf(b.k));
  return picked.map(({ k, m, id, prompt, answer, pool, poolIds }, index) => ({
    id,
    family: 'godot-api',
    kind: k.kind,
    prompt: `${cls.name}: ${prompt}`,
    answer,
    distractors: pool.slice(0, 3),
    distractorPool: pool,
    distractorIds: poolIds,
    explain: `\`${signature(k.kind, m)}\`\n${firstSentences(m.text, 2)}`,
    explainFull: `\`${signature(k.kind, m)}\`\n${capText(m.text, FULL_MAX - signature(k.kind, m).length - 3)}`,
    docsUrl: memberUrl(cls.name, k.kind, m.name),
    topic: classCard.topic,
    source: { doc: 'godot-class-reference', ref: `${cls.name}.${m.name}`, version: VERSION },
    rank: Math.round((classCard.rank + (index + 1) / (picked.length + 1)) * 10000) / 10000,
    requires: classCard.id,
  }));
}

/** Class name → topic, for the language cards that cite a class-reference page. */
export let apiClassTopics = new Map();

export function generateApiCards() {
  const classes = loadClasses();
  const frequency = JSON.parse(readFileSync(join(ROOT, 'data/class-frequency.json'), 'utf8')).classes;

  const tutorial = tutorialClasses(classes).filter((n) => usable(classes.get(n)));
  const used = frequency.filter((r) => r.projects > 0 && usable(classes.get(r.name))).map((r) => r.name);
  const candidates = [...tutorial, ...used.filter((n) => !tutorial.includes(n))];
  const rankOf = new Map(candidates.map((n, i) => [n, i]));
  const topics = classTopics([...classes.keys()], (n) => [n, ...ancestors(classes, n)]);
  apiClassTopics = topics;

  // Generator rules (decision 26, done-criteria 38). A dropped class still serves as a wrong answer.
  const removed = { duplicateBrief: [], editor: [], hollow: [], shortMember: [], smallPool: [] };
  const briefCount = new Map();
  for (const c of classes.values()) if (choosable(c)) briefCount.set(normalise(c.brief), (briefCount.get(normalise(c.brief)) ?? 0) + 1);
  const prompts = new Map();
  const deckOrder = [];
  for (const name of candidates) {
    const c = classes.get(name);
    if (c.editor) {
      removed.editor.push(`api:class:${name}`);
      continue;
    }
    if (briefCount.get(normalise(c.brief)) > 1) {
      removed.duplicateBrief.push(`api:class:${name}`);
      continue;
    }
    let prompt = mask(c.brief, name, true);
    if (hollow(prompt)) prompt = mask(firstSentences(c.description, 1), name, true);
    if (hollow(prompt)) {
      removed.hollow.push(`api:class:${name}`);
      continue;
    }
    prompts.set(name, prompt);
    deckOrder.push(name);
  }

  const iconDir = join(SRC, 'icons');
  const classCards = deckOrder.map((name, rank) => {
    const c = classes.get(name);
    const pool = classPool(classes, rankOf, candidates, name);
    const card = {
      id: `api:class:${name}`,
      family: 'godot-api',
      kind: 'class',
      prompt: prompts.get(name),
      answer: name,
      distractors: pool.slice(0, 3),
      distractorPool: pool,
      distractorIds: pool.map((n) => `api:class:${n}`),
      explain: firstSentences(c.description, 2) || c.brief,
      explainFull: capText(c.description || c.brief, FULL_MAX),
      docsUrl: classUrl(name),
      topic: topics.get(name),
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
    const cards = memberCards(classes, classes.get(deckOrder[i]), classCards[i], removed);
    if (cards.length) withMembers++;
    members.push(...cards);
  }
  const cards = [...classCards, ...members].sort((a, b) => a.rank - b.rank || byName(a.id, b.id));

  writeJson('src/data/cards.godot-api.json', cards);
  copyAssets(cards);
  console.log(`godot-api: ${classCards.length} class cards (${tutorial.length} tutorial classes pinned), ${members.length} member cards`);
  const rules = [
    ['duplicateBrief', 'class brief identical to another class'],
    ['editor', 'editor-only class (api_type="editor")'],
    ['hollow', 'prompt left with ____ or two words or fewer'],
    ['shortMember', 'member description of four words or fewer'],
    ['smallPool', `fewer than ${MIN_POOL} wrong answers available`],
  ];
  for (const [key, label] of rules) console.log(`godot-api: removed ${removed[key].length}: ${label}`);
  return { cards, removed };
}

function copyAssets(cards) {
  const icons = join(ROOT, 'public/icons');
  rmSync(icons, { recursive: true, force: true });
  mkdirSync(icons, { recursive: true });
  // Class-name choices show icons too, so copy the icon of every class name that can appear as a choice.
  const names = new Set();
  for (const c of cards) if (c.kind === 'class') for (const n of [c.answer, ...c.distractorPool]) names.add(n);
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
