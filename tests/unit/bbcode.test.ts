import { describe, expect, it } from 'vitest';
import { RAW_TAG_PATTERN, bbcodeToText, dedent, firstSentences } from '../../scripts/lib/bbcode.mjs';

describe('bbcodeToText', () => {
  it('turns code and references into backticks', () => {
    expect(bbcodeToText('If [code]true[/code], see [member wait_time] and [method start].')).toBe(
      'If `true`, see `wait_time` and `start()`.',
    );
    expect(bbcodeToText('Emits [signal timeout]; uses [constant FOO], [enum Mode] and [param time_sec].')).toBe(
      'Emits `timeout`; uses `FOO`, `Mode` and `time_sec`.',
    );
    expect(bbcodeToText('Use [method SceneTree.create_timer] on a [Timer] or [int].')).toBe(
      'Use `SceneTree.create_timer()` on a `Timer` or `int`.',
    );
  });

  it('drops bold and italic, keeps link text, honours line breaks', () => {
    expect(bbcodeToText('[b]Note:[/b] [i]really[/i] read [url=https://example.com]the docs[/url].[br]Next')).toBe(
      'Note: really read the docs.\nNext',
    );
    expect(bbcodeToText('[url]https://godotengine.org[/url]')).toBe('https://godotengine.org');
  });

  it('turns codeblocks into fenced blocks and keeps the GDScript sample', () => {
    const xml = '\n\t\tBefore:\n\t\t[codeblock]\n\t\tfunc f():\n\t\t\tpass\n\t\t[/codeblock]\n\t\tAfter.\n\t';
    expect(bbcodeToText(xml)).toBe('Before:\n```\nfunc f():\n\tpass\n```\nAfter.');
    const multi = '[codeblocks][gdscript]var a = 1[/gdscript][csharp]int a = 1;[/csharp][/codeblocks]';
    expect(bbcodeToText(multi)).toBe('```\nvar a = 1\n```');
  });

  it('strips unknown tags and resolves escaped brackets', () => {
    const out = bbcodeToText('[center]x[/center] [kbd]Ctrl[/kbd] array[lb]0[rb] [color=red]y[/color]');
    expect(out).toBe('x `Ctrl` array[0] y');
    expect(RAW_TAG_PATTERN.test(out)).toBe(false);
  });

  it('leaves no raw tags in a real description', () => {
    const out = bbcodeToText(
      'The [Timer] node ends at [member wait_time], emits [signal timeout]. [b]Note:[/b] see [member Engine.time_scale] and [code]$Timer.timeout.emit()[/code].',
    );
    expect(RAW_TAG_PATTERN.test(out)).toBe(false);
    expect(out).not.toMatch(/\[[a-z]/);
  });
});

describe('helpers', () => {
  it('dedents by the common indentation', () => {
    expect(dedent('\n\t\ta\n\t\t\tb\n')).toBe('a\n\tb');
  });

  it('takes the first sentences and skips code and abbreviations', () => {
    expect(firstSentences('One, i.e. the first. Two uses `Engine.time_scale`. Three.', 2)).toBe(
      'One, i.e. the first. Two uses `Engine.time_scale`.',
    );
    expect(firstSentences('Intro:\n```\ncode. here\n```\nReal one. Two.', 1)).toBe('Real one.');
  });
});
