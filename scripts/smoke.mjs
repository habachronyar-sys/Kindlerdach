import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin = 'http://127.0.0.1:4173';
const urls = new Set(['/','/impressum.html','/datenschutz.html']);
for (const file of ['index.html','impressum.html','datenschutz.html']) {
  const html = await fs.readFile(file, 'utf8');
  for (const m of html.matchAll(/(?:src|href)="(\/[^"#]*)"/g)) if (!m[1].includes('#')) urls.add(m[1]);
}
for (const url of urls) {
  const response = await fetch(origin + url);
  assert.equal(response.status,200,`${url}: HTTP-Fehler`);
  assert(response.headers.get('content-security-policy')?.includes("connect-src 'self'"));
  assert((await response.arrayBuffer()).byteLength > 0,`${url}: leere Datei`);
}
for (const url of ['/research/original.html','/package.json','/.git/config','/.env.local','/server/google-reviews.mjs','/fehlt.html']) {
  const response = await fetch(origin+url);
  assert([403,404].includes(response.status),`${url}: interne Datei öffentlich`);
}
console.log(`HTTP-Prüfung erfolgreich: ${urls.size} Seiten/Assets erreichbar; interne Dateien gesperrt.`);
