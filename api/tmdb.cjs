const TMDB_API = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';
const POSTER_SIZE = 'w500';
const BACKDROP_SIZE = 'w780';
const SEARCH_LIMIT = 8;

function imageUrl(path, size) {
  if (!path) return '';
  return `${IMAGE_BASE}/${size}${path}`;
}

function yearOf(dateString) {
  const value = String(dateString ?? '').trim();
  return /^\d{4}/.test(value) ? value.slice(0, 4) : '';
}

function titleOf(item) {
  return String(item.title || item.name || '').trim();
}

function releaseDateOf(item) {
  return item.release_date || item.first_air_date || '';
}

function tmdbUrl(mediaType, id) {
  return `https://www.themoviedb.org/${mediaType}/${id}`;
}

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Franchise name for a movie. Mirrors src/utils/collections.js, which the page
 * and the backfill script share — this file is CommonJS and can't import it.
 *
 * belongs_to_collection files the MCU under seven separate collections, so the
 * shared-universe keyword wins where TMDB provides one.
 */
const UNIVERSE_NAMES = {
  'marvel cinematic universe (mcu)': 'Marvel Cinematic Universe',
  'dc extended universe (dceu)': 'DC Extended Universe',
};

function collectionName(item) {
  const keywords = (item.keywords && item.keywords.keywords) || [];
  const universe = keywords
    .map((k) => String(k.name ?? ''))
    .find((name) => /cinematic universe|extended universe/i.test(name));

  const raw = universe || (item.belongs_to_collection ? item.belongs_to_collection.name : '');
  const value = String(raw).trim();
  if (!value) return '';
  if (UNIVERSE_NAMES[value.toLowerCase()]) return UNIVERSE_NAMES[value.toLowerCase()];

  const stripped = value.replace(/\s+Collection$/i, '').trim();
  return stripped === stripped.toLowerCase()
    ? stripped.replace(/\b[a-z]/g, (c) => c.toUpperCase())
    : stripped;
}

/**
 * Episodes per season, index 0 = season 1. Season 0 is TMDB's specials bucket and
 * is excluded from `number_of_episodes`, so dropping it here keeps this array
 * summing to the show's stated total.
 */
function seasonEpisodeCounts(item) {
  if (!Array.isArray(item.seasons)) return [];
  return item.seasons
    .filter((s) => Number(s.season_number) > 0)
    .sort((a, b) => Number(a.season_number) - Number(b.season_number))
    .map((s) => Number(s.episode_count) || 0);
}

/**
 * Compact shape for the search dropdown and the recommendation grid.
 *
 * /discover and the curated lists carry no media_type, so callers that already
 * know which endpoint they hit pass `forcedType` rather than letting the
 * media_type check quietly settle on 'movie'.
 */
function mapSearchResult(item, forcedType) {
  const mediaType = forcedType || (item.media_type === 'tv' ? 'tv' : 'movie');
  return {
    tmdbId: item.id,
    mediaType,
    title: titleOf(item),
    year: yearOf(releaseDateOf(item)),
    posterUrl: imageUrl(item.poster_path, POSTER_SIZE),
    overview: String(item.overview ?? '').trim(),
    voteAverage: Number(item.vote_average) || 0,
    voteCount: Number(item.vote_count) || 0,
  };
}

/** Full field patch written into a cinema entry. */
function mapDetails(item, mediaType) {
  const genres = Array.isArray(item.genres)
    ? item.genres.map((g) => String(g.name ?? '').trim()).filter(Boolean)
    : [];

  const patch = {
    tmdbId: item.id,
    mediaType,
    title: titleOf(item),
    year: yearOf(releaseDateOf(item)),
    genres,
    overview: String(item.overview ?? '').trim(),
    coverUrl: imageUrl(item.poster_path, POSTER_SIZE),
    backdropUrl: imageUrl(item.backdrop_path, BACKDROP_SIZE),
    tmdbUrl: tmdbUrl(mediaType, item.id),
  };

  if (mediaType === 'tv') {
    patch.seasons = toNumberOrNull(item.number_of_seasons);
    patch.episodes = toNumberOrNull(item.number_of_episodes);
    patch.seasonEpisodes = seasonEpisodeCounts(item);
    patch.runtime = toNumberOrNull(
      Array.isArray(item.episode_run_time) ? item.episode_run_time[0] : null,
    );
  } else {
    patch.runtime = toNumberOrNull(item.runtime);
    patch.collection = collectionName(item);
  }

  return patch;
}

async function fetchTmdb(path, params, apiKey) {
  const url = `${TMDB_API}${path}?${new URLSearchParams({
    api_key: apiKey,
    language: 'en-US',
    ...params,
  })}`;

  const upstream = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!upstream.ok) {
    throw new Error(`TMDB failed (${upstream.status})`);
  }
  return upstream.json();
}

/* ---------- discovery (the admin-only RECOMMENDED tab) ---------- */

const DISCOVERY_LIMIT = 20;

/**
 * Curated lists, allowlisted per type so `list` can never be used to reach an
 * arbitrary path under /movie or /tv.
 */
const CURATED_LISTS = {
  movie: new Set(['now_playing', 'upcoming', 'top_rated', 'popular']),
  tv: new Set(['on_the_air', 'airing_today', 'top_rated', 'popular']),
};

/**
 * TMDB genre ids, keyed by the genre names it returns — cinema.json stores the
 * names, so this is what turns a taste profile back into a discover query.
 * Movies and shows use different vocabularies (a show has no "Science Fiction",
 * it has "Sci-Fi & Fantasy"), hence two maps.
 */
const GENRE_IDS = {
  movie: {
    Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80,
    Documentary: 99, Drama: 18, Family: 10751, Fantasy: 14, History: 36,
    Horror: 27, Music: 10402, Mystery: 9648, Romance: 10749,
    'Science Fiction': 878, 'TV Movie': 10770, Thriller: 53, War: 10752,
    Western: 37,
  },
  tv: {
    'Action & Adventure': 10759, Animation: 16, Comedy: 35, Crime: 80,
    Documentary: 99, Drama: 18, Family: 10751, Kids: 10762, Mystery: 9648,
    News: 10763, Reality: 10764, 'Sci-Fi & Fantasy': 10765, Soap: 10766,
    Talk: 10767, 'War & Politics': 10768, Western: 37,
  },
};

/** Movie-only genre names mapped onto their nearest show equivalent. */
const TV_GENRE_ALIASES = {
  Action: 'Action & Adventure',
  Adventure: 'Action & Adventure',
  'Science Fiction': 'Sci-Fi & Fantasy',
  Fantasy: 'Sci-Fi & Fantasy',
  War: 'War & Politics',
};

function genreIdsFor(names, type) {
  const table = GENRE_IDS[type];
  const ids = [];
  for (const raw of names) {
    const name = String(raw ?? '').trim();
    if (!name) continue;
    const key = type === 'tv' && !table[name] ? TV_GENRE_ALIASES[name] : name;
    const id = table[key];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** The release-date field discover uses differs per type. */
function dateKeys(type) {
  return type === 'tv'
    ? ['first_air_date.gte', 'first_air_date.lte']
    : ['primary_release_date.gte', 'primary_release_date.lte'];
}

function discoverParams(searchParams, type) {
  const params = {
    include_adult: 'false',
    page: '1',
    sort_by: (searchParams.get('sort') || '').trim() === 'rating'
      ? 'vote_average.desc'
      : 'popularity.desc',
  };

  const genres = (searchParams.get('genres') || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
  const ids = genreIdsFor(genres, type);
  if (ids.length > 0) params.with_genres = ids.join('|');

  const [gte, lte] = dateKeys(type);
  const from = (searchParams.get('from') || '').trim();
  const to = (searchParams.get('to') || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) params[gte] = from;
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) params[lte] = to;

  // A vote floor is what separates an acclaimed film from one with a single
  // 10/10 rating; sort_by=vote_average.desc is meaningless without it.
  const minVotes = Number(searchParams.get('minVotes'));
  params['vote_count.gte'] = String(Number.isFinite(minVotes) && minVotes > 0 ? minVotes : 300);

  const minRating = Number(searchParams.get('minRating'));
  if (Number.isFinite(minRating) && minRating > 0) {
    params['vote_average.gte'] = String(minRating);
  }

  return params;
}

/* ---------- franchise gaps ---------- */

const GENRE_DOCUMENTARY = 99;
/** Keyword results carry shorts and making-ofs; a collection is already curated. */
const KEYWORD_MIN_VOTES = 200;
const COLLECTION_MIN_VOTES = 50;

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Something you could actually watch tonight. Franchises are full of announced
 * sequels with no date ("Untitled Jurassic World Rebirth Sequel"), tie-in
 * documentaries, and Marvel's one-shot shorts — none of them a film to suggest.
 */
function releasedFeature(item, minVotes) {
  const date = String(item.release_date || '').trim();
  if (!date || date > today()) return false;
  if (Array.isArray(item.genre_ids) && item.genre_ids.includes(GENRE_DOCUMENTARY)) return false;
  return Number(item.vote_count) >= minVotes;
}

/**
 * Every film in a seed film's collection.
 *
 * Resolving from a film the library already holds is exact. Matching on the
 * stored franchise name would not be: tidyCollectionName strips the trailing
 * " Collection", and names like "The Hunger Games – New Trilogy" would never
 * round-trip through /search/collection.
 */
async function franchiseBySeed(seedId, apiKey) {
  const movie = await fetchTmdb(`/movie/${seedId}`, {}, apiKey);
  const collection = movie && movie.belongs_to_collection;
  // Most films belong to no collection at all — an empty answer, not a failure.
  if (!collection) return [];

  const data = await fetchTmdb(`/collection/${collection.id}`, {}, apiKey);
  return (Array.isArray(data.parts) ? data.parts : [])
    .filter((part) => releasedFeature(part, COLLECTION_MIN_VOTES))
    .map((part) => mapSearchResult(part, 'movie'));
}

/**
 * Shared universes (the MCU, the DCEU) are named after a TMDB *keyword*, not a
 * collection, so they have to be enumerated the same way they were named.
 */
async function franchiseByKeyword(keywordId, apiKey) {
  const data = await fetchTmdb(
    '/discover/movie',
    {
      with_keywords: keywordId,
      sort_by: 'popularity.desc',
      'release_date.lte': today(),
      'vote_count.gte': String(KEYWORD_MIN_VOTES),
      without_genres: String(GENRE_DOCUMENTARY),
      include_adult: 'false',
      page: '1',
    },
    apiKey,
  );

  return (Array.isArray(data.results) ? data.results : []).map((item) =>
    mapSearchResult(item, 'movie'),
  );
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error: 'TMDB not configured — set TMDB_API_KEY in .env and restart the dev server.',
      }),
    );
  }

  const requestUrl = new URL(req.url, 'http://localhost');
  const id = (requestUrl.searchParams.get('id') || '').trim();
  const q = (requestUrl.searchParams.get('q') || '').trim();

  res.setHeader('Content-Type', 'application/json');

  // Discovery modes, for the admin-only RECOMMENDED tab. Checked before the
  // details mode because `recommendations` carries an id of its own. All three
  // return the same compact { results } shape the search dropdown consumes.
  const mode = (requestUrl.searchParams.get('mode') || '').trim();
  if (mode) {
    const type = (requestUrl.searchParams.get('type') || '').trim();
    if (type !== 'movie' && type !== 'tv') {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'type must be "movie" or "tv"' }));
    }

    // Franchise gaps take two upstream calls and a bespoke filter, so they are
    // resolved here rather than through the single-fetch path below.
    if (mode === 'franchise') {
      const keyword = (requestUrl.searchParams.get('keyword') || '').trim();
      if (keyword && !/^\d+$/.test(keyword)) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Invalid keyword' }));
      }
      if (!keyword && !/^\d+$/.test(id)) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'franchise needs an id or a keyword' }));
      }

      try {
        const results = keyword
          ? await franchiseByKeyword(keyword, apiKey)
          : await franchiseBySeed(id, apiKey);
        res.statusCode = 200;
        return res.end(JSON.stringify({ results }));
      } catch (err) {
        console.error('[tmdb]', err);
        res.statusCode = 502;
        return res.end(JSON.stringify({ error: 'Failed to load franchise' }));
      }
    }

    let path;
    let params;

    if (mode === 'list') {
      const list = (requestUrl.searchParams.get('list') || '').trim();
      if (!CURATED_LISTS[type].has(list)) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: `Unknown list for ${type}` }));
      }
      path = `/${type}/${list}`;
      params = { page: '1' };
    } else if (mode === 'recommendations') {
      if (!/^\d+$/.test(id)) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Invalid id' }));
      }
      path = `/${type}/${id}/recommendations`;
      params = { page: '1' };
    } else if (mode === 'discover') {
      path = `/discover/${type}`;
      params = discoverParams(requestUrl.searchParams, type);
    } else {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Unknown mode' }));
    }

    try {
      const data = await fetchTmdb(path, params, apiKey);
      const results = (Array.isArray(data.results) ? data.results : [])
        .map((item) => mapSearchResult(item, type))
        // A recommendation card is mostly its poster, so drop the artless ones.
        .filter((item) => item.title && item.posterUrl)
        .slice(0, DISCOVERY_LIMIT);

      res.statusCode = 200;
      return res.end(JSON.stringify({ results }));
    } catch (err) {
      console.error('[tmdb]', err);
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: 'Failed to load recommendations' }));
    }
  }

  // Details mode: /api/tmdb?id=<tmdbId>&type=<movie|tv>
  if (id) {
    const type = (requestUrl.searchParams.get('type') || '').trim();
    if (!/^\d+$/.test(id)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Invalid id' }));
    }
    if (type !== 'movie' && type !== 'tv') {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'type must be "movie" or "tv"' }));
    }

    try {
      // keywords carry the shared-universe tag that groups the MCU together.
      const data = await fetchTmdb(`/${type}/${id}`, { append_to_response: 'keywords' }, apiKey);
      res.statusCode = 200;
      return res.end(JSON.stringify(mapDetails(data, type)));
    } catch (err) {
      console.error('[tmdb]', err);
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: 'Failed to load title details' }));
    }
  }

  // Search mode: /api/tmdb?q=<query>
  if (q.length < 2) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Query must be at least 2 characters' }));
  }

  if (q.length > 120) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Query too long' }));
  }

  try {
    const data = await fetchTmdb(
      '/search/multi',
      { query: q, include_adult: 'false', page: '1' },
      apiKey,
    );

    const results = (Array.isArray(data.results) ? data.results : [])
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      // Not a bare .map(mapSearchResult) — that hands the array index to forcedType.
      .map((item) => mapSearchResult(item))
      .filter((item) => item.title)
      .slice(0, SEARCH_LIMIT);

    res.statusCode = 200;
    return res.end(JSON.stringify({ results }));
  } catch (err) {
    console.error('[tmdb]', err);
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: 'Failed to search titles' }));
  }
};
