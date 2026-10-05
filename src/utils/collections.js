/**
 * Franchise grouping for movies.
 *
 * TMDB answers this two ways and neither is enough alone. `belongs_to_collection`
 * is precise but narrow — it files the MCU under seven separate collections
 * (Iron Man, Thor, The Avengers, ...) rather than one. The shared-universe
 * keywords are broad but only exist for a handful of franchises. So a universe
 * wins where TMDB tags one, and the collection is the fallback.
 */

const UNIVERSE_KEYWORD = /cinematic universe|extended universe/i;

/** Keyword names arrive lowercased and parenthesised; these two are all TMDB has. */
const UNIVERSE_NAMES = {
  'marvel cinematic universe (mcu)': 'Marvel Cinematic Universe',
  'dc extended universe (dceu)': 'DC Extended Universe',
};

function titleCase(value) {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** "The Fast and the Furious Collection" -> "The Fast and the Furious" */
export function tidyCollectionName(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (UNIVERSE_NAMES[value.toLowerCase()]) return UNIVERSE_NAMES[value.toLowerCase()];

  const stripped = value.replace(/\s+Collection$/i, '').trim();
  return stripped === stripped.toLowerCase() ? titleCase(stripped) : stripped;
}

/** Pick the franchise name from a TMDB movie payload with keywords appended. */
export function collectionFromTmdb(movie) {
  const keywords = (movie.keywords && movie.keywords.keywords) || [];
  const universe = keywords.map((k) => k.name).find((name) => UNIVERSE_KEYWORD.test(name));
  if (universe) return tidyCollectionName(universe);
  return movie.belongs_to_collection ? tidyCollectionName(movie.belongs_to_collection.name) : '';
}

export const STANDALONE_LABEL = 'STANDALONE';

/** Statuses that count as "you have seen this". Mirrors the Cinema page's reading. */
const SEEN_STATUSES = new Set(['watched', 'watching']);

function isMovie(entry) {
  return entry.mediaType !== 'tv';
}

/**
 * How far through each franchise the library is.
 *
 * Movies only — no tv entry carries a `collection`, because TMDB's
 * belongs_to_collection is a movie-only field.
 */
export function franchiseProgress(entries) {
  const progress = new Map();

  for (const entry of entries) {
    const name = String(entry.collection ?? '').trim();
    if (!name || !isMovie(entry)) continue;

    if (!progress.has(name)) {
      progress.set(name, { name, watched: 0, total: 0, seedTmdbId: null });
    }
    const row = progress.get(name);
    row.total += 1;
    if (SEEN_STATUSES.has(entry.status)) {
      row.watched += 1;
      // Seed from a film actually watched — the surest sign the id is real.
      if (!row.seedTmdbId && entry.tmdbId) row.seedTmdbId = entry.tmdbId;
    }
    if (!row.seedTmdbId && entry.tmdbId) row.seedTmdbId = entry.tmdbId;
  }

  return progress;
}

/**
 * Watchlist entries that would carry a franchise further along, keyed by tmdbId.
 * A franchise nobody has started yet is a new commitment, not a loose end.
 */
export function unfinishedFranchiseIds(entries) {
  const progress = franchiseProgress(entries);
  const ids = new Set();

  for (const entry of entries) {
    const name = String(entry.collection ?? '').trim();
    if (!name || entry.status !== 'watchlist' || !entry.tmdbId) continue;
    if ((progress.get(name)?.watched ?? 0) > 0) ids.add(entry.tmdbId);
  }

  return ids;
}

/**
 * Split a list into franchise sections, largest first, with everything left over
 * in one trailing bucket. A franchise the library only holds one film from is
 * not a franchise worth a heading, so those fall through to the bucket too.
 */
export function groupByCollection(list) {
  const buckets = new Map();
  const loose = [];

  for (const entry of list) {
    const name = String(entry.collection ?? '').trim();
    if (!name) {
      loose.push(entry);
      continue;
    }
    if (!buckets.has(name)) buckets.set(name, []);
    buckets.get(name).push(entry);
  }

  const groups = [];
  for (const [name, items] of buckets) {
    if (items.length > 1) groups.push({ id: `collection:${name}`, label: name.toUpperCase(), items });
    else loose.push(...items);
  }

  groups.sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
  if (loose.length > 0) {
    groups.push({ id: 'collection:standalone', label: STANDALONE_LABEL, items: loose });
  }
  return groups;
}
