import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createReviewService, ReviewError } from '../server/google-reviews.mjs';
const root = process.cwd();
try { process.loadEnvFile(path.join(root, '.env.local')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const reviewService = createReviewService();
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const server = http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (pathname === '/api/reviews') {
      if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(); return; }
      try {
        const data = await reviewService.getReviews();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify(data));
      } catch (error) {
        const code = error instanceof ReviewError ? error.code : 'GOOGLE_UNAVAILABLE';
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify({ code }));
      }
      return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    // Serve only the explicitly public files; research and source stay private.
    const isPage = ['index.html','impressum.html','datenschutz.html','cookie-einstellungen.html'].includes(relative);
    const base = isPage ? root : path.join(root,'public');
    const target = path.resolve(base, relative);
    if (!target.startsWith(base + path.sep) || relative.includes('\\') || relative.split('/').some(part => part.startsWith('.'))) {res.writeHead(403);res.end('Forbidden');return;}
    const body = await fs.readFile(target);
    res.writeHead(200, {'Content-Type':types[path.extname(target)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'"});
    res.end(body);
  } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Seite nicht gefunden.');}
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('Kindler Dach: http://localhost:4173'));
