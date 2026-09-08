import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
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
  'changelog', 'steam-tierlist', 'menu', 'steam-overrides', 'steam-collections',
  'media', 'livestream', 'music', 'books', 'tabletop', 'travel', 'credits', 'patchNotes', 'steam-hallofpain',
  'cinema', 'runescape',
  // Admin-only, and deliberately never imported by a page: keeping the
  // "not interested" list out of the bundle keeps it out of public view.
  'cinema-dismissed',
]);

/**
 * Games whose committed snapshot can be refreshed from the admin UI. Keys are the ids from
 * src/pages/games/registry.js; the browser sends one and it is looked up here.
 *
 * A fixed table rather than a derived path, for the same reason ALLOWED_FILES is one: the id
 * arrives over the wire and ends up in a spawn, so it must only ever index this map -- never be
 * interpolated into a command.
 *
 * `steps` is a list because a game's data is not always one script. The first step owns the
 * timestamp the UI reports; the rest run in order after it.
 */
const SYNC_TARGETS = {
  battlefield4: {
    label: 'Battlefield 4',
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
    steps: [{ script: 'fetch-cs2-data.js', data: 'counterstrike.json' }],
  },
  teamfortress2: {
    label: 'Team Fortress 2',
    steps: [{ script: 'fetch-tf2-data.js', data: 'teamfortress2.json' }],
  },
  payday2: {
    label: 'PAYDAY 2',
    steps: [{ script: 'fetch-payday2-data.js', data: 'payday2.json' }],
  },
  satisfactory: {
    label: 'Satisfactory',
    steps: [{ script: 'fetch-satisfactory-data.js', data: 'satisfactory.json' }],
  },
  deeprockgalactic: {
    label: 'Deep Rock Galactic',
    steps: [{ script: 'fetch-drg-data.js', data: 'deeprockgalactic.json' }],
  },
  runescape: {
    label: 'RuneScape',
    steps: [{ script: 'fetch-runescape-data.js', data: 'runescape.json' }],
  },
};

/**
 * The scripts report drift they cannot fix themselves on stdout -- an assignment Battlelog counts
 * but the spreadsheet does not, a wiki merge that stopped matching. Exit code stays 0 because the
 * snapshot is still valid, so the warnings have to be lifted out of the log to reach the UI.
 */
function collectWarnings(output) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('Warning:'))
    .map((line) => line.replace(/^Warning:\s*/, ''));
}

/** The Steam library sync can take minutes; the per-game ones are seconds. This is the ceiling. */
const SYNC_TIMEOUT_MS = 5 * 60 * 1000;

/** One run per game at a time -- two concurrent writers would race on the same JSON file. */
const runningSyncs = new Set();

/**
 * The snapshot's own timestamp, which the scripts hold still when nothing moved (see
 * scripts/snapshot.js). Comparing it across a run is how the UI can say "already up to date"
 * instead of implying it fetched something new.
 */
async function readFetchedAt(dataFile) {
  try {
    const raw = await readFile(resolve(process.cwd(), 'src/data', dataFile), 'utf-8');
    return JSON.parse(raw).fetchedAt ?? null;
  } catch {
    return null;
  }
}

function runSyncScript(script) {
  const args = [];
  // The scripts read STEAM_API_KEY / TMDB_API_KEY from the process env, and the documented way to
  // run them by hand is `node --env-file=.env`. Match that so the button behaves like the CLI.
  const envFile = resolve(process.cwd(), '.env');
  if (existsSync(envFile)) args.push(`--env-file=${envFile}`);
  args.push(resolve(process.cwd(), 'scripts', script));

  return new Promise((done) => {
    const child = spawn(process.execPath, args, { cwd: process.cwd() });
    let output = '';
    // Keep the tail rather than the head: a failure message is the last thing printed.
    const capture = (chunk) => {
      output = (output + chunk).slice(-8000);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, SYNC_TIMEOUT_MS);

    child.on('error', (err) => {
      clearTimeout(timer);
      done({ code: -1, output: err.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ code, output: timedOut ? `${output}\nTimed out after 5 minutes.` : output.trim() });
    });
  });
}

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

          if (req.url === '/api/admin/sync' && req.method === 'GET') {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!verifyToken(token)) {
              return json(res, 401, { error: 'Unauthorized' });
            }

            const targets = await Promise.all(
              Object.entries(SYNC_TARGETS).map(async ([id, target]) => ({
                id,
                label: target.label,
                fetchedAt: await readFetchedAt(target.steps[0].data),
                running: runningSyncs.has(id),
              })),
            );
            return json(res, 200, { targets });
          }

          const syncMatch = req.url.match(/^\/api\/admin\/sync\/([a-zA-Z0-9_-]+)$/);
          if (syncMatch && req.method === 'POST') {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!verifyToken(token)) {
              return json(res, 401, { error: 'Unauthorized' });
            }

            const id = syncMatch[1];
            const target = SYNC_TARGETS[id];
            if (!target) {
              return json(res, 400, { error: 'Unknown sync target' });
            }
            if (runningSyncs.has(id)) {
              return json(res, 409, { error: `${target.label} is already syncing` });
            }

            runningSyncs.add(id);
            try {
              const before = await Promise.all(
                target.steps.map((step) => readFetchedAt(step.data)),
              );

              const outputs = [];
              const warnings = [];
              for (const [i, step] of target.steps.entries()) {
                const result = await runSyncScript(step.script);
                outputs.push(`$ ${step.script}\n${result.output}`);
                warnings.push(...collectWarnings(result.output));

                // Stop at the first failure: a later step may cross-check the snapshot an earlier
                // one was supposed to write, and checking against a stale file invents drift.
                if (result.code !== 0) {
                  return json(res, 502, {
                    error: `${target.label} sync failed in ${step.script}`,
                    output: outputs.join('\n\n'),
                    warnings,
                    failedStep: i,
                  });
                }
              }

              const after = await Promise.all(
                target.steps.map((step) => readFetchedAt(step.data)),
              );

              return json(res, 200, {
                changed: after.some((stamp, i) => stamp !== before[i]),
                fetchedAt: after[0],
                warnings,
                output: outputs.join('\n\n'),
              });
            } finally {
              runningSyncs.delete(id);
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
