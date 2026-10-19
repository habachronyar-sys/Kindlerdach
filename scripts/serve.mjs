import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createReviewService, ReviewError } from '../server/google-reviews.mjs';
import { handleContactRequest } from '../server/intake.mjs';
import { publicConfig } from '../server/config.mjs';
const root = process.cwd();
try { process.loadEnvFile(path.join(root, '.env.local')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const reviewService = createReviewService();
const localRateLimits = new Map();
const localLimiter = {
  async limit({ key }) {
    const now = Date.now();
    const record = localRateLimits.get(key);
    if (!record || now - record.startedAt >= 60_000) {
      localRateLimits.set(key, { startedAt: now, count: 1 });
      return { success: true };
    }
    record.count += 1;
    return { success: record.count <= 5 };
  },
};
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};
async function sendApiResponse(res, response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
  res.writeHead(response.status, Object.fromEntries(headers));
  res.end(await response.text());
}
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const server = http.createServer(async (req,res) => {
  try {
    const requestUrl = new URL(req.url,'http://localhost');
    const pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === '/api/config') {
      if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(); return; }
      await sendApiResponse(res, new Response(JSON.stringify(publicConfig(process.env)), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }));
      return;
    }
    if (pathname === '/api/contact') {
      const headers = new Headers(req.headers);
      headers.set('host', requestUrl.host);
      headers.set('cf-connecting-ip', req.socket.remoteAddress || '127.0.0.1');
      const request = new Request(new URL(req.url, `http://${req.headers.host || 'localhost:4173'}`), {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
        duplex: 'half',
      });
      const response = await handleContactRequest(request, process.env, localLimiter);
      await sendApiResponse(res, new Response(await response.text(), { status: response.status, headers: response.headers }));
      return;
    }
    if (pathname === '/api/reviews') {
      if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(); return; }
      try {
        const data = await reviewService.getReviews();
        res.writeHead(200, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(data));
      } catch (error) {
        const code = error instanceof ReviewError ? error.code : 'GOOGLE_UNAVAILABLE';
        res.writeHead(503, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ code }));
      }
      return;
    }
    if (pathname === '/admin' || pathname === '/admin/') requestUrl.pathname = '/admin.html';
    if (pathname === '/admin/login' || pathname === '/admin/login/') requestUrl.pathname = '/admin-login.html';
    if (pathname === '/admin/forgot-password' || pathname === '/admin/forgot-password/') requestUrl.pathname = '/admin-forgot-password.html';
    if (pathname === '/admin/reset-password' || pathname === '/admin/reset-password/') requestUrl.pathname = '/admin-reset-password.html';
    const relative = requestUrl.pathname === '/' ? 'index.html' : requestUrl.pathname.slice(1);
    // Serve only the explicitly public files; research and source stay private.
    const isPage = ['index.html','impressum.html','datenschutz.html','cookie-einstellungen.html','admin.html','admin-login.html','admin-forgot-password.html','admin-reset-password.html'].includes(relative);
    const base = isPage ? root : path.join(root,'public');
    const adminBundle = ['admin.js', 'password.js'].includes(relative);
    const targetBase = adminBundle ? path.join(root,'dist') : base;
    const target = path.resolve(path.join(targetBase, relative));
    if (!target.startsWith(targetBase + path.sep) || relative.includes('\\') || relative.split('/').some(part => part.startsWith('.'))) {res.writeHead(403);res.end('Forbidden');return;}
    const body = await fs.readFile(target);
    const privateHeaders = isPage && relative.startsWith('admin') ? { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } : {};
    res.writeHead(200, {...securityHeaders,...privateHeaders,'Content-Type':types[path.extname(target)] || 'application/octet-stream'});
    res.end(body);
  } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Seite nicht gefunden.');}
});
const port = Number(process.env.PORT || 4173);
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} ist belegt. Beenden Sie den alten Vorschau-Server oder setzen Sie PORT auf einen freien Port.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Kindler Dach: http://localhost:${port}`);
  console.log(`Admin-Login: http://localhost:${port}/admin/login`);
  if (!publicConfig(process.env).configured || !/^[a-f0-9]{64,}$/.test(process.env.SUPABASE_INTAKE_TOKEN || '')) {
    console.warn('Supabase ist nicht vollständig konfiguriert. Kontaktanfragen werden nicht gespeichert. Anleitung: SUPABASE_SETUP.md; Diagnose: npm.cmd run diagnose');
  }
});
