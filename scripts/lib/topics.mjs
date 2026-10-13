// Card topics from scripts/topics.json (decision 30, done-criteria 39).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './io.mjs';

export const TOPICS = JSON.parse(readFileSync(join(ROOT, 'scripts/topics.json'), 'utf8'));

const DOCS = join(ROOT, 'data/sources/godot-docs');

/** Topic of a manual page path, or undefined when the mapping does not list it. */
export function pageTopic(page) {
  return TOPICS.pages.find((p) => p.page === page)?.topic ?? TOPICS.classPages[page];
}

/**
 * Topic per class name: the first staged page that mentions it, else the first inheritance root,
 * else the default. `lineage(name)` returns the class followed by its ancestors.
 */
export function classTopics(names, lineage) {
  const lower = new Map(names.map((n) => [n.toLowerCase(), n]));
  const known = new Set(names);
  const topic = new Map();
  for (const { page, topic: t } of TOPICS.pages) {
    const file = join(DOCS, `${page.replace(/\//g, '_')}.rst`);
    if (!existsSync(file)) throw new Error(`topics.json lists ${page}, but ${file} is missing (run pnpm fetch-sources).`);
    const rst = readFileSync(file, 'utf8');
    for (const m of rst.matchAll(/:ref:`[^`]*?class_(\w+)>?`|``([A-Za-z_][A-Za-z0-9_]*)``/g)) {
      const name = m[1] ? lower.get(m[1].toLowerCase()) : known.has(m[2]) ? m[2] : undefined;
      if (name && !topic.has(name)) topic.set(name, t);
    }
  }
  for (const name of names) {
    if (topic.has(name)) continue;
    const line = lineage(name);
    topic.set(name, TOPICS.roots.find((r) => line.includes(r.class))?.topic ?? TOPICS.default);
  }
  return topic;
}
