/**
 * Search places via the /api/geocode proxy (OpenStreetMap Nominatim).
 */
export async function searchPlaces(query, signal) {
  const q = String(query ?? '').trim();
  if (q.length < 2) return [];

  const res = await fetch(`/api/geocode?${new URLSearchParams({ q })}`, { signal });
  if (!res.ok) {
    throw new Error('Location search failed');
  }

  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}
