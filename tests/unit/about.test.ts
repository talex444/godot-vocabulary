import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
import { ATTRIBUTIONS } from '../../src/ui/screens/about';

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

  it('names every runtime dependency, as THIRD_PARTY_NOTICES.md does', () => {
    const notices = readFileSync(new URL('../../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
    for (const name of Object.keys(pkg.dependencies)) {
      expect(text).toContain(name);
      expect(notices).toContain(name);
    }
  });
});
