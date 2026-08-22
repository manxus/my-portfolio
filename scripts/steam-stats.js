/**
 * Shared plumbing for the Steam-backed per-game sync scripts.
 *
 * Every one of them does the same four things: pull `GetUserStatsForGame` and `GetSchemaForGame`
 * for one appid, look the game up in the committed library snapshot for its capsule art and Steam's
 * own playtime figure, derive presentation-ready numbers, and write a JSON file whose `fetchedAt`
 * only moves when a counter actually moved. This is that plumbing; the per-game shape stays in the
 * per-game script.
 *
 * Env:
 *   STEAM_API_KEY   Steam Web API key (shared with fetch-steam-data.js)
 *   STEAM_ID        64-bit SteamID
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const LIBRARY_PATH = resolve(__dirname, '../src/data/steam-library.json');
export const STEAM_API = 'https://api.steampowered.com';

export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Safari/537.36';

export const API_KEY = process.env.STEAM_API_KEY;
export const STEAM_ID = process.env.STEAM_ID;

export function requireCredentials(scriptName) {
  if (!API_KEY || !STEAM_ID) {
    console.error('Missing STEAM_API_KEY or STEAM_ID environment variables.');
    console.error(`Usage: node --env-file=.env scripts/${scriptName}`);
    process.exit(1);
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Guards every derived ratio: a zero denominator is a real state here, not a bug. */
export const ratio = (numerator, denominator, digits = 1) =>
  denominator > 0 ? round((numerator / denominator) * 100, digits) : 0;

/**
 * Bars are read against the best entry in the same group rather than the total, because the top
 * entry routinely owns a third of everything and a share-of-total bar would leave the rest flat.
 * The 2% floor keeps a used-once entry visible as a bar rather than an empty track.
 */
export const barPct = (value, best) => (best > 0 ? Math.max(2, Math.round((value / best) * 100)) : 0);

export async function fetchJson(url, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        const wait = attempt * 2000;
        console.warn(`  retry ${attempt}/${attempts - 1} in ${wait / 1000}s -- ${err.message}`);
        await sleep(wait);
      }
    }
  }

  throw new Error(
    `${url.replace(API_KEY, '<key>')} failed after ${attempts} attempts: ${lastError.message}`,
  );
}

/**
 * The raw stat array as a plain object.
 *
 * A private profile returns HTTP 403 here and a friends-only one an empty stat array, so an empty
 * result is worth saying out loud rather than writing a file full of zeroes.
 */
export async function fetchUserStats(appId) {
  const payload = await fetchJson(
    `${STEAM_API}/ISteamUserStats/GetUserStatsForGame/v2/?key=${API_KEY}&steamid=${STEAM_ID}` +
      `&appid=${appId}`,
  );
  const stats = payload?.playerstats?.stats ?? [];
  if (stats.length === 0) {
    throw new Error(
      `Steam returned no stats for appid ${appId}. Check that the profile's game details are public.`,
    );
  }
  return Object.fromEntries(stats.map((stat) => [stat.name, stat.value]));
}

/**
 * Every stat the game defines, whether or not this account has moved it.
 *
 * `GetUserStatsForGame` only returns counters with a value, so the schema is the only way to know
 * how many of a thing the game tracks in total -- the difference between "Valve tracks 9 maps" and
 * "Valve tracks 46 maps and you have time on 9 of them".
 */
export async function fetchSchemaStats(appId) {
  const payload = await fetchJson(
    `${STEAM_API}/ISteamUserStats/GetSchemaForGame/v2/?key=${API_KEY}&appid=${appId}&l=english`,
  );
  return payload?.game?.availableGameStats?.stats ?? [];
}

/** Machine stat key -> the display name Steam publishes for it, where one exists at all. */
export async function fetchSchemaLabels(appId) {
  const stats = await fetchSchemaStats(appId);
  return Object.fromEntries(
    stats
      .filter((stat) => stat.displayName && stat.displayName !== stat.name)
      .map((stat) => [stat.name, stat.displayName]),
  );
}

/**
 * The profile block and this game's entry from the committed library snapshot.
 *
 * Steam's `playtimeHours` counts the client being open, which is a different and usually larger
 * figure than any in-game counter -- worth carrying so a page can show the gap rather than pick.
 */
export function readLibraryEntry(appId) {
  if (!existsSync(LIBRARY_PATH)) return { profile: {}, game: {} };
  try {
    const library = JSON.parse(readFileSync(LIBRARY_PATH, 'utf8'));
    return {
      profile: library.profile ?? {},
      game: (library.games ?? []).find((entry) => entry.appId === appId) ?? {},
    };
  } catch {
    console.warn('Warning: steam-library.json is unreadable, falling back to a stats-only profile.');
    return { profile: {}, game: {} };
  }
}

export function readExisting(outputPath) {
  if (!existsSync(outputPath)) return null;
  try {
    return JSON.parse(readFileSync(outputPath, 'utf8'));
  } catch {
    console.warn(`Warning: existing ${outputPath} is unreadable, starting fresh.`);
    return null;
  }
}

/**
 * Holds `fetchedAt` still when nothing else changed, so a scheduled sync that finds no movement
 * leaves the file byte-identical and the workflow has nothing to commit.
 */
export function withStableTimestamp(output, existing) {
  if (!existing) return output;

  const sameData =
    JSON.stringify({ ...output, fetchedAt: null }) ===
    JSON.stringify({ ...existing, fetchedAt: null });

  return sameData ? { ...output, fetchedAt: existing.fetchedAt } : output;
}

/** Writes the snapshot and reports whether anything actually moved. */
export function writeSnapshot(outputPath, output, summaryLine) {
  const existing = readExisting(outputPath);
  const final = withStableTimestamp(output, existing);

  writeFileSync(outputPath, `${JSON.stringify(final, null, 2)}\n`);
  console.log(summaryLine);
  if (existing && final.fetchedAt === existing.fetchedAt) {
    console.log('  No counters moved since the last sync; the file is unchanged.');
  }
  return final;
}

/** The profile block every game page's dossier renders. */
export function buildProfile(appId, { profile, game }) {
  return {
    steamId: String(STEAM_ID),
    personaName: profile.personaName ?? 'Unknown',
    avatarUrl: profile.avatarUrl ?? null,
    profileUrl: profile.profileUrl ?? null,
    capsuleUrl: game.libraryCapsuleUrl ?? game.headerUrl ?? null,
    libraryHours: game.playtimeHours ?? 0,
  };
}
