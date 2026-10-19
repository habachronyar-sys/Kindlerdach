// UI control flow with a minimal DOM/SDK double; not a browser or RLS test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = (await fs.readFile(new URL('./admin.js', import.meta.url), 'utf8'))
  .replace("import { createClient } from '@supabase/supabase-js';", '')
  .replace(/initialize\(\);\s*$/, 'globalThis.ready = initialize();');

async function initialize({ page = 'dashboard', configured = true, session = null, authorized = false } = {}) {
  const elements = new Map();
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: true, disabled: true, dataset: {}, value: selector === '#status-filter' ? 'all' : '',
      textContent: '', listeners: {}, children: [],
      replaceChildren() { this.children = []; },
      append(child) { this.children.push(child); },
      close() {}, setAttribute() {}, removeAttribute() {},
      addEventListener(name, listener) { this.listeners[name] = listener; },
      querySelector: element,
    });
    return elements.get(selector);
  }
  let redirect;
  let signOuts = 0;
  let tableReads = 0;
  const client = {
    auth: {
      getSession: async () => ({ data: { session } }),
      getUser: async () => ({ data: { user: session?.user } }),
      signOut: async () => { signOuts++; return {}; },
      onAuthStateChange() {},
    },
    from(table) {
      if (table === 'authorized_admins') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: authorized ? { user_id: session.user.id } : null }) }) }) };
      tableReads++;
      return { select: () => ({ order: () => ({ order: () => ({ range: async () => ({ data: [] }) }) }) }) };
    },
  };
  const context = vm.createContext({
    document: { body: { dataset: { page } }, querySelector: element, querySelectorAll: selector => selector === '[data-admin-content]' ? [element('content')] : [] },
    window: { clearInterval() {}, setInterval() {} },
    location: { replace: url => { redirect = url; } },
    fetch: async () => ({ ok: true, json: async () => ({ configured, url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' }) }),
    createClient: () => client, AbortSignal, Intl, Date,
  });
  vm.runInContext(source, context);
  await context.ready;
  return { elements, redirect, signOuts, tableReads };
}

test('dashboard without a session redirects before querying customer records', async () => {
  const result = await initialize();
  assert.equal(result.redirect, '/admin/login');
  assert.equal(result.tableReads, 0);
  assert.equal(result.elements.get('content')?.hidden ?? true, true);
});

test('a session without database authorization cannot initialize the dashboard', async () => {
  const result = await initialize({ session: { user: { id: 'untrusted' } } });
  assert.equal(result.signOuts, 1);
  assert.equal(result.redirect, '/admin/login');
  assert.equal(result.tableReads, 0);
});

test('authorized dashboard loads the real query path and shows an empty state', async () => {
  const result = await initialize({ session: { user: { id: 'owner', email: 'owner@example.invalid' } }, authorized: true });
  assert.equal(result.redirect, undefined);
  assert.equal(result.tableReads, 1);
  assert.equal(result.elements.get('content').hidden, false);
  assert.match(result.elements.get('#requests-empty').textContent, /Keine passenden/);
});

test('login stays disabled and explains missing server configuration', async () => {
  const result = await initialize({ page: 'login', configured: false });
  assert.match(result.elements.get('#login-status').textContent, /noch nicht eingerichtet/);
  assert.equal(result.tableReads, 0);
});
