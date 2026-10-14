import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
import { ATTRIBUTIONS, MIT_PERMISSION } from '../../src/ui/screens/about';

const text = ATTRIBUTIONS.flat().join('\n');

describe('About screen attributions', () => {
  it('carries the licence lines CLAUDE.md requires', () => {
    for (const line of [
      'Copyright (c) 2014-present Godot Engine contributors',
      'Juan Linietsky, Ariel Manzur and the Godot community',
      'CC BY 3.0',
      'GitHub Docs glossary, CC BY 4.0',
      'Inter, SIL Open Font License 1.1',
      'JetBrains Mono, SIL Open Font License 1.1',
    ]) {
      expect(text).toContain(line);
    }
  });

  it('copies the GitHub notices character for character from their licence files, which ship with the app', () => {
    const rows: [work: RegExp, file: string][] = [
      [/^GitHub Desktop/, 'LICENSE-github-desktop.txt'],
      [/^Primer CSS/, 'LICENSE-primer-css.txt'],
      [/^Octicons/, 'LICENSE-octicons.txt'],
    ];
    for (const [work, file] of rows) {
      const source = readFileSync(new URL(`../../public/licenses/${file}`, import.meta.url), 'utf8');
      const copyright = source.split(/\r?\n/).find((line) => line.startsWith('Copyright'))!;
      const notice = ATTRIBUTIONS.find(([w]) => work.test(w))?.[1];
      expect(notice, file).toBe(copyright);
    }
  });

  it('shows the MIT permission notice once, word for word as in each MIT licence file', () => {
    const words = (s: string) => s.replace(/\s+/g, ' ').trim();
    const shown = words(MIT_PERMISSION.join(' '));
    for (const file of ['LICENSE-github-desktop.txt', 'LICENSE-primer-css.txt', 'LICENSE-octicons.txt']) {
      const source = readFileSync(new URL(`../../public/licenses/${file}`, import.meta.url), 'utf8');
      expect(words(source.slice(source.indexOf('Permission is hereby granted'))), file).toBe(shown);
    }
  });

  it('names every runtime dependency, as THIRD_PARTY_NOTICES.md does', () => {
    const notices = readFileSync(new URL('../../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
    for (const name of Object.keys(pkg.dependencies)) {
      expect(text).toContain(name);
      expect(notices).toContain(name);
    }
  });
});
