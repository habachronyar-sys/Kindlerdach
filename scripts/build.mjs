import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
if (path.dirname(output) !== path.resolve(root)) throw new Error('Invalid build directory');
await fs.rm(output, {recursive:true, force:true});
await fs.mkdir(output, {recursive:true});
let pages = '';
for (const file of ['index.html','impressum.html','datenschutz.html','cookie-einstellungen.html']) {
  const html = (await fs.readFile(path.join(root, file), 'utf8')).replace('<html lang="de">', '<html lang="de" data-reviews-api="disabled">');
  pages += html;
  await fs.writeFile(path.join(output, file), html);
}
await fs.cp(path.join(root, 'public'), output, {
  recursive:true,
  // Keep full-size originals used by the lightbox, but do not ship unused JPEGs.
  filter: source => !source.endsWith('.jpg') || pages.includes(`/images/${path.basename(source)}`),
});
await build({
  absWorkingDir: root,
  // No TypeScript configuration is needed; avoid searching parent directories.
  tsconfigRaw: {},
  entryPoints: {
    admin: path.join(root, 'admin/admin.js'),
    password: path.join(root, 'admin/password.js'),
  },
  outdir: output,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  legalComments: 'none',
});
await fs.copyFile(path.join(root, 'admin.html'), path.join(output, 'admin.html'));
await fs.copyFile(path.join(root, 'admin-login.html'), path.join(output, 'admin-login.html'));
await fs.copyFile(path.join(root, 'admin-forgot-password.html'), path.join(output, 'admin-forgot-password.html'));
await fs.copyFile(path.join(root, 'admin-reset-password.html'), path.join(output, 'admin-reset-password.html'));
console.log('Build erfolgreich: dist/ (statische Website und gebündeltes Admin-Frontend).');
