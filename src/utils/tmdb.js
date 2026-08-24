/**
 * Search movies/shows via the /api/tmdb proxy (The Movie Database).
 */

async function readError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export async function searchTitles(query, signal) {
  const q = String(query ?? '').trim();
  if (q.length < 2) return [];

  const res = await fetch(`/api/tmdb?${new URLSearchParams({ q })}`, { signal });
  if (!res.ok) {
    throw new Error(await readError(res, 'Title search failed'));
  }

  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

export async function fetchTitleDetails(tmdbId, mediaType, signal) {
  const res = await fetch(
    `/api/tmdb?${new URLSearchParams({ id: String(tmdbId), type: mediaType })}`,
    { signal },
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load title details'));
  }

  return res.json();
}

/* ---------- discovery, for the admin-only RECOMMENDED tab ---------- */

async function fetchDiscovery(params, signal, fallbackError) {
  const res = await fetch(`/api/tmdb?${new URLSearchParams(params)}`, { signal });
  if (!res.ok) {
    throw new Error(await readError(res, fallbackError));
  }

  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

/** One of TMDB's curated lists, e.g. now_playing / upcoming / on_the_air. */
export function fetchCuratedList(list, mediaType, signal) {
  return fetchDiscovery(
    { mode: 'list', list, type: mediaType },
    signal,
    `Failed to load ${list.replace(/_/g, ' ')}`,
  );
}

/** Titles TMDB considers similar to one you already like. */
export function fetchRecommendations(tmdbId, mediaType, signal) {
  return fetchDiscovery(
    { mode: 'recommendations', id: String(tmdbId), type: mediaType },
    signal,
    'Failed to load recommendations',
  );
}

/**
 * Every film in a franchise, so the caller can spot the ones it is missing.
 *
 * Pass `keywordId` for a shared universe (the MCU, the DCEU) — those are named
 * after a TMDB keyword and have no collection to look up. Everything else
 * resolves from `seedTmdbId`, a film the library already holds.
 */
export function fetchFranchiseParts({ seedTmdbId, keywordId }, signal) {
  const params = { mode: 'franchise', type: 'movie' };
  if (keywordId) params.keyword = String(keywordId);
  else params.id = String(seedTmdbId);

  return fetchDiscovery(params, signal, 'Failed to load franchise');
}

/**
 * Discover by genre and/or release window.
 *
 * `genres` are TMDB genre *names* (what cinema.json stores) — the proxy maps
 * them to ids. `sort` accepts 'rating' or 'popularity'.
 */
export function fetchDiscover({ mediaType, genres, from, to, minVotes, minRating, sort }, signal) {
  const params = { mode: 'discover', type: mediaType };
  if (genres?.length) params.genres = genres.join(',');
  if (from) params.from = from;
  if (to) params.to = to;
  if (minVotes) params.minVotes = String(minVotes);
  if (minRating) params.minRating = String(minRating);
  if (sort) params.sort = sort;

  return fetchDiscovery(params, signal, 'Failed to load suggestions');
}
