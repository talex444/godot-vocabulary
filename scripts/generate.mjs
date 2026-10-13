// `pnpm generate`: every generator, deterministic (no dates, no randomness, sorted inputs).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateApiCards } from './generate-api-cards.mjs';
import { generateGithubCards } from './generate-github-cards.mjs';
import { generateIcons } from './generate-icons.mjs';
import { ROOT, writeJson } from './lib/io.mjs';

generateApiCards();
generateGithubCards();

// The language cards are hand-written (session 2); until then the deck ships an empty family.
const gdscript = join(ROOT, 'data/cards/gdscript.json');
const language = existsSync(gdscript) ? JSON.parse(readFileSync(gdscript, 'utf8')) : [];
writeJson('src/data/cards.gdscript.json', language);
console.log(`gdscript: ${language.length} cards${existsSync(gdscript) ? '' : ' (data/cards/gdscript.json not written yet)'}`);

await generateIcons();
