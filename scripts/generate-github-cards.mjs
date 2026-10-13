// GitHub glossary (data/sources/github/glossary.yml, CC BY 4.0) → src/data/cards.github.json,
// filtered and ordered by scripts/github-terms-allowlist.json (order = rank).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { firstSentences } from './lib/bbcode.mjs';
import { ROOT, isMain, writeJson } from './lib/io.mjs';

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
  const allow = JSON.parse(readFileSync(join(ROOT, 'scripts/github-terms-allowlist.json'), 'utf8'));
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
  const n = terms.length;
  const cards = entries.map(({ term, description }, rank) => {
    // Spread the distractors across the list so near-synonyms (main/master, fetch/pull) rarely meet.
    const stride = Math.max(1, Math.floor(n / 4));
    const distractors = [1, 2, 3].map((k) => terms[(rank + k * stride) % n]);
    const prompt = description.replace(new RegExp(`\\b${escapeRegExp(term)}(?:s|es)?\\b`, 'gi'), '____');
    return {
      id: `gh:term:${slug(term)}`,
      family: 'github',
      kind: 'term',
      prompt,
      answer: term,
      distractors,
      explain: `${term}: ${firstSentences(description, 2)}`,
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
