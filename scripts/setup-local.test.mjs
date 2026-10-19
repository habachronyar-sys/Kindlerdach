import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { prepareLocalSetup, tokenSql } from './supabase-setup.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kindler-setup-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.cp(new URL('../supabase', import.meta.url), path.join(root, 'supabase'), {
    recursive: true, filter: source => !String(source).endsWith('.local.sql'),
  });
  return root;
}

test('setup preserves existing configuration byte-for-byte across repeated runs', async t => {
  const root = await fixture(t);
  const original = `# Existing settings\r\nSUPABASE_URL=https://example.supabase.co\r\nSUPABASE_PUBLISHABLE_KEY=sb_publishable_test\r\nSUPABASE_INTAKE_TOKEN=${'ab'.repeat(32)}\r\nGOOGLE_CLIENT_ID=keep-me\r\n`;
  await fs.writeFile(path.join(root, '.env.local'), original);
  assert.equal((await prepareLocalSetup(root)).created, false);
  const first = await fs.readFile(path.join(root, 'supabase/SETUP.local.sql'), 'utf8');
  await prepareLocalSetup(root);
  assert.equal(await fs.readFile(path.join(root, '.env.local'), 'utf8'), original);
  assert.equal(await fs.readFile(path.join(root, 'supabase/SETUP.local.sql'), 'utf8'), first);
  assert(!first.includes('sb_publishable_test'));
  assert(!first.includes('ab'.repeat(32)));
});

test('new setup generates one stable secret and uses SHA-256 of its UTF-8 text', async t => {
  const root = await fixture(t);
  assert.equal((await prepareLocalSetup(root)).created, true);
  const content = await fs.readFile(path.join(root, '.env.local'), 'utf8');
  const env = parseEnv(content);
  assert.match(env.SUPABASE_INTAKE_TOKEN, /^[a-f0-9]{64}$/);
  assert.equal(env.SUPABASE_PUBLISHABLE_KEY, '');
  const sql = await fs.readFile(path.join(root, 'supabase/TOKEN.local.sql'), 'utf8');
  assert(sql.includes(createHash('sha256').update(env.SUPABASE_INTAKE_TOKEN, 'utf8').digest('hex')));
  assert(!sql.includes(env.SUPABASE_INTAKE_TOKEN));
  assert(!/do update/i.test(sql), 'must not rotate an existing token');
  await prepareLocalSetup(root);
  assert.equal(await fs.readFile(path.join(root, '.env.local'), 'utf8'), content);
});

test('invalid existing token fails without replacing user configuration', async t => {
  const root = await fixture(t);
  const original = 'SUPABASE_INTAKE_TOKEN=not-a-valid-token\n';
  await fs.writeFile(path.join(root, '.env.local'), original);
  await assert.rejects(prepareLocalSetup(root));
  assert.equal(await fs.readFile(path.join(root, '.env.local'), 'utf8'), original);
  await assert.rejects(fs.access(path.join(root, 'supabase/SETUP.local.sql')));
  assert.throws(() => tokenSql("'SQL injection"));
});

test('full setup is one transaction with preflight before any schema change', async t => {
  const root = await fixture(t);
  await prepareLocalSetup(root);
  const sql = await fs.readFile(path.join(root, 'supabase/SETUP.local.sql'), 'utf8');
  assert.equal((sql.match(/^begin;$/gm) || []).length, 1);
  assert.equal((sql.match(/^commit;$/gm) || []).length, 1);
  assert(sql.indexOf('Existing objects detected') < sql.indexOf('create extension'));
  for (const name of ['public.contact_requests', 'public.authorized_admins', 'private.contact_intake_tokens', 'public.submit_contact_request', 'authorized_admins_single_administrator']) assert(sql.includes(name));
  assert(!/\b(delete from|truncate|drop table|drop schema)\b/i.test(sql));
});
