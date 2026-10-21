import { useAdminStore } from '../stores/adminStore';

/**
 * Search movies/shows via the /api/tmdb proxy (The Movie Database). On the live site the proxy
 * only answers a logged-in admin, so the token rides along.
 */

function authHeaders() {
  const { token } = useAdminStore.getState();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

  const res = await fetch(`/api/tmdb?${new URLSearchParams({ q })}`, {
    signal,
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Title search failed'));
  }

  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

export async function fetchTitleDetails(tmdbId, mediaType, signal) {
  const res = await fetch(
    `/api/tmdb?${new URLSearchParams({ id: String(tmdbId), type: mediaType })}`,
    { signal, headers: authHeaders() },
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load title details'));
  }

  return res.json();
}
