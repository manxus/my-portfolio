import { createHmac, timingSafeEqual } from 'node:crypto';
import { basename, extname } from 'node:path';

/**
 * The admin API, shared by the Vite dev middleware (vite-plugin-admin-api.js) and the Vercel
 * function (api/admin/[...path].js). Where the data lives and how a sync runs differ between the
 * two, so those come in as `storage` and `sync`; everything that decides who may do what lives here.
 *
 * Underscore-prefixed, so Vercel does not deploy this folder as functions of its own.
 */

const TOKEN_TTL = 1000 * 60 * 60 * 8; // 8 hours

export const ALLOWED_FILES = new Set([
  'qaPortfolio', 'resume', 'tech', 'steam-reviews', 'references',
  'changelog', 'steam-tierlist', 'menu', 'steam-overrides', 'steam-collections',
  'media', 'livestream', 'music', 'books', 'tabletop', 'travel', 'credits', 'steam-hallofpain',
  'cinema', 'runescape', 'tierlists',
  // Admin-only, and deliberately never imported by a page: keeping the
  // "not interested" list out of the bundle keeps it out of public view.
  'cinema-dismissed',
]);

/**
 * Games whose committed snapshot can be refreshed from the admin UI. Keys are the ids from
 * src/pages/games/registry.js; the browser sends one and it is looked up here.
 *
 * A fixed table rather than a derived path, for the same reason ALLOWED_FILES is one: the id
 * arrives over the wire and ends up in a spawn or a workflow dispatch, so it must only ever index
 * this map -- never be interpolated into a command.
 *
 * `steps` is what the dev server runs locally, as a list because a game's data is not always one
 * script; the first step owns the timestamp the UI reports. `workflow` is the GitHub Actions file
 * the live site dispatches instead. Those run the first step only, so on the live site Battlefield 4's
 * assignment cross-check does not run.
 */
export const SYNC_TARGETS = {
  battlefield4: {
    label: 'Battlefield 4',
    workflow: 'sync-bf4.yml',
    steps: [
      { script: 'fetch-bf4-data.js', data: 'battlefield4.json' },
      // Second on purpose: assignment completion exists in no public API (Battlelog gates its
      // mission endpoints and gametools has no assignment route), so this step re-derives from the
      // hand-kept spreadsheet and cross-checks the total against the stats the step above just
      // fetched. Running it first would check against yesterday's numbers.
      { script: 'fetch-bf4-assignments.js', data: 'battlefield4-assignments.json' },
    ],
  },
  counterstrike: {
    label: 'Counter-Strike 2',
    workflow: 'sync-cs2.yml',
    steps: [{ script: 'fetch-cs2-data.js', data: 'counterstrike.json' }],
  },
  teamfortress2: {
    label: 'Team Fortress 2',
    workflow: 'sync-tf2.yml',
    steps: [{ script: 'fetch-tf2-data.js', data: 'teamfortress2.json' }],
  },
  payday2: {
    label: 'PAYDAY 2',
    workflow: 'sync-payday2.yml',
    steps: [{ script: 'fetch-payday2-data.js', data: 'payday2.json' }],
  },
  satisfactory: {
    label: 'Satisfactory',
    workflow: 'sync-satisfactory.yml',
    steps: [{ script: 'fetch-satisfactory-data.js', data: 'satisfactory.json' }],
  },
  deeprockgalactic: {
    label: 'Deep Rock Galactic',
    workflow: 'sync-drg.yml',
    steps: [{ script: 'fetch-drg-data.js', data: 'deeprockgalactic.json' }],
  },
  runescape: {
    label: 'RuneScape',
    workflow: 'sync-runescape.yml',
    steps: [{ script: 'fetch-runescape-data.js', data: 'runescape.json' }],
  },
};

const UPLOAD_EXTENSIONS =new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif']);

// Uploads arrive base64-encoded in JSON, so this leaves room for a ~15 MB file locally. Vercel
// caps request bodies at 4.5 MB on its own, which is the real limit on the live site.
const MAX_BODY_BYTES = 20 * 1024 * 1024;

/** Constant-time string compare, so response timing can't leak a prefix. */
export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

/**
 * Vercel's Node runtime parses JSON bodies into `req.body` on access; the dev server hands over
 * the raw stream. Take whichever is there.
 */
async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const raw = await new Promise((done, fail) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        fail(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => done(Buffer.concat(chunks).toString()));
    req.on('error', fail);
  });
  return JSON.parse(raw);
}

export function createTokenSigner(secret) {
  const sign = (username, ts) =>
    createHmac('sha256', secret).update(`${username}:${ts}`).digest('hex');

  return {
    make(username) {
      const ts = Date.now();
      return `${ts}:${sign(username, ts)}`;
    },
    verify(token) {
      const adminUser = process.env.ADMIN_USER;
      if (!token || !adminUser) return false;
      const [tsStr, sig] = String(token).split(':');
      const ts = Number(tsStr);
      if (!Number.isFinite(ts) || Date.now() - ts > TOKEN_TTL) return false;
      return safeEqual(sig, sign(adminUser, ts));
    },
  };
}

/**
 * The live site's signer. Serverless instances come and go, so a per-start random secret (what
 * the dev server uses) would log you out on every cold start; this one comes from the environment.
 * Null when it is missing or too short to be a real secret, which keeps login refused.
 */
export function envTokenSigner() {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  return secret && secret.length >= 32 ? createTokenSigner(secret) : null;
}

export function bearerToken(req) {
  return req.headers.authorization?.replace('Bearer ', '');
}

// --- TOTP (RFC 6238), the optional second factor ---------------------------------------------

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(input).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totpAt(key, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

/** One step either side, so a phone clock a little off still logs in. */
function verifyTotp(secret, code) {
  if (!/^\d{6}$/.test(String(code ?? ''))) return false;
  const key = base32Decode(secret);
  const step = Math.floor(Date.now() / 30_000);
  return [-1, 0, 1].some((d) => safeEqual(totpAt(key, step + d), code));
}

// --- Login throttling --------------------------------------------------------------------------

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

/**
 * Per-instance memory: a serverless cold start forgets it, so this slows guessing rather than
 * stopping it. The long password (and TOTP) is what actually holds the line.
 */
const loginFailures = new Map();

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

function isLockedOut(ip) {
  const entry = loginFailures.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    loginFailures.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILURES;
}

function recordFailure(ip) {
  const entry = loginFailures.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    loginFailures.set(ip, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

const delay = (ms) => new Promise((done) => setTimeout(done, ms));

// --- Router ------------------------------------------------------------------------------------

/**
 * Same-origin only. No CORS headers, and a request another site's page sends (which still
 * arrives, just unreadable) is refused before it can touch a file or a sync.
 */
export function isCrossOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.host;
  } catch {
    return true;
  }
}

/**
 * @param {object} deps
 * @param {{ verify(token): boolean, make(user): string } | null} deps.tokens null refuses every
 *   login (the live site without ADMIN_TOKEN_SECRET).
 * @param {{ read(name), write(name, data, opts), upload(name, base64) }} deps.storage
 * @param {{ list(), run(id) }} deps.sync
 * @param {string} [deps.loginDisabledReason]
 * @returns {(req, res) => Promise<void>} answers every /api/admin request, 404 included.
 */
export function createAdminHandler({ tokens, storage, sync, loginDisabledReason }) {
  const authorized = (req) => Boolean(tokens?.verify(bearerToken(req)));

  return async function handleAdmin(req, res) {
    if (isCrossOrigin(req)) return json(res, 403, { error: 'Cross-origin request refused' });

    // On Vercel, vercel.json rewrites /api/admin/<rest> to /api/admin?__route=<rest>: plain
    // functions have no multi-segment catch-all, so the route travels in the query instead.
    const url = new URL(req.url, 'http://localhost');
    const route = url.searchParams.get('__route');
    const path = (route !== null ? `/api/admin/${route}` : url.pathname).replace(/\/+$/, '');

    try {
      if (path === '/api/admin/login' && req.method === 'POST') {
        const adminUser = process.env.ADMIN_USER;
        const adminPass = process.env.ADMIN_PASS;
        if (!tokens || !adminUser || !adminPass) {
          return json(res, 503, {
            error:
              loginDisabledReason ||
              'Admin login is disabled: set ADMIN_USER and ADMIN_PASS in .env and restart.',
          });
        }

        const ip = clientIp(req);
        if (isLockedOut(ip)) {
          return json(res, 429, { error: 'Too many failed attempts. Try again in 15 minutes.' });
        }

        const body = await readJsonBody(req);
        const totpSecret = process.env.ADMIN_TOTP_SECRET;
        const ok =
          safeEqual(body.username, adminUser) &&
          safeEqual(body.password, adminPass) &&
          (!totpSecret || verifyTotp(totpSecret, body.code));

        if (ok) {
          loginFailures.delete(ip);
          return json(res, 200, { token: tokens.make(body.username) });
        }
        recordFailure(ip);
        await delay(500);
        return json(res, 401, {
          error: totpSecret ? 'Invalid credentials or code' : 'Invalid credentials',
        });
      }

      if (path === '/api/admin/verify' && req.method === 'GET') {
        return json(res, 200, { valid: authorized(req) });
      }

      // Everything below needs a valid token.
      if (!authorized(req)) return json(res, 401, { error: 'Unauthorized' });

      if (path === '/api/admin/upload' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const rawName = typeof body.filename === 'string' ? body.filename : '';
        const safeName = basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '-');
        if (!safeName || !UPLOAD_EXTENSIONS.has(extname(safeName).toLowerCase())) {
          return json(res, 400, { error: 'Invalid file type' });
        }
        if (typeof body.data !== 'string' || !body.data) {
          return json(res, 400, { error: 'Missing file data' });
        }
        await storage.upload(safeName, body.data);
        return json(res, 200, { url: `/uploads/${safeName}` });
      }

      const dataMatch = path.match(/^\/api\/admin\/data\/([a-zA-Z0-9_-]+)$/);
      if (dataMatch) {
        const name = dataMatch[1];
        if (!ALLOWED_FILES.has(name)) return json(res, 400, { error: 'File not allowed' });

        if (req.method === 'GET') {
          const { data, version } = await storage.read(name);
          if (version) res.setHeader('ETag', `"${version}"`);
          return json(res, 200, data);
        }
        if (req.method === 'PUT') {
          const body = await readJsonBody(req);
          const ifMatch = req.headers['if-match']?.replace(/"/g, '');
          const result = await storage.write(name, body, { ifMatch });
          if (result?.conflict) {
            return json(res, 409, {
              error: `${name} changed somewhere else since you loaded it. Reload and redo the edit.`,
            });
          }
          return json(res, 200, { success: true });
        }
      }

      if (path === '/api/admin/sync' && req.method === 'GET') {
        return json(res, 200, { targets: await sync.list() });
      }

      const syncMatch = path.match(/^\/api\/admin\/sync\/([a-zA-Z0-9_-]+)$/);
      if (syncMatch && req.method === 'POST') {
        const { status, body } = await sync.run(syncMatch[1]);
        return json(res, status, body);
      }

      return json(res, 404, { error: 'Not found' });
    } catch (err) {
      console.error('[admin-api]', err);
      return json(res, 500, { error: 'Internal server error' });
    }
  };
}
