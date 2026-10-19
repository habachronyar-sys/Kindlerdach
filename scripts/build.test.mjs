import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

before(async () => {
  await fs.mkdir('dist', {recursive:true});
  await fs.writeFile('dist/obsolete-build-file.txt', 'Must not survive a new build');
  execFileSync(process.execPath, ['scripts/build.mjs']);
});

test('new static builds remove stale output and exclude project files', async () => {
  for (const name of ['obsolete-build-file.txt', 'research', 'server', 'node_modules', '.env.local', 'package.json', 'images/dach-detail.jpg']) {
    await assert.rejects(fs.access(`dist/${name}`), {code:'ENOENT'});
  }
  // The lightbox retains the real, full-size originals it still uses.
  for (const name of ['steildach.jpg', 'dachfenster.jpg', 'schiefer.jpg']) await fs.access(`dist/images/${name}`);
});

test('static hosting disables the unavailable API while source retains server support', async () => {
  assert((await fs.readFile('dist/index.html', 'utf8')).includes('data-reviews-api="disabled"'));
  assert(!(await fs.readFile('index.html', 'utf8')).includes('data-reviews-api="disabled"'));
});

test('every local page, image, responsive candidate and preload exists in the static output', async () => {
  for (const name of ['index.html', 'impressum.html', 'datenschutz.html', 'cookie-einstellungen.html']) {
    const html = await fs.readFile(`dist/${name}`, 'utf8');
    for (const match of html.matchAll(/\b(?:src|href|data-image)="(\/[^"#]*)"/g)) {
      if (match[1] === '/' || match[1].includes('#')) continue;
      await fs.access(`dist${match[1]}`);
    }
    for (const match of html.matchAll(/\b(?:image)?srcset="([^"]+)"/g)) {
      for (const candidate of match[1].split(',')) await fs.access(`dist${candidate.trim().split(/\s+/)[0]}`);
    }
  }
});
