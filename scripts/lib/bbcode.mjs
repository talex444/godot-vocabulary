// Converts Godot class-reference BBCode to plain text with a tiny markup the UI renders:
// `inline code` in backticks and fenced ``` blocks for code samples.

const REF_TAGS = ['member', 'signal', 'constant', 'enum', 'param', 'annotation', 'theme_item', 'operator'];
const METHOD_TAGS = ['method', 'constructor'];
const BUILTIN_TYPES = new Set(['bool', 'int', 'float', 'void', 'null']);

/** Removes the common leading indentation (tabs or spaces) from every non-empty line. */
export function dedent(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  const indents = lines.filter((l) => l.trim() !== '').map((l) => /^[\t ]*/.exec(l)[0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(cut).replace(/[\t ]+$/, '')).join('\n');
}

const brackets = (s) => s.replace(/\[lb\]/g, '[').replace(/\[rb\]/g, ']');

/** Godot BBCode → plain text with backticks and fenced blocks. Unknown tags are stripped. */
export function bbcodeToText(input) {
  if (!input) return '';
  const kept = [];
  const keep = (s) => `\u0000${kept.push(s) - 1}\u0000`;
  let s = dedent(input);

  // Multi-language samples: keep the GDScript one.
  s = s.replace(/\[codeblocks\]([\s\S]*?)\[\/codeblocks\]/g, (_, inner) => {
    const gd = /\[gdscript[^\]]*\]([\s\S]*?)\[\/gdscript\]/.exec(inner);
    const any = /\[(\w+)[^\]]*\]([\s\S]*?)\[\/\1\]/.exec(inner);
    const body = gd ? gd[1] : any ? any[2] : '';
    return `[codeblock]${body}[/codeblock]`;
  });
  s = s.replace(/\n?\[codeblock[^\]]*\]([\s\S]*?)\[\/codeblock\]\n?/g, (_, body) => `\n${keep('```\n' + brackets(dedent(body)) + '\n```')}\n`);
  s = s.replace(/\[(code|kbd)\]([\s\S]*?)\[\/\1\]/g, (_, _tag, body) => keep('`' + brackets(body) + '`'));

  s = s.replace(new RegExp(`\\[(?:${METHOD_TAGS.join('|')}) ([^\\]]+)\\]`, 'g'), (_, name) => keep('`' + name + '()`'));
  s = s.replace(new RegExp(`\\[(?:${REF_TAGS.join('|')}) ([^\\]]+)\\]`, 'g'), (_, name) => keep('`' + name + '`'));
  s = s.replace(/\[url=[^\]]*\]([\s\S]*?)\[\/url\]/g, '$1');
  s = s.replace(/\[url\]([\s\S]*?)\[\/url\]/g, '$1');
  s = s.replace(/\[br\]/g, '\n');
  s = s.replace(/\[\/?(?:b|i|u|s|center|indent)\]/g, '');
  // Class references: [Timer], [@GDScript], [int].
  s = s.replace(/\[(@?[A-Z][A-Za-z0-9_]*|@?[a-z][A-Za-z0-9_]*)\]/g, (whole, name) =>
    /^@?[A-Z]/.test(name) || BUILTIN_TYPES.has(name) ? keep('`' + name + '`') : name === 'lb' || name === 'rb' ? whole : '',
  );
  // Anything else that looks like a tag.
  s = s.replace(/\[\/?[a-z_]+(?:[ =][^\]]*)?\]/g, (whole) => (whole === '[lb]' || whole === '[rb]' ? whole : ''));
  s = brackets(s);
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);
  return s
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The first `n` sentences of the prose (fenced blocks and the lines that introduce them are skipped). */
export function firstSentences(text, n) {
  const prose = [];
  for (const block of text.split(/```[\s\S]*?```/)) {
    for (const line of block.split('\n')) {
      const t = line.trim();
      if (t && !t.endsWith(':')) prose.push(t);
    }
  }
  const pieces = prose.join(' ').split(/(?<=[.!?])\s+/);
  const out = [];
  let buf = '';
  for (const piece of pieces) {
    buf = buf ? `${buf} ${piece}` : piece;
    // Do not end a sentence on common abbreviations.
    if (/\b(?:e\.g|i\.e|etc|vs)\.$/.test(buf)) continue;
    out.push(buf);
    buf = '';
    if (out.length === n) break;
  }
  if (buf && out.length < n) out.push(buf);
  return out.join(' ').trim();
}

/** Tag names whose raw form must never reach the deck (used by tests). */
export const RAW_TAG_PATTERN = /\[\/?(?:b|i|u|code|codeblock|codeblocks|gdscript|csharp|member|method|signal|constant|enum|param|annotation|theme_item|operator|constructor|url|br|kbd|lb|rb)(?:[ =\]])/;
