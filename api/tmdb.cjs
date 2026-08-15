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

/** Compact shape for the search dropdown. */
function mapSearchResult(item) {
  const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
  return {
    tmdbId: item.id,
    mediaType,
    title: titleOf(item),
    year: yearOf(releaseDateOf(item)),
    posterUrl: imageUrl(item.poster_path, POSTER_SIZE),
    overview: String(item.overview ?? '').trim(),
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
    patch.runtime = toNumberOrNull(
      Array.isArray(item.episode_run_time) ? item.episode_run_time[0] : null,
    );
  } else {
    patch.runtime = toNumberOrNull(item.runtime);
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
      const data = await fetchTmdb(`/${type}/${id}`, {}, apiKey);
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
      .map(mapSearchResult)
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
