import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const pages = ['index.html','impressum.html','datenschutz.html'];
let refs = 0;
for (const page of pages) {
  const html = await fs.readFile(page, 'utf8');
  assert(html.includes('<html lang="de">'), `${page}: Sprache fehlt`);
  assert.equal((html.match(/<h1\b/g)||[]).length,1,`${page}: genau eine H1 erforderlich`);
  assert(html.includes('noindex, nofollow'), `${page}: Demo-Indexierung verhindern`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,`${page}: doppelte IDs`);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = match[1];
    if (/^(https?:|mailto:|tel:)/.test(url)) continue;
    const [file,hash] = url.split('#');
    const target = !file || file === '/' ? 'index.html' : file.slice(1);
    if (file && file !== '/') {
      await fs.access(pages.includes(target) ? target : `public/${target}`);
      refs++;
    }
    if (hash) {
      const destination = target === page ? html : await fs.readFile(target,'utf8');
      assert(destination.includes(`id="${hash}"`),`${page}: defektes Sprungziel ${url}`);
    }
  }
}
for (const name of await fs.readdir('public/images')) {
  const data = await fs.readFile(`public/images/${name}`);
  assert(data.length > 1000, `Bilddatei zu klein: ${name}`);
  assert(name.endsWith('.png') ? data.readUInt32BE(0) === 0x89504e47 : data[0] === 255 && data[1] === 216, `Ungültiges Bild: ${name}`);
}
console.log(`Prüfung erfolgreich: ${pages.length} Seiten, ${refs} lokale Verweise, Bilddateien und Sprungziele.`);
