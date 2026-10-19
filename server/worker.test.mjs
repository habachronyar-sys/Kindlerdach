import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../worker/index.mjs';
import { publicConfig } from './config.mjs';

test('runtime configuration rejects malformed URLs and never exposes intake secrets', () => {
  for (const url of ['http://project.supabase.co', 'https://user:password@project.supabase.co', 'https://project.supabase.co/rest/v1', 'broken']) {
    assert.equal(publicConfig({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }).configured, false);
  }
  const config = publicConfig({ SUPABASE_URL: 'https://project.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_INTAKE_TOKEN: 'secret' });
  assert.deepEqual(config, { configured: true, url: 'https://project.supabase.co', publishableKey: 'sb_publishable_test' });
});

test('worker serves both canonical admin routes and their trailing slash forms', async () => {
  for (const [route, asset] of [['/', '/index.html'], ['/admin', '/admin.html'], ['/admin/', '/admin.html'], ['/admin/login', '/admin-login.html'], ['/admin/login/', '/admin-login.html'], ['/admin/forgot-password', '/admin-forgot-password.html'], ['/admin/forgot-password/', '/admin-forgot-password.html'], ['/admin/reset-password', '/admin-reset-password.html'], ['/admin/reset-password/', '/admin-reset-password.html']]) {
    const response = await worker.fetch(new Request(`https://site.example${route}`), {
      ASSETS: { fetch: async request => {
        assert.equal(new URL(request.url).pathname, asset);
        return new Response('Admin shell');
      } },
    });
    assert.equal(response.status, 200);
    assert(response.headers.has('content-security-policy'));
    if (route.startsWith('/admin')) {
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    }
  }
});

test('worker exposes only public config and rejects config writes', async () => {
  const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_INTAKE_TOKEN: 'secret' };
  const response = await worker.fetch(new Request('https://site.example/api/config'), env);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), publicConfig(env));
  assert.equal((await worker.fetch(new Request('https://site.example/api/config', { method: 'POST' }), env)).status, 405);
});
