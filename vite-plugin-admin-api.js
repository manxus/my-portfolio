import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

const require = createRequire(import.meta.url);

const TOKEN_SECRET = 'bv-admin-' + Date.now();
const TOKEN_TTL = 1000 * 60 * 60 * 8; // 8 hours

function makeToken(username) {
  const ts = Date.now();
  const sig = createHmac('sha256', TOKEN_SECRET)
    .update(`${username}:${ts}`)
    .digest('hex');
  return `${ts}:${sig}`;
}

function verifyToken(token) {
  if (!token) return false;
  const [tsStr, sig] = token.split(':');
  const ts = Number(tsStr);
  if (Date.now() - ts > TOKEN_TTL) return false;

  const adminUser = process.env.ADMIN_USER || 'admin';
  const expected = createHmac('sha256', TOKEN_SECRET)
    .update(`${adminUser}:${ts}`)
    .digest('hex');
  return sig === expected;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const ALLOWED_FILES = new Set([
  'qaPortfolio', 'resume', 'tech', 'steam-reviews', 'references',
  'changelog', 'steam-tierlist', 'menu', 'steam-overrides',
  'media', 'livestream', 'music', 'books', 'tabletop', 'travel', 'credits', 'patchNotes', 'steam-hallofpain',
  'cinema', 'runescape',
]);

async function handleTwitchOembed(req, res) {
  const requestUrl = new URL(req.url, 'http://localhost');
  const pageUrl = requestUrl.searchParams.get('url');

  if (!pageUrl) {
    return json(res, 400, { error: 'Missing url parameter' });
  }

  try {
    const handler = require('./api/twitch-oembed.cjs');
    await handler(req, res);
  } catch (err) {
    console.error('[twitch-oembed dev]', err);
    return json(res, 502, { error: 'Failed to fetch Twitch oEmbed' });
  }
}

async function handleGeocode(req, res) {
  try {
    const geocodePath = resolve(process.cwd(), 'api/geocode.cjs');
    delete require.cache[geocodePath];
    const handler = require('./api/geocode.cjs');
    await handler(req, res);
  } catch (err) {
    console.error('[geocode dev]', err);
    return json(res, 502, { error: 'Failed to search locations' });
  }
}

async function handleTmdb(req, res) {
  try {
    const tmdbPath = resolve(process.cwd(), 'api/tmdb.cjs');
    delete require.cache[tmdbPath];
    const handler = require('./api/tmdb.cjs');
    await handler(req, res);
  } catch (err) {
    console.error('[tmdb dev]', err);
    return json(res, 502, { error: 'Failed to reach TMDB' });
  }
}

export default function adminApiPlugin() {
  return {
    name: 'admin-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/twitch-oembed') || req.method !== 'GET') return next();
        return handleTwitchOembed(req, res);
      });

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/geocode') || req.method !== 'GET') return next();
        return handleGeocode(req, res);
      });

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/tmdb') || req.method !== 'GET') return next();
        return handleTmdb(req, res);
      });

      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/admin')) return next();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          return res.end();
        }

        try {
          if (req.url === '/api/admin/login' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req));
            const adminUser = process.env.ADMIN_USER || 'admin';
            const adminPass = process.env.ADMIN_PASS || 'admin';

            if (body.username === adminUser && body.password === adminPass) {
              return json(res, 200, { token: makeToken(body.username) });
            }
            return json(res, 401, { error: 'Invalid credentials' });
          }

          if (req.url === '/api/admin/verify' && req.method === 'GET') {
            const token = req.headers.authorization?.replace('Bearer ', '');
            return json(res, 200, { valid: verifyToken(token) });
          }

          if (req.url === '/api/admin/upload' && req.method === 'POST') {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!verifyToken(token)) {
              return json(res, 401, { error: 'Unauthorized' });
            }

            const body = JSON.parse(await readBody(req));
            const rawName = typeof body.filename === 'string' ? body.filename : '';
            const safeName = basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '-');
            const ext = extname(safeName).toLowerCase();
            const allowedExt = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif']);
            if (!safeName || !allowedExt.has(ext)) {
              return json(res, 400, { error: 'Invalid file type' });
            }
            if (typeof body.data !== 'string' || !body.data) {
              return json(res, 400, { error: 'Missing file data' });
            }

            const uploadsDir = resolve(process.cwd(), 'public/uploads');
            await mkdir(uploadsDir, { recursive: true });
            const filePath = resolve(uploadsDir, safeName);
            await writeFile(filePath, Buffer.from(body.data, 'base64'));
            return json(res, 200, { url: `/uploads/${safeName}` });
          }

          const dataMatch = req.url.match(/^\/api\/admin\/data\/([a-zA-Z0-9_-]+)$/);
          if (dataMatch) {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!verifyToken(token)) {
              return json(res, 401, { error: 'Unauthorized' });
            }

            const filename = dataMatch[1];
            if (!ALLOWED_FILES.has(filename)) {
              return json(res, 400, { error: 'File not allowed' });
            }

            const dataDir = resolve(process.cwd(), 'src/data');
            const filePath = resolve(dataDir, `${filename}.json`);

            if (req.method === 'GET') {
              const content = await readFile(filePath, 'utf-8');
              return json(res, 200, JSON.parse(content));
            }

            if (req.method === 'PUT') {
              const body = JSON.parse(await readBody(req));
              await writeFile(filePath, JSON.stringify(body, null, 2) + '\n', 'utf-8');
              return json(res, 200, { success: true });
            }
          }

          return json(res, 404, { error: 'Not found' });
        } catch (err) {
          console.error('[admin-api]', err);
          return json(res, 500, { error: 'Internal server error' });
        }
      });
    },
  };
}
