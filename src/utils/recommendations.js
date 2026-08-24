/**
 * Taste profiling and candidate filtering for the admin-only RECOMMENDED tab.
 *
 * Pure on purpose — no fetching lives here, so the scoring can be reasoned
 * about (and changed) without touching the network layer.
 *
 * On the signal used: cinema.json has a `rating` field but every entry leaves
 * it empty, so "things you rated highly" has nothing to read. The stand-ins are
 * the `featured` favourites, weighted heavily because flagging one is a
 * deliberate act, and the much larger `watched` pile as the broad signal. If
 * ratings ever get filled in, this is the only function that needs to change.
 */

const GENRE_WEIGHTS = {
  featured: 3,
  watched: 1,
  watching: 1,
};

/** Statuses that say something about taste. A watchlist entry is an intention, not evidence. */
const SEEN = new Set(['watched', 'watching']);

/**
 * Pick `count` items spread evenly across a list rather than taking the head.
 *
 * The library is roughly alphabetical, so slicing the front would seed every
 * refresh from the same handful of A-titles.
 */
function spread(list, count) {
  if (list.length <= count) return [...list];
  const stride = list.length / count;
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(list[Math.floor(i * stride)]);
  }
  return out;
}

/**
 * What this library says about its owner: the genres worth searching and the
 * titles worth asking TMDB for lookalikes of.
 */
export function buildTasteProfile(entries, { maxGenres = 3, maxSeeds = 15 } = {}) {
  const weights = new Map();

  for (const entry of entries) {
    const weight =
      (entry.featured ? GENRE_WEIGHTS.featured : 0) +
      (SEEN.has(entry.status) ? GENRE_WEIGHTS[entry.status] : 0);
    if (weight === 0) continue;

    for (const genre of entry.genres || []) {
      const name = String(genre ?? '').trim();
      if (name) weights.set(name, (weights.get(name) || 0) + weight);
    }
  }

  const genres = [...weights.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxGenres)
    .map(([name]) => name);

  const seedable = (e) => e.tmdbId && (e.featured || SEEN.has(e.status));
  const favourites = entries.filter((e) => e.featured && e.tmdbId);
  const favouriteIds = new Set(favourites.map((e) => e.tmdbId));
  const rest = entries.filter((e) => seedable(e) && !favouriteIds.has(e.tmdbId));

  // Favourites always seed; whatever budget is left goes to the watched pile.
  const seeds = [...favourites, ...spread(rest, Math.max(0, maxSeeds - favourites.length))]
    .slice(0, maxSeeds)
    .map((e) => ({ tmdbId: e.tmdbId, mediaType: e.mediaType === 'tv' ? 'tv' : 'movie', title: e.title }));

  return { genres, seeds };
}

/** Every tmdbId already logged, whatever its status. */
export function knownTmdbIds(entries) {
  return new Set(entries.map((e) => e.tmdbId).filter(Boolean));
}

/**
 * Drop anything already in the library, already dismissed, or claimed by an
 * earlier section in this batch.
 *
 * Stops at `limit` rather than filtering everything and slicing afterwards:
 * `seenIds` is shared across sections, so consuming candidates that were never
 * going to be shown would quietly starve the sections that come after.
 */
export function filterCandidates(
  candidates,
  knownIds,
  dismissedIds,
  seenIds = new Set(),
  limit = Infinity,
) {
  const out = [];
  for (const item of candidates) {
    if (out.length >= limit) break;
    if (!item?.tmdbId) continue;
    if (knownIds.has(item.tmdbId) || dismissedIds.has(item.tmdbId) || seenIds.has(item.tmdbId)) {
      continue;
    }
    seenIds.add(item.tmdbId);
    out.push(item);
  }
  return out;
}

/**
 * Release window for the "acclaimed classics" search: everything up to
 * `beforeYear`, which keeps it clear of the new-releases section.
 */
export function classicsWindow(beforeYear = 2010) {
  return { from: '1950-01-01', to: `${beforeYear}-12-31` };
}
