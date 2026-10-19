import fs from 'node:fs/promises';
await fs.mkdir('dist', {recursive:true});
for (const file of ['index.html','impressum.html','datenschutz.html']) await fs.copyFile(file, `dist/${file}`);
await fs.cp('public','dist',{recursive:true});
console.log('Build erfolgreich: dist/ (statische Website, keine Abhängigkeiten).');
