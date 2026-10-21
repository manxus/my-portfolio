import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  SYNC_TARGETS,
  createAdminHandler,
  createTokenSigner,
  json,
} from './api/_lib/admin-core.js';

const require = createRequire(import.meta.url);

// Random per server start: a clock-derived secret could be guessed from the
// server's start time, and anyone holding it can mint tokens. (The live site
// signs with ADMIN_TOKEN_SECRET instead; see api/_lib/admin-core.js.)
const tokens = createTokenSigner(randomBytes(32));

/** Locally the data is the working tree itself: saves land in src/data for you to commit. */
const fsStorage = {
  async read(name) {
    const content = await readFile(resolve(process.cwd(), 'src/data', `${name}.json`), 'utf-8');
    return { data: JSON.parse(content) };
  },
  async write(name, data) {
    const filePath = resolve(process.cwd(), 'src/data', `${name}.json`);
    await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  },
  async upload(safeName, base64) {
    const uploadsDir = resolve(process.cwd(), 'public/uploads');
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(resolve(uploadsDir, safeName), Buffer.from(base64, 'base64'));
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
    const geocodePath = resolve(process.cwd(), 'dev-api/geocode.cjs');
    delete require.cache[geocodePath];
    const handler = require('./dev-api/geocode.cjs');
    await handler(req, res);
  } catch (err) {
    console.error('[geocode dev]', err);
    return json(res, 502, { error: 'Failed to search locations' });
  }
}

async function handleTmdb(req, res) {
  try {
    const tmdbPath = resolve(process.cwd(), 'dev-api/tmdb.cjs');
    delete require.cache[tmdbPath];
    const handler = require('./dev-api/tmdb.cjs');
    await handler(req, res);
  } catch (err) {
    console.error('[tmdb dev]', err);
    return json(res, 502, { error: 'Failed to reach TMDB' });
  }
}

/** Runs a game's fetch scripts in place, so the result is in the working tree straight away. */
const localSync = {
  async list() {
    return Promise.all(
      Object.entries(SYNC_TARGETS).map(async ([id, target]) => ({
        id,
        label: target.label,
        fetchedAt: await readFetchedAt(target.steps[0].data),
        running: runningSyncs.has(id),
      })),
    );
  },

  async run(id) {
    const target = SYNC_TARGETS[id];
    if (!target) return { status: 400, body: { error: 'Unknown sync target' } };
    if (runningSyncs.has(id)) {
      return { status: 409, body: { error: `${target.label} is already syncing` } };
    }

    runningSyncs.add(id);
    try {
      const before = await Promise.all(target.steps.map((step) => readFetchedAt(step.data)));

      const outputs = [];
      const warnings = [];
      for (const [i, step] of target.steps.entries()) {
        const result = await runSyncScript(step.script);
        outputs.push(`$ ${step.script}\n${result.output}`);
        warnings.push(...collectWarnings(result.output));

        // Stop at the first failure: a later step may cross-check the snapshot an earlier
        // one was supposed to write, and checking against a stale file invents drift.
        if (result.code !== 0) {
          return {
            status: 502,
            body: {
              error: `${target.label} sync failed in ${step.script}`,
              output: outputs.join('\n\n'),
              warnings,
              failedStep: i,
            },
          };
        }
      }

      const after = await Promise.all(target.steps.map((step) => readFetchedAt(step.data)));

      return {
        status: 200,
        body: {
          changed: after.some((stamp, i) => stamp !== before[i]),
          fetchedAt: after[0],
          warnings,
          output: outputs.join('\n\n'),
        },
      };
    } finally {
      runningSyncs.delete(id);
    }
  },
};

const handleAdmin = createAdminHandler({ tokens, storage: fsStorage, sync: localSync });

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
        return handleAdmin(req, res);
      });
    },
  };
}
