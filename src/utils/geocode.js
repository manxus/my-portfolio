import { useAdminStore } from '../stores/adminStore';

/**
 * Search places via the /api/geocode proxy (OpenStreetMap Nominatim). On the live site the proxy
 * only answers a logged-in admin, so the token rides along.
 */
export async function searchPlaces(query, signal) {
  const q = String(query ?? '').trim();
  if (q.length < 2) return [];

  const { token } = useAdminStore.getState();
  const res = await fetch(`/api/geocode?${new URLSearchParams({ q })}`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Location search failed');
  }

  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}
