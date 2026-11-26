import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Local dev mirror for Vercel Serverless API routes (/api/proxy and /api/sheets/sync) */
function nsoLocalApiPlugin(): Plugin {
  return {
    name: 'nso-local-api-middleware',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }
        try {
          const parsed = new URL(req.url || '', 'http://localhost');
          const targetUrl = parsed.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.end('Missing url');
            return;
          }
          const upstream = await fetch(targetUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },
          });
          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.end('Fetch failed');
            return;
          }
          const buf = Buffer.from(await upstream.arrayBuffer());
          res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.statusCode = 200;
          res.end(buf);
        } catch {
          res.statusCode = 500;
          res.end('Error fetching image');
        }
      });

      server.middlewares.use('/api/sheets/sync', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, message: 'Method not allowed' }));
          return;
        }
        const webhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
        const secret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
        res.setHeader('Content-Type', 'application/json');
        if (!webhook) {
          res.statusCode = 200;
          res.end(JSON.stringify({ ok: false, message: 'GOOGLE_SHEETS_WEBHOOK_URL is not configured.' }));
          return;
        }
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const upstream = await fetch(webhook, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ secret, payload }),
          });
          res.statusCode = upstream.ok ? 200 : 502;
          res.end(JSON.stringify({ ok: upstream.ok }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, message: err?.message || 'Sync error' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), nsoLocalApiPlugin()],
  resolve: {
    alias: {
      '@nso': path.resolve(__dirname, 'src/nso'),
    },
  },
});
