import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleContactRequest, validateContactPayload } from './intake.mjs';

const valid = {
  name: 'Musterperson',
  email: '',
  phone: '0203 123456',
  service: 'Allgemeine Anfrage',
  message: 'Bitte rufen Sie mich zu meinem Dachvorhaben zurück.',
};

test('contact payload requires safe, bounded fields and one contact method', () => {
  assert.equal(validateContactPayload(valid).value.name, 'Musterperson');
  assert.match(validateContactPayload({ ...valid, email: 'ungueltig' }).error, /E-Mail-Adresse/);
  assert.match(validateContactPayload({ ...valid, phone: '', email: '' }).error, /Telefonnummer/);
  assert.match(validateContactPayload({ ...valid, service: 'Unbekannt' }).error, /Art der Anfrage/);
  assert.match(validateContactPayload({ ...valid, message: 'kurz' }).error, /10/);
  assert.match(validateContactPayload({ ...valid, website: 'Spam' }).error, /verarbeitet/);
});

test('contact endpoint refuses cross-origin requests without touching Supabase', async () => {
  const request = new Request('https://site.example/api/contact', {
    method: 'POST',
    headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
    body: JSON.stringify(valid),
  });
  const response = await handleContactRequest(request, {}, { limit: async () => ({ success: true }) });
  assert.equal(response.status, 403);
});

test('contact endpoint reports an unset backend rather than a fake success', async () => {
  const request = new Request('https://site.example/api/contact', {
    method: 'POST',
    headers: { origin: 'https://site.example', 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.2' },
    body: JSON.stringify(valid),
  });
  const response = await handleContactRequest(request, {}, { limit: async () => ({ success: true }) });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, undefined);
});

test('contact endpoint inserts only validated fields through the protected RPC', async t => {
  const originalFetch = globalThis.fetch;
  let calledUrl;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    calledUrl = url;
    requestBody = JSON.parse(options.body);
    return new Response(null, { status: 204 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const request = new Request('https://site.example/api/contact', {
    method: 'POST',
    headers: { origin: 'https://site.example', 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.2' },
    body: JSON.stringify({ ...valid, status: 'done', id: 'forged' }),
  });
  const env = {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_INTAKE_TOKEN: 'a'.repeat(64),
  };
  const response = await handleContactRequest(request, env, { limit: async () => ({ success: true }) });
  assert.equal(response.status, 201);
  assert.equal(calledUrl, 'https://project.supabase.co/rest/v1/rpc/submit_contact_request');
  assert.deepEqual(Object.keys(requestBody).sort(), ['p_email', 'p_intake_token', 'p_message', 'p_name', 'p_phone', 'p_subject']);
});

test('contact endpoint rejects rate-limited requests', async () => {
  const request = new Request('https://site.example/api/contact', {
    method: 'POST',
    headers: { origin: 'https://site.example', 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.2' },
    body: JSON.stringify(valid),
  });
  const response = await handleContactRequest(request, {}, { limit: async () => ({ success: false }) });
  assert.equal(response.status, 429);
});

test('contact endpoint bounds request bodies before parsing them', async () => {
  const request = new Request('https://site.example/api/contact', {
    method: 'POST',
    headers: { origin: 'https://site.example', 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.2' },
    body: 'x'.repeat(8193),
  });
  const response = await handleContactRequest(request, {}, { limit: async () => ({ success: true }) });
  assert.equal(response.status, 413);
});

test('contact endpoint requires JSON content', async () => {
  const request = new Request('https://site.example/api/contact', {
    method: 'POST',
    headers: { origin: 'https://site.example', 'content-type': 'text/plain', 'cf-connecting-ip': '192.0.2.2' },
    body: 'name=Test',
  });
  const response = await handleContactRequest(request, {}, { limit: async () => ({ success: true }) });
  assert.equal(response.status, 415);
});

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_INTAKE_TOKEN: 'a'.repeat(64),
};
function contactRequest() {
  return new Request('https://site.example/api/contact', {
    method: 'POST',
    headers: { origin: 'https://site.example', 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.2' },
    body: JSON.stringify(valid),
  });
}
const limiter = { limit: async () => ({ success: true }) };

test('database rejection and network failures never become a success', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  for (const status of [401, 403, 404, 500]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ code: '42501' }), { status });
    const response = await handleContactRequest(contactRequest(), env, limiter);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).ok, undefined);
  }
  globalThis.fetch = async () => { throw new TypeError('Network failure'); };
  assert.equal((await handleContactRequest(contactRequest(), env, limiter)).status, 503);
});

test('a successful HTTP response must also match the void RPC confirmation', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response('<html>not a database</html>');
  assert.equal((await handleContactRequest(contactRequest(), env, limiter)).status, 503);
  globalThis.fetch = async () => new Response('null', { status: 200 });
  assert.equal((await handleContactRequest(contactRequest(), env, limiter)).status, 201);
});

test('rate limiter outage fails closed with a service error', async () => {
  const response = await handleContactRequest(contactRequest(), env, { limit: async () => { throw Error('Unavailable'); } });
  assert.equal(response.status, 503);
});
