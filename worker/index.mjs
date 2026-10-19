import { handleContactRequest } from '../server/intake.mjs';
import { publicConfig } from '../server/config.mjs';

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function withSecurityHeaders(response, privatePage = false) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
  if (privatePage) {
    headers.set('Cache-Control', 'no-store');
    headers.set('Referrer-Policy', 'no-referrer');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') {
      const response = await handleContactRequest(request, env, env.INTAKE_LIMITER);
      return withSecurityHeaders(response);
    }
    if (url.pathname === '/api/config') {
      if (request.method !== 'GET') {
        return withSecurityHeaders(new Response(null, { status: 405, headers: { Allow: 'GET' } }));
      }
      return withSecurityHeaders(new Response(JSON.stringify(publicConfig(env)), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }));
    }
    if (url.pathname === '/') url.pathname = '/index.html';
    else if (url.pathname === '/admin' || url.pathname === '/admin/') url.pathname = '/admin.html';
    else if (url.pathname === '/admin/login' || url.pathname === '/admin/login/') url.pathname = '/admin-login.html';
    else if (url.pathname === '/admin/forgot-password' || url.pathname === '/admin/forgot-password/') url.pathname = '/admin-forgot-password.html';
    else if (url.pathname === '/admin/reset-password' || url.pathname === '/admin/reset-password/') url.pathname = '/admin-reset-password.html';

    return withSecurityHeaders(await env.ASSETS.fetch(new Request(url, request)), url.pathname.startsWith('/admin'));
  },
};
