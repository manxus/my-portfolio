/**
 * Re-read every tracked show from TMDB so the library notices new seasons.
 *
 * Usage:
 *   node --env-file=.env scripts/refresh-cinema-shows.js          # write
 *   node --env-file=.env scripts/refresh-cinema-shows.js --dry    # report only
 *   npm run cinema:refresh -- --dry
 *
 * Env:
 *   TMDB_API_KEY   TMDB v3 API key (same one the admin title picker uses)
 *
 * Outputs:
 *   src/data/cinema.json   refreshed seasons/seasonEpisodes/episodes, and the
 *                          status those imply, on every tv entry
 *
 * This is the recurring counterpart to backfill-cinema-episodes.js, which is a
 * one-off migration and stays that way: it seeds a watch record from a bare
 * total, whereas this script treats an existing record as the truth and only
 * ever changes it to match a season TMDB has re-cut. A show that gains a season
 * therefore comes back with everything it had watched still ticked, and the new
 * episodes not — which is what moves it from watched back to watching.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  countWatched,
  fillInOrder,
  seasonLength,
  totalEpisodes,
  watchedInSeason,
} from '../src/utils/episodes.js';
import { derivedStatus } from '../src/utils/watchStatus.js';
import { fetchShow, seasonEpisodeCounts } from './tmdb-shows.js';

const DATA_PATH = resolve(process.cwd(), 'src/data/cinema.json');
const REQUEST_GAP_MS = 120;
const dryRun = process.argv.includes('--dry');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * A watch record for a show that never got one, in broadcast order.
 *
 * A watched show is filled to the total it had *before* this refresh, not to
 * the new one — otherwise the season that just landed would arrive pre-ticked
 * and the show would never leave WATCHED.
 */
function seedWatched(entry, seasonEpisodes, previousTotal) {
  if (entry.status === 'watchlist') return {};
  if (entry.status === 'watched') return fillInOrder(seasonEpisodes, previousTotal);
  return fillInOrder(seasonEpisodes, toCount(entry.episodesSeen));
}

/**
 * Drop anything the new season shape can no longer hold. TMDB does re-cut
 * seasons (a split season merged, a season renumbered), and an episode number
 * left pointing past the end would inflate the count that decides the status.
 */
function clampWatched(watchedEpisodes, seasonEpisodes) {
  const clamped = {};
  let dropped = 0;

  for (const key of Object.keys(watchedEpisodes || {})) {
    const season = Number(key);
    const length = seasonLength(seasonEpisodes, season);
    const seen = watchedInSeason(watchedEpisodes, season);

    if (!Number.isInteger(season) || season < 1 || length === 0) {
      dropped += seen.length;
      continue;
    }

    const kept = seen.filter((episode) => episode <= length);
    dropped += seen.length - kept.length;
    if (kept.length > 0) clamped[String(season)] = kept;
  }

  return { clamped, dropped };
}

async function main() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error(
      'TMDB_API_KEY missing — run with: node --env-file=.env scripts/refresh-cinema-shows.js',
    );
    process.exit(1);
  }

  const data = JSON.parse(await readFile(DATA_PATH, 'utf-8'));
  const shows = data.entries.filter((e) => e.mediaType === 'tv' && e.tmdbId);
  console.log(`${shows.length} shows to check\n`);

  const changes = [];
  let failed = 0;

  for (const entry of shows) {
    try {
      const show = await fetchShow(entry.tmdbId, apiKey);
      const seasonEpisodes = seasonEpisodeCounts(show);
      const total = totalEpisodes(seasonEpisodes);

      if (total === 0) {
        // TMDB knows the show but has no season breakdown yet — leaving the
        // entry alone beats wiping the counts it already has.
        console.error(`  ${entry.title.padEnd(28).slice(0, 28)} SKIPPED — no season data upstream`);
        await sleep(REQUEST_GAP_MS);
        continue;
      }

      const previousTotal = totalEpisodes(entry.seasonEpisodes) || toCount(entry.episodes);
      const previousSeasons = toCount(entry.seasons);
      const previousStatus = entry.status;

      const record = entry.watchedEpisodes || seedWatched(entry, seasonEpisodes, previousTotal);
      const { clamped, dropped } = clampWatched(record, seasonEpisodes);

      entry.seasonEpisodes = seasonEpisodes;
      entry.seasons = seasonEpisodes.length;
      entry.episodes = total;
      entry.watchedEpisodes = clamped;
      entry.episodesSeen = countWatched(clamped);
      entry.status = derivedStatus(entry);

      const notes = [];
      if (total !== previousTotal) notes.push(`${previousTotal} → ${total} eps`);
      if (seasonEpisodes.length !== previousSeasons) {
        notes.push(`${previousSeasons} → ${seasonEpisodes.length} seasons`);
      }
      if (dropped > 0) notes.push(`${dropped} tick(s) dropped as out of range`);
      if (entry.status !== previousStatus) notes.push(`${previousStatus} → ${entry.status}`);

      if (notes.length > 0) {
        changes.push(`${entry.title.padEnd(28).slice(0, 28)} ${notes.join('  ·  ')}`);
      }
    } catch (err) {
      failed += 1;
      console.error(`  ${entry.title.padEnd(28).slice(0, 28)} FAILED — ${err.message}`);
    }

    await sleep(REQUEST_GAP_MS);
  }

  if (changes.length === 0) {
    console.log('Nothing moved — every show already matches TMDB.');
  } else {
    console.log(`Updated ${changes.length} show(s):`);
    changes.forEach((line) => console.log(`  ${line}`));
  }
  if (failed > 0) console.log(`\n${failed} show(s) could not be fetched and were left untouched.`);

  if (dryRun) {
    console.log('\n--dry: nothing written.');
    return;
  }

  await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  console.log(`\nWrote ${DATA_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
