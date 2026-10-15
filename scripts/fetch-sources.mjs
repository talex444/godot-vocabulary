// `pnpm fetch-sources`: rebuilds the gitignored data/sources/ from the network, then recounts
// data/class-frequency.json from the official demo projects.
//
//   node scripts/fetch-sources.mjs            fetch everything, then count
//   node scripts/fetch-sources.mjs --count    count only (needs data/sources/demo-projects)
//   node scripts/fetch-sources.mjs --check    count only and compare with the committed file
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { ROOT } from './lib/io.mjs';

const GODOT_TAG = '4.7-stable';
const DOCS_BRANCH = '4.7';
const SOURCES = join(ROOT, 'data/sources');
const CACHE = join(SOURCES, '.clones');
const DEMOS = join(SOURCES, 'demo-projects');
const FREQUENCY = join(ROOT, 'data/class-frequency.json');

const git = (args, cwd) => execFileSync('git', args, { cwd, stdio: 'inherit' });
const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function sparseClone(url, ref, dir, paths) {
  rmSync(dir, { recursive: true, force: true });
  git(['clone', '--depth=1', '--filter=blob:none', '--sparse', '--branch', ref, url, dir]);
  git(['sparse-checkout', 'set', '--no-cone', ...paths], dir);
}

async function download(url, to) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  mkdirSync(join(to, '..'), { recursive: true });
  writeFileSync(to, Buffer.from(await res.arrayBuffer()));
}

async function fetchAll() {
  mkdirSync(CACHE, { recursive: true });

  // Godot engine at the release tag.
  const godot = join(CACHE, 'godot');
  sparseClone('https://github.com/godotengine/godot.git', GODOT_TAG, godot, [
    '/doc/classes/', '/editor/icons/', '/thirdparty/fonts/', '/editor/themes/', '/editor/settings/', '/LICENSE.txt', '/COPYRIGHT.txt',
  ]);
  const out = join(SOURCES, 'godot-4.7');
  rmSync(out, { recursive: true, force: true });
  cpSync(join(godot, 'doc/classes'), join(out, 'classes'), { recursive: true });
  cpSync(join(godot, 'editor/icons'), join(out, 'icons'), { recursive: true });
  mkdirSync(join(out, 'fonts'), { recursive: true });
  for (const f of ['Inter_Regular.woff2', 'Inter_Bold.woff2', 'JetBrainsMono_Regular.woff2']) {
    copyFileSync(join(godot, 'thirdparty/fonts', f), join(out, 'fonts', f));
  }
  // Licence files beside the fonts, named for the font they cover.
  for (const f of readdirSync(join(godot, 'thirdparty/fonts')).sort(byName)) {
    const m = /^(?:LICENSE|OFL)[._-]?(Inter|JetBrainsMono)?.*\.txt$/i.exec(f);
    if (m?.[1]) copyFileSync(join(godot, 'thirdparty/fonts', f), join(out, 'fonts', `LICENSE.${m[1]}.txt`));
  }
  mkdirSync(join(out, 'engine-src'), { recursive: true });
  for (const dir of ['editor/themes', 'editor/settings']) {
    for (const f of readdirSync(join(godot, dir)).filter((f) => /^(editor_theme_manager|editor_settings|theme_modern|theme_classic)\.cpp$/.test(f))) {
      copyFileSync(join(godot, dir, f), join(out, 'engine-src', f));
    }
  }
  copyFileSync(join(godot, 'LICENSE.txt'), join(out, 'LICENSE.txt'));
  copyFileSync(join(godot, 'COPYRIGHT.txt'), join(out, 'COPYRIGHT.txt'));
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: godot }).toString().trim();
  writeFileSync(join(out, 'SOURCE.txt'), `${GODOT_TAG} ${sha}\n`);

  // godot-docs pages (raw files on the 4.7 branch), flattened to underscore names.
  const docs = join(SOURCES, 'godot-docs');
  const raw = `https://raw.githubusercontent.com/godotengine/godot-docs/${DOCS_BRANCH}/`;
  const pages = [
    // The class pages lesson 1 (key concepts) quotes, beside the class reference the API cards come from.
    'classes/class_camera2d.rst',
    'classes/class_characterbody2d.rst',
    'classes/class_collisionshape2d.rst',
    'classes/class_node.rst',
    'classes/class_node3d.rst',
    'classes/class_packedscene.rst',
    'classes/class_scenetree.rst',
    'classes/class_signal.rst',
    'classes/class_sprite2d.rst',
    'getting_started/first_2d_game/01.project_setup.rst',
    'getting_started/first_2d_game/02.player_scene.rst',
    'getting_started/first_2d_game/03.coding_the_player.rst',
    'getting_started/first_2d_game/04.creating_the_enemy.rst',
    'getting_started/first_2d_game/05.the_main_game_scene.rst',
    'getting_started/first_2d_game/06.heads_up_display.rst',
    'getting_started/first_2d_game/07.finishing-up.rst',
    'getting_started/introduction/first_look_at_the_editor.rst',
    'getting_started/introduction/key_concepts_overview.rst',
    'getting_started/step_by_step/instancing.rst',
    'getting_started/step_by_step/nodes_and_scenes.rst',
    'getting_started/step_by_step/scripting_first_script.rst',
    'getting_started/step_by_step/scripting_player_input.rst',
    'getting_started/step_by_step/signals.rst',
    'tutorials/scripting/gdscript/gdscript_advanced.rst',
    'tutorials/scripting/gdscript/gdscript_basics.rst',
    'tutorials/scripting/gdscript/gdscript_exports.rst',
    'tutorials/scripting/gdscript/gdscript_format_string.rst',
    'tutorials/scripting/gdscript/static_typing.rst',
  ];
  for (const page of pages) await download(raw + page, join(docs, page.replace(/\//g, '_')));
  await download(raw + 'LICENSE.txt', join(docs, 'LICENSE.txt'));

  // The pictures of the pages the courses are written from (introduction, step-by-step and the first
  // 2D game), flat in godot-docs/img/; `pnpm generate` copies the ones a lesson names to public/courses/img.
  // The first-2D-game pages name theirs without a prefix (img/add_node.webp), so they are saved as
  // first_2d_game_add_node.webp; the other pages' names already carry one.
  for (const page of pages.filter((p) => /^getting_started\/(introduction|step_by_step|first_2d_game)\//.test(p))) {
    const text = readFileSync(join(docs, page.replace(/\//g, '_')), 'utf8');
    const dir = page.slice(0, page.lastIndexOf('/') + 1);
    const prefix = dir === 'getting_started/first_2d_game/' ? 'first_2d_game_' : '';
    const images = new Set([...text.matchAll(/^\s*\.\. (?:image|figure):: (img\/[^\s]+)/gm)].map((m) => m[1]));
    for (const image of [...images].sort(byName)) await download(raw + dir + image, join(docs, 'img', prefix + image.slice('img/'.length)));
  }

  // GitHub glossary (CC BY 4.0).
  const gh = 'https://raw.githubusercontent.com/github/docs/main/';
  await download(gh + 'data/glossaries/external.yml', join(SOURCES, 'github/glossary.yml'));
  await download(gh + 'LICENSE', join(SOURCES, 'github/LICENSE'));

  // Official demo projects: only .gd and .tscn files.
  sparseClone('https://github.com/godotengine/godot-demo-projects.git', 'master', DEMOS, ['*.gd', '*.tscn', 'project.godot']);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort(byName)) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const KEYWORDS = [
  'if', 'elif', 'else', 'for', 'while', 'match', 'when', 'break', 'continue', 'pass', 'return', 'class', 'class_name',
  'extends', 'is', 'in', 'as', 'self', 'super', 'signal', 'func', 'static', 'const', 'enum', 'var', 'breakpoint',
  'preload', 'await', 'yield', 'assert', 'void', 'and', 'or', 'not', 'true', 'false', 'null', 'PI', 'TAU', 'INF', 'NAN',
];

/** Counts every class-reference name and GDScript keyword across the demo projects. */
export function countFrequency() {
  const classNames = readdirSync(join(SOURCES, 'godot-4.7/classes'))
    .filter((f) => f.endsWith('.xml'))
    .map((f) => basename(f, '.xml'))
    .sort(byName);
  const projects = walk(DEMOS).filter((f) => basename(f) === 'project.godot').map((f) => relative(DEMOS, join(f, '..')));
  const projectOf = (file) => {
    const rel = relative(DEMOS, file).replace(/\\/g, '/');
    return projects.map((p) => p.replace(/\\/g, '/')).filter((p) => rel.startsWith(p + '/')).sort((a, b) => b.length - a.length)[0];
  };
  const files = walk(DEMOS).filter((f) => /\.(gd|tscn)$/.test(f) && projectOf(f) !== undefined);

  const tally = (names, sourceFiles) => {
    const rows = new Map(names.map((n) => [n, { name: n, mentions: 0, files: 0, projects: new Set() }]));
    for (const file of sourceFiles) {
      const counts = new Map();
      for (const m of readFileSync(file, 'utf8').matchAll(/@?[A-Za-z_][A-Za-z0-9_]*/g)) {
        if (rows.has(m[0])) counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
      }
      for (const [n, c] of counts) {
        const row = rows.get(n);
        row.mentions += c;
        row.files += 1;
        row.projects.add(projectOf(file));
      }
    }
    return [...rows.values()]
      .map((r) => ({ name: r.name, mentions: r.mentions, files: r.files, projects: r.projects.size }))
      .sort((a, b) => b.projects - a.projects || b.files - a.files || b.mentions - a.mentions || byName(a.name, b.name));
  };

  const previous = existsSync(FREQUENCY) ? JSON.parse(readFileSync(FREQUENCY, 'utf8')) : {};
  return {
    source: 'godotengine/godot-demo-projects (MIT), .gd + .tscn files',
    godot: '4.7-stable doc/classes names',
    generated: previous.generated ?? 'unknown',
    fileCount: files.length,
    projectCount: projects.length,
    classes: tally(classNames, files),
    keywords: tally(KEYWORDS, files.filter((f) => f.endsWith('.gd'))),
  };
}

const mode = process.argv[2];
if (mode !== '--count' && mode !== '--check') await fetchAll();
if (!existsSync(DEMOS)) {
  console.error(`No demo projects at ${relative(ROOT, DEMOS)}; run without flags to fetch them.`);
  process.exit(1);
}
const text = JSON.stringify(countFrequency(), null, 2) + '\n';
if (mode === '--check') {
  const same = existsSync(FREQUENCY) && readFileSync(FREQUENCY, 'utf8') === text;
  console.log(same ? 'class-frequency.json reproduced byte for byte' : 'class-frequency.json differs from the recount');
  process.exit(same ? 0 : 1);
}
writeFileSync(FREQUENCY, text);
console.log(`class-frequency.json: ${text.length} bytes`);
