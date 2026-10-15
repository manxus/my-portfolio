/**
 * Pull TMDB's audience rating onto every cinema entry, and fill in any runtime
 * the entry is missing.
 *
 * Usage:
 *   node --env-file=.env scripts/refresh-cinema-ratings.js          # write
 *   node --env-file=.env scripts/refresh-cinema-ratings.js --dry    # report only
 *   npm run cinema:ratings -- --dry
 *
 * Env:
 *   TMDB_API_KEY   TMDB v3 API key (same one the admin title picker uses)
 *
 * Outputs:
 *   src/data/cinema.json   tmdbRating (0–10, one decimal) and tmdbVotes on every
 *                          entry with a tmdbId; runtime where it was empty
 *
 * Ratings drift as votes come in, so this is meant to be re-run now and then.
 * A runtime already on the entry is left alone — it may have been set by hand.
 * For shows it is minutes per episode: episode_run_time when TMDB still has
 * it, otherwise the latest aired episode's runtime.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DATA_PATH = resolve(process.cwd(), 'src/data/cinema.json');
const REQUEST_GAP_MS = 85;
const dryRun = process.argv.includes('--dry');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function fetchTitle(tmdbId, mediaType, apiKey) {
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?${new URLSearchParams({
    api_key: apiKey,
    language: 'en-US',
  })}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

/** Mirrors ratingFields in dev-api/tmdb.cjs. */
function ratingFields(item) {
  const votes = Number(item.vote_count) || 0;
  const average = Number(item.vote_average);
  return {
    tmdbRating: votes > 0 && Number.isFinite(average) ? Math.round(average * 10) / 10 : null,
    tmdbVotes: votes,
  };
}

function runtimeOf(item, mediaType) {
  if (mediaType !== 'tv') return toCount(item.runtime);
  const listed = Array.isArray(item.episode_run_time) ? item.episode_run_time[0] : 0;
  return toCount(listed) || toCount(item.last_episode_to_air?.runtime);
}

async function main() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error(
      'TMDB_API_KEY missing — run with: node --env-file=.env scripts/refresh-cinema-ratings.js',
    );
    process.exit(1);
  }

  const data = JSON.parse(await readFile(DATA_PATH, 'utf-8'));
  const entries = data.entries.filter((e) => e.tmdbId);
  console.log(`${entries.length} titles to check\n`);

  let rated = 0;
  let changedRatings = 0;
  let runtimesFilled = 0;
  let failed = 0;
  const unrated = [];

  for (const entry of entries) {
    try {
      const item = await fetchTitle(entry.tmdbId, entry.mediaType, apiKey);
      const { tmdbRating, tmdbVotes } = ratingFields(item);

      if (tmdbRating !== entry.tmdbRating) changedRatings += 1;
      entry.tmdbRating = tmdbRating;
      entry.tmdbVotes = tmdbVotes;
      if (tmdbRating != null) rated += 1;
      else unrated.push(entry.title);

      if (!toCount(entry.runtime)) {
        const runtime = runtimeOf(item, entry.mediaType);
        if (runtime) {
          entry.runtime = runtime;
          runtimesFilled += 1;
        }
      }
    } catch (err) {
      failed += 1;
      console.error(`  ${String(entry.title).padEnd(28).slice(0, 28)} FAILED — ${err.message}`);
    }

    await sleep(REQUEST_GAP_MS);
  }

  console.log(`Rated ${rated}/${entries.length} (${changedRatings} new or changed).`);
  console.log(`Filled ${runtimesFilled} missing runtime(s).`);
  if (unrated.length > 0) console.log(`No TMDB votes yet: ${unrated.join(', ')}`);
  if (failed > 0) console.log(`\n${failed} title(s) could not be fetched and were left untouched.`);

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
