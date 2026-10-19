// Control-flow tests with SDK/DOM doubles; no real email or credential changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = (await fs.readFile(new URL('./password.js', import.meta.url), 'utf8'))
  .replace("import { createClient } from '@supabase/supabase-js';", '')
  .replace(/initialize\(\);\s*$/, 'globalThis.ready = initialize();');
const recoveryHash = '#type=recovery&access_token=mock-access&refresh_token=mock-refresh';

async function setup({ page = 'forgot-password', hash = '', configured = true, session = { user: { id: 'owner' } }, authorized = true, resetError = null, updateError = null, updateUser = { id: 'owner' }, signOutThrows = false } = {}) {
  const calls = { emails: [], updates: [], signOuts: 0, clients: [], history: [] };
  const button = { disabled: true };
  const status = { textContent: '', dataset: {} };
  const form = {
    hidden: page === 'reset-password',
    elements: {
      email: { value: 'owner@example.invalid' },
      password: { value: 'A-new-password-123' },
      confirmation: { value: 'A-new-password-123', focus() {} },
    },
    reportValidity: () => true,
    querySelector: () => button,
    addEventListener(name, callback) { this[name] = callback; },
    reset() { this.elements.password.value = this.elements.confirmation.value = ''; },
  };
  const anotherLink = { hidden: false };
  const client = {
    auth: {
      resetPasswordForEmail: async (...args) => { calls.emails.push(args); return { error: resetError }; },
      getSession: async () => ({ data: { session } }),
      getUser: async () => ({ data: { user: session?.user } }),
      updateUser: async value => { calls.updates.push(value); return { data: { user: updateUser }, error: updateError }; },
      signOut: async () => { calls.signOuts++; if (signOutThrows) throw Error('Unavailable'); return {}; },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: authorized ? { user_id: 'owner' } : null }) }) }) }),
  };
  const context = vm.createContext({
    document: {
      body: { dataset: { page } },
      querySelector: selector => selector === '#password-status' ? status : selector === '#request-another-link' ? anotherLink : form,
    },
    location: { hash, origin: 'https://site.example', pathname: `/admin/${page}` },
    history: { replaceState: (...args) => calls.history.push(args) },
    fetch: async () => ({ ok: true, json: async () => ({ configured, url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' }) }),
    createClient: (...args) => { calls.clients.push(args); return client; },
    URLSearchParams, AbortSignal, TextEncoder,
  });
  vm.runInContext(source, context);
  await context.ready;
  return { calls, form, button, status, anotherLink, submit: () => form.submit({ preventDefault() {} }) };
}

test('forgot-password requests a same-origin reset link with no registration', async () => {
  const ui = await setup();
  await ui.submit();
  assert.equal(ui.calls.emails.length, 1);
  assert.equal(ui.calls.emails[0][0], 'owner@example.invalid');
  assert.equal(ui.calls.emails[0][1].redirectTo, 'https://site.example/admin/reset-password');
  assert.match(ui.status.textContent, /Wenn für diese Adresse ein Konto besteht/);
  assert.equal(ui.calls.updates.length, 0);
  assert.equal(ui.calls.clients[0][2].auth.persistSession, false);
});

test('mail delivery and rate-limit errors never display a success', async () => {
  for (const error of [{ code: 'email_address_not_authorized' }, { status: 429 }, { code: 'unexpected_failure' }]) {
    const ui = await setup({ resetError: error });
    await ui.submit();
    assert.equal(ui.status.dataset.kind, 'error');
    assert.equal(ui.button.disabled, false);
  }
});

test('missing configuration leaves reset requests disabled', async () => {
  const ui = await setup({ configured: false });
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.calls.emails.length, 0);
  assert.equal(ui.status.dataset.kind, 'error');
});

test('direct reset URL cannot reuse an existing dashboard session', async () => {
  const ui = await setup({ page: 'reset-password' });
  assert.equal(ui.form.hidden, true);
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.calls.clients.length, 0);
  assert.match(ui.status.textContent, /ungültig oder abgelaufen/);
});

test('expired link stays locked and its fragment is removed', async () => {
  const ui = await setup({ page: 'reset-password', hash: recoveryHash, session: null });
  assert.equal(ui.form.hidden, true);
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.calls.history.at(-1)[2], '/admin/reset-password');
});

test('an account without admin authorization cannot use the reset form', async () => {
  const ui = await setup({ page: 'reset-password', hash: recoveryHash, authorized: false });
  assert.equal(ui.form.hidden, true);
  assert.equal(ui.calls.signOuts, 1);
  assert.match(ui.status.textContent, /nicht.*freigeschaltet/);
});

test('password confirmation and minimum length are checked before updating', async () => {
  const ui = await setup({ page: 'reset-password', hash: recoveryHash });
  ui.form.elements.confirmation.value = 'different-password';
  await ui.submit();
  assert.equal(ui.calls.updates.length, 0);
  assert.match(ui.status.textContent, /stimmen nicht/);
  ui.form.elements.password.value = ui.form.elements.confirmation.value = 'short';
  await ui.submit();
  assert.equal(ui.calls.updates.length, 0);
});

test('confirmed password update clears inputs and locks the consumed form', async () => {
  const ui = await setup({ page: 'reset-password', hash: recoveryHash });
  assert.equal(ui.form.hidden, false);
  assert.equal(ui.calls.clients[0][2].auth.detectSessionInUrl, true);
  await ui.submit();
  assert.equal(ui.calls.updates[0].password, 'A-new-password-123');
  assert.equal(ui.calls.signOuts, 1);
  assert.equal(ui.form.elements.password.value, '');
  assert.equal(ui.form.hidden, true);
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.anotherLink.hidden, true);
  assert.equal(ui.status.dataset.kind, 'success');
  await ui.submit();
  assert.equal(ui.calls.updates.length, 1);
});

test('rejected password update shows failure and permits retry', async () => {
  const ui = await setup({ page: 'reset-password', hash: recoveryHash, updateError: { code: 'weak_password' } });
  await ui.submit();
  assert.equal(ui.status.dataset.kind, 'error');
  assert.equal(ui.form.hidden, false);
  assert.equal(ui.button.disabled, false);
});

test('sign-out outage does not conceal an already successful password change', async () => {
  const ui = await setup({ page: 'reset-password', hash: recoveryHash, signOutThrows: true });
  await ui.submit();
  assert.equal(ui.status.dataset.kind, 'success');
  assert.equal(ui.button.disabled, true);
});

test('a missing password-update confirmation cannot produce success', async () => {
  const ui = await setup({ page: 'reset-password', hash: recoveryHash, updateUser: null });
  await ui.submit();
  assert.equal(ui.status.dataset.kind, 'error');
  assert.match(ui.status.textContent, /nicht bestätigt/);
  assert.equal(ui.calls.signOuts, 0);
});
