/**
 * Build-time script to fetch Steam library data (full library, wishlist, achievements).
 *
 * Usage:
 *   STEAM_API_KEY=<key> STEAM_ID=<id> node scripts/fetch-steam-data.js
 *   node scripts/fetch-steam-data.js --force   # ignore disk cache
 *   node scripts/fetch-steam-data.js --wishlist-only   # update wishlist in existing JSON only
 *
 * Outputs JSON to src/data/steam-library.json
 *
 * Cache: scripts/.steam-fetch-cache/cache.json (gitignored)
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../src/data/steam-library.json');
const CACHE_DIR = resolve(__dirname, '.steam-fetch-cache');
const CACHE_PATH = join(CACHE_DIR, 'cache.json');

const FORCE = process.argv.includes('--force');
const WISHLIST_ONLY = process.argv.includes('--wishlist-only');

const API_KEY = process.env.STEAM_API_KEY;
const STEAM_ID = process.env.STEAM_ID;

if (!API_KEY || !STEAM_ID) {
  console.error('Missing STEAM_API_KEY or STEAM_ID environment variables.');
  console.error('Usage: STEAM_API_KEY=<key> STEAM_ID=<id> node scripts/fetch-steam-data.js');
  process.exit(1);
}

const STEAM_API = 'https://api.steampowered.com';
const STORE_API = 'https://store.steampowered.com/api';

const POOL_SIZE = 5;
const POOL_DELAY_MS = 250;

/** Category descriptions treated as player modes */
const PLAYER_MODE_LABELS = new Set([
  'Single-player',
  'Multi-player',
  'Co-op',
  'Online Co-op',
  'Shared/Split Screen Co-op',
  'LAN Co-op',
  'Online PvP',
  'LAN PvP',
  'Shared/Split Screen PvP',
  'Cross-Platform Multiplayer',
  'MMO',
]);

/** Category descriptions treated as hardware / platform features */
const HARDWARE_LABELS = new Set([
  'VR Support',
  'Tracked Controller Support',
  'VR Only',
  'Valve Index',
  'HTC Vive',
  'Oculus Rift',
  'Windows Mixed Reality',
  'Full controller support',
  'Partial Controller Support',
  'Remote Play on Phone',
  'Remote Play on Tablet',
  'Remote Play on TV',
  'Remote Play Together',
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${url}`);
  }
}

function loadCache() {
  if (FORCE || !existsSync(CACHE_PATH)) {
    return { games: {}, appNames: null };
  }
  try {
    const raw = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
    return {
      games: raw.games || {},
      appNames: raw.appNames || null,
    };
  } catch {
    return { games: {}, appNames: null };
  }
}

function saveCache(cache) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 0));
}

function parseCategories(categoryObjs) {
  const cats = (categoryObjs || []).map((c) => c.description).filter(Boolean);
  const playerModes = [...new Set(cats.filter((d) => PLAYER_MODE_LABELS.has(d)))];
  const hardwareSupport = [...new Set(cats.filter((d) => HARDWARE_LABELS.has(d)))];
  return { playerModes, hardwareSupport };
}

async function getPlayerSummary() {
  const url = `${STEAM_API}/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${STEAM_ID}`;
  const data = await fetchJSON(url);
  const player = data.response.players[0];
  if (!player) throw new Error('Player not found');
  return {
    steamId: player.steamid,
    personaName: player.personaname,
    avatarUrl: player.avatarfull,
    profileUrl: player.profileurl,
    lastLogoff: player.lastlogoff,
  };
}

async function getOwnedGames() {
  const url = `${STEAM_API}/IPlayerService/GetOwnedGames/v1/?key=${API_KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1`;
  const data = await fetchJSON(url);
  return (data.response.games || [])
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .map((g) => ({
      appId: g.appid,
      name: g.name,
      playtimeHours: Math.round((g.playtime_forever / 60) * 10) / 10,
      iconUrl: `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`,
      headerUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
    }));
}

async function getAppDetails(appId) {
  try {
    const url = `${STORE_API}/appdetails?appids=${appId}&l=english`;
    const data = await fetchJSON(url);
    const info = data[String(appId)];
    if (!info?.success) {
      return {
        genres: [],
        playerModes: [],
        hardwareSupport: [],
        releaseDate: null,
        headerImage: null,
      };
    }
    const d = info.data;
    const genres = (d.genres || []).map((g) => g.description);
    const { playerModes, hardwareSupport } = parseCategories(d.categories || []);
    const releaseDate = d.release_date?.date || null;
    const headerImage =
      typeof d.header_image === 'string' && d.header_image.length > 0
        ? d.header_image
        : null;
    return { genres, playerModes, hardwareSupport, releaseDate, headerImage };
  } catch {
    return {
      genres: [],
      playerModes: [],
      hardwareSupport: [],
      releaseDate: null,
      headerImage: null,
    };
  }
}

async function getAchievements(appId) {
  try {
    const url = `${STEAM_API}/ISteamUserStats/GetPlayerAchievements/v1/?key=${API_KEY}&steamid=${STEAM_ID}&appid=${appId}`;
    const data = await fetchJSON(url);
    const achievements = data.playerstats?.achievements || [];
    const unlocked = achievements.filter((a) => a.achieved === 1).length;
    return { total: achievements.length, unlocked };
  } catch {
    return null;
  }
}

function normalizeWishlistResponse(data) {
  const r = data.response;
  if (Array.isArray(r)) return r;
  if (r?.wishlist && Array.isArray(r.wishlist)) return r.wishlist;
  if (r?.items && Array.isArray(r.items)) return r.items;
  return [];
}

async function getWishlistRaw() {
  try {
    const url = `${STEAM_API}/IWishlistService/GetWishlist/v1/?key=${API_KEY}&steamid=${STEAM_ID}`;
    const data = await fetchJSON(url);
    const items = normalizeWishlistResponse(data);
    return items.map((row) => ({
      appId: row.appid ?? row.app_id,
      dateAdded: row.date_added ?? row.dateAdded ?? 0,
      priority: row.priority ?? 0,
    }));
  } catch (e) {
    console.warn('Wishlist fetch failed:', e.message);
    return [];
  }
}

async function getAllAppNames() {
  const map = new Map();
  let lastAppId = 0;
  const maxResults = 50000;
  for (;;) {
    const url = `${STEAM_API}/IStoreService/GetAppList/v1/?key=${API_KEY}&max_results=${maxResults}&last_appid=${lastAppId}`;
    const data = await fetchJSON(url);
    const apps = data.response?.apps || [];
    if (apps.length === 0) break;
    for (const a of apps) {
      map.set(a.appid, a.name);
    }
    if (apps.length < maxResults) break;
    lastAppId = apps[apps.length - 1].appid;
    await sleep(200);
  }
  return map;
}

async function runPool(length, concurrency, worker) {
  let next = 0;
  async function runWorker() {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= length) return;
      await worker(i);
      await sleep(POOL_DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
}

function hasCachedStoreFields(cached) {
  return Boolean(cached && 'genres' in cached);
}

async function resolveAppNameLookup(cache) {
  if (
    FORCE ||
    !cache.appNames ||
    typeof cache.appNames !== 'object' ||
    Array.isArray(cache.appNames) ||
    Object.keys(cache.appNames).length === 0
  ) {
    console.log('Fetching global app list for wishlist names...');
    const m = await getAllAppNames();
    cache.appNames = Object.fromEntries(m);
    return m;
  }
  console.log('Using cached app name list for wishlist');
  return new Map(
    Object.entries(cache.appNames).map(([k, v]) => [Number(k), v]),
  );
}

async function mainWishlistOnly() {
  if (!existsSync(OUTPUT_PATH)) {
    console.error(`Missing ${OUTPUT_PATH}; run a full fetch first.`);
    process.exit(1);
  }
  console.log('Wishlist-only update...');
  if (FORCE) console.log('(--force: ignoring disk cache)');

  const cache = loadCache();
  const nameLookup = await resolveAppNameLookup(cache);
  const wishlistRows = await getWishlistRaw();
  const wishlist = wishlistRows.map((w) => {
    const name = nameLookup.get(w.appId) || `App ${w.appId}`;
    return {
      appId: w.appId,
      dateAdded: w.dateAdded,
      priority: w.priority,
      name,
      headerUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${w.appId}/header.jpg`,
    };
  });
  console.log(`Wishlist: ${wishlist.length} items`);

  const existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'));
  existing.wishlist = wishlist;
  existing.fetchedAt = new Date().toISOString();

  saveCache(cache);
  writeFileSync(OUTPUT_PATH, JSON.stringify(existing, null, 2));
  console.log(`Written to ${OUTPUT_PATH}`);
}

async function main() {
  if (WISHLIST_ONLY) {
    await mainWishlistOnly();
    return;
  }

  console.log('Fetching Steam data...');
  if (FORCE) console.log('(--force: ignoring disk cache)');

  const cache = loadCache();
  const profile = await getPlayerSummary();
  console.log(`Profile: ${profile.personaName}`);

  const games = await getOwnedGames();
  console.log(`Found ${games.length} games`);

  console.log('Fetching app details (Store API, concurrent)...');
  await runPool(games.length, POOL_SIZE, async (i) => {
    const game = games[i];
    const id = String(game.appId);
    const prev = cache.games[id];
    if (!FORCE && hasCachedStoreFields(prev)) {
      game.genres = prev.genres;
      game.playerModes = prev.playerModes || [];
      game.hardwareSupport = prev.hardwareSupport || [];
      game.releaseDate = prev.releaseDate ?? null;
      if (prev.headerUrl) {
        game.headerUrl = prev.headerUrl;
      } else {
        const d = await getAppDetails(game.appId);
        if (d.headerImage) game.headerUrl = d.headerImage;
        cache.games[id] = { ...prev, headerUrl: game.headerUrl };
      }
    } else {
      const d = await getAppDetails(game.appId);
      game.genres = d.genres;
      game.playerModes = d.playerModes;
      game.hardwareSupport = d.hardwareSupport;
      game.releaseDate = d.releaseDate;
      if (d.headerImage) game.headerUrl = d.headerImage;
      cache.games[id] = {
        ...cache.games[id],
        genres: d.genres,
        playerModes: d.playerModes,
        hardwareSupport: d.hardwareSupport,
        releaseDate: d.releaseDate,
        headerUrl: game.headerUrl,
      };
    }
    if ((i + 1) % 200 === 0) console.log(`  ...details ${i + 1}/${games.length}`);
  });

  console.log('Fetching achievements (Steam API, concurrent)...');
  await runPool(games.length, POOL_SIZE, async (i) => {
    const game = games[i];
    const id = String(game.appId);
    const ach = await getAchievements(game.appId);
    game.achievements = ach;
    cache.games[id] = { ...cache.games[id], achievements: ach };
    if ((i + 1) % 200 === 0) console.log(`  ...achievements ${i + 1}/${games.length}`);
  });

  const nameLookup = await resolveAppNameLookup(cache);

  const wishlistRows = await getWishlistRaw();

  const wishlist = wishlistRows.map((w) => {
    const name = nameLookup.get(w.appId) || `App ${w.appId}`;
    return {
      appId: w.appId,
      dateAdded: w.dateAdded,
      priority: w.priority,
      name,
      headerUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${w.appId}/header.jpg`,
    };
  });
  console.log(`Wishlist: ${wishlist.length} items`);

  saveCache(cache);

  const output = {
    fetchedAt: new Date().toISOString(),
    profile,
    games,
    wishlist,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
