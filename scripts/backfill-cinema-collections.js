/**
 * One-off migration: tag every movie with the franchise it belongs to, so the
 * Cinema page can group the grid by collection.
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-cinema-collections.js         # write
 *   node --env-file=.env scripts/backfill-cinema-collections.js --dry   # report only
 *
 * Env:
 *   TMDB_API_KEY   TMDB v3 API key (same one the admin title picker uses)
 *
 * Outputs:
 *   src/data/cinema.json   a `collection` name on every movie that has one
 *
 * Shows are skipped: belongs_to_collection is a movie-only field on TMDB.
 *
 * The interesting case is Marvel. TMDB files the MCU under seven separate
 * collections, so grouping on belongs_to_collection alone would scatter it --
 * the shared-universe keyword is what pulls those back together, and it also
 * draws the line correctly, excluding Sony's Spider-Man and Fox's Deadpool,
 * which are Marvel characters but not MCU films.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { collectionFromTmdb } from '../src/utils/collections.js';

const DATA_PATH = resolve(process.cwd(), 'src/data/cinema.json');
const REQUEST_GAP_MS = 85;
const dryRun = process.argv.includes('--dry');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchMovie(tmdbId, apiKey) {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?${new URLSearchParams({
    api_key: apiKey,
    append_to_response: 'keywords',
  })}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

async function main() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error('TMDB_API_KEY missing — run with: node --env-file=.env scripts/backfill-cinema-collections.js');
    process.exit(1);
  }

  const data = JSON.parse(await readFile(DATA_PATH, 'utf-8'));
  const movies = data.entries.filter((e) => e.mediaType !== 'tv' && e.tmdbId);
  console.log(`${movies.length} movies to scan\n`);

  const counts = new Map();
  let tagged = 0;
  let failed = 0;

  for (const entry of movies) {
    try {
      const collection = collectionFromTmdb(await fetchMovie(entry.tmdbId, apiKey));
      if (collection) {
        entry.collection = collection;
        tagged += 1;
        counts.set(collection, (counts.get(collection) || 0) + 1);
      } else {
        delete entry.collection;
      }
    } catch (err) {
      failed += 1;
      console.error(`  ${entry.title.padEnd(34).slice(0, 34)} FAILED — ${err.message}`);
    }
    await sleep(REQUEST_GAP_MS);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const franchises = ranked.filter(([, n]) => n > 1);

  console.log(`${tagged} of ${movies.length} movies tagged`);
  console.log(`${franchises.length} franchises with 2+ films; ${ranked.length - franchises.length} with only one (these show as standalone)\n`);
  franchises.slice(0, 15).forEach(([name, n]) => console.log(`  ${String(n).padStart(3)}  ${name}`));
  if (franchises.length > 15) console.log(`  ... and ${franchises.length - 15} more`);
  if (failed > 0) console.log(`\n${failed} movie(s) could not be fetched and were left untouched.`);

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
