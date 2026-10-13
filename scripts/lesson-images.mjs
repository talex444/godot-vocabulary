// Copies every picture the course files name from the manual's own img/ folder (data/sources, fetched
// by `pnpm fetch-sources`) to public/courses/img, where the lesson screen loads them. Run by `pnpm generate`.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadCourses } from './check-lessons.mjs';
import { isMain, ROOT } from './lib/io.mjs';

export function copyLessonImages() {
  const from = join(ROOT, 'data/sources/godot-docs/img');
  const to = join(ROOT, 'public/courses/img');
  mkdirSync(to, { recursive: true });
  const names = new Set();
  const collect = (v) => {
    if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') {
      if (typeof v.src === 'string' && typeof v.alt === 'string') names.add(v.src);
      Object.values(v).forEach(collect);
    }
  };
  loadCourses().forEach(collect);
  const missing = [];
  for (const name of [...names].sort()) {
    if (existsSync(join(from, name))) copyFileSync(join(from, name), join(to, name));
    else missing.push(name);
  }
  console.log(`lesson images: ${names.size - missing.length} copied${missing.length ? `, missing in data/sources: ${missing.join(', ')}` : ''}`);
}

if (isMain(import.meta.url)) copyLessonImages();
