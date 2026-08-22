/**
 * One-off migration: give every tracked show per-season episode counts and a
 * per-episode watch record, so the Cinema page can say which episode to resume
 * on instead of only how many have been seen.
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-cinema-episodes.js          # write
 *   node --env-file=.env scripts/backfill-cinema-episodes.js --dry    # report only
 *
 * Env:
 *   TMDB_API_KEY   TMDB v3 API key (same one the admin title picker uses)
 *
 * Outputs:
 *   src/data/cinema.json   seasonEpisodes[] and watchedEpisodes{} on every tv entry
 *
 * The watch record is seeded in broadcast order from the existing episodesSeen
 * total: a show marked watched gets everything ticked, one in progress gets its
 * first N episodes, and a queued one gets nothing. That seed is an assumption --
 * it is right only if the running total was itself kept in order -- so anything
 * it gets wrong is meant to be corrected episode by episode in the admin editor.
 *
 * Specials are excluded throughout. TMDB files them as season 0 and leaves them
 * out of number_of_episodes, so counting them would put every derived position
 * out by however many specials a show has (27 of them for Family Guy).
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  countWatched,
  fillAll,
  fillInOrder,
  formatEpisodeCode,
  nextEpisode,
  totalEpisodes,
} from '../src/utils/episodes.js';

const DATA_PATH = resolve(process.cwd(), 'src/data/cinema.json');
const REQUEST_GAP_MS = 120;
const dryRun = process.argv.includes('--dry');

function seasonEpisodeCounts(show) {
  if (!Array.isArray(show.seasons)) return [];
  return show.seasons
    .filter((s) => Number(s.season_number) > 0)
    .sort((a, b) => Number(a.season_number) - Number(b.season_number))
    .map((s) => Number(s.episode_count) || 0);
}

async function fetchShow(tmdbId, apiKey) {
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}?${new URLSearchParams({
    api_key: apiKey,
    language: 'en-US',
  })}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error('TMDB_API_KEY missing — run with: node --env-file=.env scripts/backfill-cinema-episodes.js');
    process.exit(1);
  }

  const data = JSON.parse(await readFile(DATA_PATH, 'utf-8'));
  const shows = data.entries.filter((e) => e.mediaType === 'tv' && e.tmdbId);
  console.log(`${shows.length} shows to sync\n`);

  const mismatches = [];
  let failed = 0;

  for (const entry of shows) {
    try {
      const show = await fetchShow(entry.tmdbId, apiKey);
      const seasonEpisodes = seasonEpisodeCounts(show);
      const total = totalEpisodes(seasonEpisodes);

      // Prefer the per-season sum: it is the only total the tracker can address.
      if (entry.episodes && entry.episodes !== total) {
        mismatches.push(`${entry.title}: stored ${entry.episodes}, seasons sum to ${total}`);
      }

      const previouslySeen = Number(entry.episodesSeen) || 0;
      let watchedEpisodes;
      if (entry.status === 'watched') watchedEpisodes = fillAll(seasonEpisodes);
      else if (entry.status === 'watchlist') watchedEpisodes = {};
      else watchedEpisodes = fillInOrder(seasonEpisodes, previouslySeen);

      entry.seasonEpisodes = seasonEpisodes;
      entry.watchedEpisodes = watchedEpisodes;
      entry.episodes = total;
      entry.episodesSeen = countWatched(watchedEpisodes);

      const next = nextEpisode(seasonEpisodes, watchedEpisodes);
      const where = next ? `next ${formatEpisodeCode(next)}` : 'complete';
      console.log(
        `  ${entry.title.padEnd(28).slice(0, 28)} ${String(entry.episodesSeen).padStart(4)}/${String(total).padEnd(5)} ${where}`,
      );
    } catch (err) {
      failed += 1;
      console.error(`  ${entry.title.padEnd(28).slice(0, 28)} FAILED — ${err.message}`);
    }

    await sleep(REQUEST_GAP_MS);
  }

  if (mismatches.length > 0) {
    console.log(`\nEpisode totals corrected from the per-season sums (${mismatches.length}):`);
    mismatches.forEach((m) => console.log(`  ${m}`));
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
