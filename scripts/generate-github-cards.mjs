// GitHub glossary (data/sources/github/glossary.yml, CC BY 4.0) → src/data/cards.github.json,
// filtered and ordered by scripts/github-terms-allowlist.json (order = rank).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { capText, firstSentences } from './lib/bbcode.mjs';
import { glossaryUrl } from './lib/docs.mjs';
import { ROOT, isMain, writeJson } from './lib/io.mjs';
import { FULL_MAX, POOL_SIZE } from './generate-api-cards.mjs';

const VERSION = 'github/docs ae648a1d 2026-10-13';

const LIQUID = {
  'variables.product.prodname_dotcom': 'GitHub',
  'variables.product.prodname_ghe_server': 'GitHub Enterprise Server',
  'variables.product.prodname_ghe_cloud': 'GitHub Enterprise Cloud',
  'variables.product.pat_generic': 'personal access token',
  'variables.product.prodname_actions': 'GitHub Actions',
  'variables.product.prodname_dependabot': 'Dependabot',
  'variables.product.prodname_codespaces': 'GitHub Codespaces',
  'variables.product.product_name': 'GitHub',
  'variables.product.github': 'GitHub',
};

/** Resolves the known `{% data … %}` tokens; returns null if any Liquid is left. */
function resolveLiquid(s) {
  const out = s.replace(/\{%-?\s*data\s+([\w.]+)\s*-?%\}/g, (whole, key) => LIQUID[key] ?? whole);
  return /\{%|\{\{/.test(out) ? null : out;
}

const slug = (term) => term.toLowerCase().replace(/^@/, 'at-').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function clean(description) {
  return description
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function generateGithubCards() {
  const glossary = parse(readFileSync(join(ROOT, 'data/sources/github/glossary.yml'), 'utf8'));
  const allowList = JSON.parse(readFileSync(join(ROOT, 'scripts/github-terms-allowlist.json'), 'utf8'));
  const allow = allowList.terms.map(([term]) => term);
  const groupOf = new Map(allowList.terms);
  const synonymsOf = (term) => allowList.synonyms.find((set) => set.includes(term)) ?? [term];
  const byTerm = new Map(glossary.map((e) => [String(e.term), String(e.description ?? '')]));

  const missing = allow.filter((t) => !byTerm.has(t));
  const skipped = [];
  const entries = [];
  for (const term of allow) {
    if (!byTerm.has(term)) continue;
    const resolved = resolveLiquid(byTerm.get(term));
    if (resolved === null) {
      skipped.push(term);
      continue;
    }
    entries.push({ term, description: clean(resolved) });
  }

  const terms = entries.map((e) => e.term);
  const cards = entries.map(({ term, description }, rank) => {
    // Terms of the same group first, then the others; each list starts after this term's place so
    // neighbours differ per card. Synonyms never stand as wrong answers.
    const after = (list) => [...list.slice(rank + 1), ...list.slice(0, rank)];
    const allowed = after(terms).filter((t) => !synonymsOf(term).includes(t));
    const same = allowed.filter((t) => groupOf.get(t) === groupOf.get(term));
    const pool = [...same.slice(0, POOL_SIZE - 2), ...allowed.filter((t) => !same.includes(t))].slice(0, POOL_SIZE);
    const prompt = description.replace(new RegExp(`\\b${escapeRegExp(term)}(?:s|es)?\\b`, 'gi'), '____');
    return {
      id: `gh:term:${slug(term)}`,
      family: 'github',
      kind: 'term',
      prompt,
      answer: term,
      distractors: pool.slice(0, 3),
      distractorPool: pool,
      distractorIds: pool.map((t) => `gh:term:${slug(t)}`),
      explain: `${term}: ${firstSentences(description, 2)}`,
      explainFull: `${term}: ${capText(description, FULL_MAX - term.length - 2)}`,
      docsUrl: glossaryUrl(term),
      topic: groupOf.get(term),
      source: { doc: 'github-glossary', ref: term, version: VERSION },
      rank,
    };
  });

  writeJson('src/data/cards.github.json', cards);
  console.log(`github: ${cards.length} term cards`);
  if (missing.length) console.log(`github: allow-listed terms not in the glossary: ${missing.join(', ')}`);
  if (skipped.length) console.log(`github: skipped for unresolved Liquid: ${skipped.join(', ')}`);
  return cards;
}

if (isMain(import.meta.url)) generateGithubCards();
