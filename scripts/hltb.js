/**
 * HowLongToBeat enrichment helpers for the Steam library fetch pipeline.
 *
 * Uses HLTB's unofficial search API (endpoint name rotates; currently /api/search/site).
 * The endpoint is rediscovered from the site bundles each run, so a rotation is
 * self-healing; if it can't be resolved, enrichment is skipped rather than fatal.
 * Results are cached on disk keyed by Steam appId so CI/daily runs only fill gaps.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const HLTB_ORIGIN = 'https://howlongtobeat.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Known search bases, newest first. Fallback if homepage scrape fails. */
const KNOWN_SEARCH_BASES = [
  '/api/search/site',
  '/api/bleed',
  '/api/find',
  '/api/locate',
  '/api/seek',
  '/api/finder',
  '/api/search',
];

/** API areas that are never the search endpoint (admin, account, forums, public data). */
const IGNORED_API_PREFIXES = /^\/api\/(admin|moderator|user|forum|play|stats|steam|discord|v\d+)(\/|$)/;

/** How many scraped candidates to probe before falling back to the known list. */
const MAX_SCRAPED_CANDIDATES = 5;

const AUTH_ONLY_PATHS = new Set([
  '/api/login',
  '/api/logout',
  '/api/signup',
  '/api/forgotpassword',
  '/api/feedback',
  '/api/error',
  '/api/submit',
  '/api/user',
]);

const DEFAULT_DELAY_MS = 1000;
const MATCH_THRESHOLD = 0.55;
const SEARCH_SIZE = 8;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hoursFromSeconds(secs) {
  if (!secs || secs <= 0) return null;
  return Math.round((secs / 3600) * 10) / 10;
}

const ROMAN_TO_INT = {
  i: '1',
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
  x: '10',
  xi: '11',
  xii: '12',
  xiii: '13',
  xiv: '14',
  xv: '15',
};

function normalizeTitle(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[™®©]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(goty|game of the year|deluxe|definitive|ultimate|complete|edition|remastered|remake|hd|vr|demo|playtest|soundtrack|ost|dlc)\b/g, ' ')
    // Multi-char romans anywhere (III → 3). Skip lone "i" mid-title ("i am bread").
    .replace(/\b(ii|iii|iv|vi|vii|viii|ix|x[i]{0,3}|xv)\b/g, (m) => ROMAN_TO_INT[m] || m)
    // Trailing single-letter sequel numeral ("gta v", "dark souls i").
    .replace(/\b([ivx])$/g, (m) => ROMAN_TO_INT[m] || m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dice coefficient on character bigrams — good enough for title matching. */
function similarity(a, b) {
  const s1 = normalizeTitle(a);
  const s2 = normalizeTitle(b);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) {
    const shorter = Math.min(s1.length, s2.length);
    const longer = Math.max(s1.length, s2.length);
    return 0.85 + 0.15 * (shorter / longer);
  }
  if (s1.length < 2 || s2.length < 2) return s1 === s2 ? 1 : 0;

  const bigrams = (s) => {
    const map = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      map.set(bg, (map.get(bg) || 0) + 1);
    }
    return map;
  };
  const b1 = bigrams(s1);
  const b2 = bigrams(s2);
  let overlap = 0;
  for (const [bg, c1] of b1) {
    const c2 = b2.get(bg) || 0;
    overlap += Math.min(c1, c2);
  }
  return (2 * overlap) / (s1.length - 1 + (s2.length - 1));
}

function isBaseGame(row) {
  const type = String(row?.game_type || '').toLowerCase();
  if (type && type !== 'game') return false;
  const name = `${row?.game_name || ''} ${row?.game_alias || ''}`;
  // Guard against miscategorized DLC/expansion rows.
  if (/\b(dlc|expansion|add[\s-]?on|season pass)\b/i.test(name)) return false;
  return true;
}

function scoreMatch(steamName, row) {
  const name = row.game_name || '';
  let score = similarity(steamName, name);
  if (row.game_alias) {
    score = Math.max(score, similarity(steamName, row.game_alias));
  }
  return score;
}

function pickBestMatch(steamName, results) {
  if (!Array.isArray(results) || results.length === 0) return null;

  // Only accept base games — never DLC / expansions / packs.
  const candidates = results.filter(isBaseGame);
  if (candidates.length === 0) return null;

  let best = null;
  let bestScore = 0;
  for (const row of candidates) {
    const score = scoreMatch(steamName, row);
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  if (!best || bestScore < MATCH_THRESHOLD) return null;
  return { row: best, score: bestScore };
}

function toHltbEntry(row, score) {
  const mainHours = hoursFromSeconds(row.comp_main);
  const mainExtraHours = hoursFromSeconds(row.comp_plus);
  const completionistHours = hoursFromSeconds(row.comp_100);
  if (mainHours == null && mainExtraHours == null && completionistHours == null) {
    return null;
  }
  return {
    id: row.game_id ?? null,
    mainHours,
    mainExtraHours,
    completionistHours,
    matchedName: row.game_name || null,
    matchScore: Math.round(score * 1000) / 1000,
  };
}

export function loadHltbCache(cacheDir) {
  const path = join(cacheDir, 'hltb.json');
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

/**
 * Write cached HLTB times onto `games`. Mutates `games`; safe to call after a
 * failed enrichment so an HLTB outage never strips times already committed.
 */
export function applyHltbCache(games, cache) {
  let applied = 0;
  let withCompletionist = 0;
  for (const game of games) {
    const prev = cache[String(game.appId)];
    if (!prev) {
      // Not fetched yet — omit the field so the committed JSON stays lean.
      delete game.hltb;
      continue;
    }
    game.hltb = prev.hltb
      ? {
          id: prev.hltb.id ?? null,
          mainHours: prev.hltb.mainHours ?? null,
          mainExtraHours: prev.hltb.mainExtraHours ?? null,
          completionistHours: prev.hltb.completionistHours ?? null,
          matchedName: prev.hltb.matchedName ?? null,
        }
      : null;
    applied += 1;
    if (game.hltb?.completionistHours != null) withCompletionist += 1;
  }
  return { applied, withCompletionist };
}

export function saveHltbCache(cacheDir, cache) {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, 'hltb.json'), JSON.stringify(cache, null, 0));
}

async function scrapeSearchBases() {
  try {
    const home = await fetch(`${HLTB_ORIGIN}/`, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    });
    if (!home.ok) return null;
    const html = await home.text();
    const scripts = [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map(
      (m) => m[1],
    );
    const found = new Set();
    for (const src of scripts) {
      const res = await fetch(`${HLTB_ORIGIN}${src}`, {
        headers: { 'User-Agent': UA },
      });
      if (!res.ok) continue;
      const js = await res.text();
      // Paths can have several segments — /api/search/site, not just /api/bleed.
      for (const m of js.matchAll(/["'`](\/api\/[a-zA-Z0-9]+(?:\/[a-zA-Z0-9]+)*)["'`]/g)) {
        const path = m[1];
        if (AUTH_ONLY_PATHS.has(path) || IGNORED_API_PREFIXES.test(path)) continue;
        found.add(path);
      }
    }

    // The token handshake lives at `<base>/init`, so a scraped ".../init" names its base.
    const initParents = new Set();
    for (const path of found) {
      if (path.endsWith('/init')) initParents.add(path.slice(0, -'/init'.length));
    }
    for (const base of initParents) found.add(base);

    // Prefer bases that have a matching /init, then search verbs / short opaque names.
    const ranked = [...found]
      .filter((path) => !path.endsWith('/init'))
      .sort((a, b) => {
        const score = (p) =>
          (initParents.has(p) ? 100 : 0) +
          (/bleed|find|locate|seek|finder|search/.test(p) ? 10 : 0) +
          (p.length <= 12 ? 1 : 0);
        return score(b) - score(a);
      });
    return ranked.slice(0, MAX_SCRAPED_CANDIDATES);
  } catch {
    return [];
  }
}

async function initToken(searchBase) {
  const url = `${HLTB_ORIGIN}${searchBase}/init?t=${Date.now()}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Referer: `${HLTB_ORIGIN}/`,
      Origin: HLTB_ORIGIN,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`HLTB init ${res.status} at ${searchBase}`);
  }
  const data = await res.json();
  if (!data?.token || !data?.hpKey || !data?.hpVal) {
    throw new Error(`HLTB init missing token fields at ${searchBase}`);
  }
  return data;
}

async function resolveSearchBase() {
  const scraped = await scrapeSearchBases();
  const seen = new Set();
  const candidates = [...scraped, ...KNOWN_SEARCH_BASES].filter((base) => {
    if (seen.has(base)) return false;
    seen.add(base);
    return true;
  });

  const errors = [];
  for (const base of candidates) {
    try {
      const tok = await initToken(base);
      return { searchBase: base, tokenData: tok };
    } catch (e) {
      errors.push(`${base}: ${e.message}`);
    }
  }
  throw new Error(
    `Could not resolve a working HowLongToBeat search endpoint — tried ${errors.join('; ')}`,
  );
}

async function searchHltb(searchBase, tokenData, title) {
  const terms = String(title || '')
    .replace(/[™®©]/g, '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (terms.length === 0) return [];

  const hpKey = tokenData.hpKey;
  const hpVal = tokenData.hpVal;
  const payload = {
    searchType: 'games',
    searchTerms: terms,
    searchPage: 1,
    size: SEARCH_SIZE,
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: null, max: null },
        gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
        rangeYear: { min: '', max: '' },
        modifier: 'hide_dlc',
      },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '',
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
    [hpKey]: hpVal,
  };

  const res = await fetch(`${HLTB_ORIGIN}${searchBase}`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/json',
      Origin: HLTB_ORIGIN,
      Referer: `${HLTB_ORIGIN}/`,
      'x-auth-token': tokenData.token,
      'x-hp-key': hpKey,
      'x-hp-val': hpVal,
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 401 || res.status === 403) {
    const err = new Error(`HLTB auth ${res.status}`);
    err.code = 'HLTB_AUTH';
    throw err;
  }
  if (!res.ok) {
    throw new Error(`HLTB search ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * Enrich games with HLTB times. Mutates `games` and returns stats.
 *
 * Cache entry shapes:
 *   { hltb: {...}|null, fetchedAt, name }
 * Negative cache (no match) stores hltb: null so we don't re-query every run.
 */
export async function enrichGamesWithHltb(games, {
  cacheDir,
  force = false,
  delayMs = DEFAULT_DELAY_MS,
  maxFetches = Infinity,
  onCheckpoint,
} = {}) {
  const cache = loadHltbCache(cacheDir);
  let session = null;

  const ensureSession = async () => {
    if (!session) session = await resolveSearchBase();
    return session;
  };

  const needsFetch = (game) => {
    if (force) return true;
    const prev = cache[String(game.appId)];
    if (!prev) return true;
    // Re-fetch if the Steam title changed meaningfully (rename / wrong prior match).
    if (prev.name && normalizeTitle(prev.name) !== normalizeTitle(game.name)) {
      return true;
    }
    return false;
  };

  // Keep library order — no playtime / unplayed prioritization.
  const pending = games.filter(needsFetch);

  const toFetch = pending.slice(0, Number.isFinite(maxFetches) ? maxFetches : pending.length);
  let fetched = 0;
  let matched = 0;
  let failed = 0;

  const applyCache = () => applyHltbCache(games, cache);

  if (toFetch.length > 0) {
    console.log(
      `HLTB: fetching ${toFetch.length} games` +
        (pending.length > toFetch.length
          ? ` (${pending.length - toFetch.length} deferred to later runs)`
          : '') +
        '...',
    );
    try {
      await ensureSession();
      console.log(`HLTB: using endpoint ${session.searchBase}`);
    } catch (e) {
      // HLTB rotates its endpoint without notice. Keep the cached times we already
      // have and let the rest of the sync finish rather than failing the whole run.
      console.warn(`HLTB: skipping enrichment — ${e.message}`);
      const skipped = applyCache();
      return {
        fetched: 0,
        matched: 0,
        failed: 0,
        ...skipped,
        unavailable: true,
      };
    }
  } else {
    console.log('HLTB: cache warm, no new lookups needed');
  }

  for (const game of toFetch) {
    const id = String(game.appId);
    try {
      let results;
      try {
        results = await searchHltb(session.searchBase, session.tokenData, game.name);
      } catch (e) {
        if (e.code === 'HLTB_AUTH') {
          try {
            session = await resolveSearchBase();
          } catch (reErr) {
            const lost = new Error(`endpoint lost mid-run (${reErr.message})`);
            lost.code = 'HLTB_SESSION_LOST';
            throw lost;
          }
          results = await searchHltb(session.searchBase, session.tokenData, game.name);
        } else {
          throw e;
        }
      }

      const best = pickBestMatch(game.name, results);
      const entry = best ? toHltbEntry(best.row, best.score) : null;
      cache[id] = {
        hltb: entry,
        fetchedAt: new Date().toISOString(),
        name: game.name,
      };
      if (entry) matched += 1;
      fetched += 1;
    } catch (e) {
      failed += 1;
      console.warn(`HLTB: failed for ${game.name} (${game.appId}): ${e.message}`);
      if (e.code === 'HLTB_SESSION_LOST') {
        // Re-resolving costs a full bundle scrape; don't repeat it for every
        // remaining game. Keep what we have and pick the rest up next run.
        console.warn('HLTB: stopping enrichment early, remaining games deferred.');
        break;
      }
    }

    if ((fetched + failed) % 50 === 0) {
      saveHltbCache(cacheDir, cache);
      applyCache();
      console.log(
        `  ...hltb ${fetched + failed}/${toFetch.length} (matched ${matched}, failed ${failed})`,
      );
      if (typeof onCheckpoint === 'function') {
        await onCheckpoint({ fetched, matched, failed });
      }
    }
    await sleep(delayMs);
  }

  if (toFetch.length > 0) saveHltbCache(cacheDir, cache);

  const { applied, withCompletionist } = applyCache();

  console.log(
    `HLTB: applied ${applied}/${games.length} cache entries` +
      ` (${withCompletionist} with 100% times; fetched ${fetched}, matched ${matched}, failed ${failed})`,
  );

  return { fetched, matched, failed, applied, withCompletionist };
}
