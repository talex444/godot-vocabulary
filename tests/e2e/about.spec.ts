import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { gotoStart, open } from './helpers';

// Done-criteria 22: what the app is, the unofficial statement, every attribution line from
// THIRD_PARTY_NOTICES.md, and the repository link.

/** The copyright/attribution part of every Notice cell in the notices tables (URLs and asides cut). */
function noticeLines(): string[] {
  return readFileSync('THIRD_PARTY_NOTICES.md', 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').map((cell) => cell.trim()).filter(Boolean).at(-1)!)
    .filter((cell) => cell !== 'Notice' && !/^-+$/.test(cell))
    .map((cell) => cell.split(/ \(?https:\/\/| — /)[0]!.replace(/\.$/, ''));
}

test('About carries every attribution, the unofficial statement and the repository link', async ({ page }) => {
  await gotoStart(page);
  await open(page, 'About');
  const text = (await page.locator('#screen').innerText()).replace(/\s+/g, ' ');

  const lines = noticeLines();
  expect(lines.length).toBeGreaterThanOrEqual(9);
  for (const line of lines) expect(text, `missing notice: ${line}`).toContain(line);
  for (const licence of ['MIT', 'CC BY 3.0', 'CC BY 4.0', 'SIL Open Font License 1.1', 'ISC']) expect(text).toContain(licence);
  expect(text).toContain('https://creativecommons.org/licenses/by/3.0/');
  expect(text).toContain('https://creativecommons.org/licenses/by/4.0/');

  expect(text).toMatch(/unofficial community project/i);
  expect(text).toMatch(/Not affiliated with or endorsed by the Godot Foundation or GitHub/);
  expect(text).toContain('The Godot logo is not used');

  // Done-criteria 72: the MIT permission notice in full, once; the GitHub glossary's pinned source.
  expect(text).toContain('Permission is hereby granted, free of charge');
  expect(text.split('Permission is hereby granted').length - 1).toBe(1);
  expect(text).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
  expect(text).toContain('Copyright (c) 2026 GitHub Inc.');
  expect(text).toContain('https://github.com/github/docs/blob/ae648a1d/data/glossaries/external.yml');
  expect(text).toContain('Provided as-is, no warranties.');

  const link = page.getByRole('link', { name: 'Source code on GitHub' });
  await expect(link).toHaveAttribute('href', 'https://github.com/talex444/godot-vocabulary');
  // Decision 54: the per-area disclosure, and the report it names.
  expect(text).toContain('Inside an area the tool’s colours win over WCAG contrast, text and controls alike');
  expect(text).toContain('The home page and navigation meet WCAG 2.2 AA.');
  await expect(page.getByRole('link', { name: 'Contrast report' })).toHaveAttribute('href', 'https://github.com/talex444/godot-vocabulary/blob/main/docs/contrast-report.md');

  // Done-criteria 44: the Releases page, opened outside the app; the app itself makes no request.
  const updates = page.getByRole('link', { name: 'Check for updates' });
  await expect(updates).toHaveAttribute('href', 'https://github.com/talex444/godot-vocabulary/releases');
  await expect(updates).toHaveAttribute('target', '_blank');
});
