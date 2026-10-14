// `pnpm generate`: every generator, deterministic (no dates, no randomness, sorted inputs).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apiClassTopics, generateApiCards, POOL_SIZE } from './generate-api-cards.mjs';
import { generateGithubCards } from './generate-github-cards.mjs';
import { generateIcons } from './generate-icons.mjs';
import { copyLessonImages } from './lesson-images.mjs';
import { classUrl, manualUrl, memberUrl, sphinxId } from './lib/docs.mjs';
import { ROOT, writeJson } from './lib/io.mjs';
import { pageTopic, TOPICS } from './lib/topics.mjs';

const { removed } = generateApiCards();
generateGithubCards();

// The language cards are hand-written (data/cards/gdscript.json, left as it is); the copy gains a
// distractor pool, the full explanation, a docs link and a topic.
const gdscript = join(ROOT, 'data/cards/gdscript.json');
const language = existsSync(gdscript) ? JSON.parse(readFileSync(gdscript, 'utf8')) : [];
writeJson('src/data/cards.gdscript.json', language.map((card) => enrichLanguageCard(card, language)));
console.log(`gdscript: ${language.length} cards${existsSync(gdscript) ? '' : ' (data/cards/gdscript.json not written yet)'}`);

// What the generator rules removed, for the deck test and the session notes.
writeJson('data/removed-cards.json', removed);

// Cards per family for the About screen, so About never loads a deck (decision 55).
const counts = {};
for (const family of ['godot-api', 'gdscript', 'github']) {
  counts[family] = JSON.parse(readFileSync(join(ROOT, `src/data/cards.${family}.json`), 'utf8')).length;
}
writeJson('src/data/deck-counts.json', counts);

await generateIcons();
copyLessonImages();

/** Pool = the hand-written wrong answers, then other answers of the same kind and form, then the kind. */
function enrichLanguageCard(card, all) {
  const after = (list) => {
    const at = list.indexOf(card);
    return [...list.slice(at + 1), ...list.slice(0, at)];
  };
  const kin = after(all.filter((c) => c.kind === card.kind));
  const sameForm = kin.filter((c) => Boolean(c.code) === Boolean(card.code));
  const pool = [];
  for (const text of [...card.distractors, ...sameForm.map((c) => c.answer), ...kin.map((c) => c.answer)]) {
    if (text !== card.answer && !pool.includes(text) && pool.length < POOL_SIZE) pool.push(text);
  }
  const idOf = (text) => all.find((c) => c.answer === text && c.kind === card.kind)?.id ?? `gd:wrong:${card.kind}:${text}`;
  const [page, heading] = card.source.ref.split('#');
  return {
    ...card,
    distractorPool: pool,
    distractorIds: pool.map(idOf),
    explainFull: card.explain,
    docsUrl: languageUrl(page, heading),
    topic: languageTopic(page),
  };
}

/** Manual pages link to the section; class-reference pages to the member, annotation or description. */
function languageUrl(page, heading) {
  const cls = /^classes\/class_(.+)$/.exec(page)?.[1];
  if (!cls) return manualUrl(page, heading);
  const name = [...apiClassTopics.keys()].find((n) => n.toLowerCase() === cls) ?? cls;
  if (!heading) return classUrl(name);
  if (heading === 'Description') return `${classUrl(name)}#description`;
  if (heading.startsWith('@')) return `${classUrl(name)}#${sphinxId(`class_${name}_annotation_${heading}`)}`;
  return memberUrl(name, 'method', heading);
}

function languageTopic(page) {
  const topic = pageTopic(page);
  if (topic) return topic;
  const cls = /^classes\/class_(.+)$/.exec(page)?.[1];
  const name = cls && [...apiClassTopics.keys()].find((n) => n.toLowerCase() === cls);
  return (name && apiClassTopics.get(name)) || TOPICS.default;
}
