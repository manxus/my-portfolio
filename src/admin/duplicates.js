const normalizeTitle = (title) =>
  String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Same TMDB title, or — when either side was typed by hand without a TMDB id —
 * same type, title, and year (so remakes like Dune 1984 / 2021 stay distinct).
 */
export function isSameCinemaTitle(a, b) {
  if (a?.tmdbId && b?.tmdbId) {
    return String(a.tmdbId) === String(b.tmdbId) && (a.mediaType || '') === (b.mediaType || '');
  }
  const title = normalizeTitle(a?.title);
  if (!title || title !== normalizeTitle(b?.title)) return false;
  if (a.mediaType && b.mediaType && a.mediaType !== b.mediaType) return false;
  if (a.year && b.year && String(a.year) !== String(b.year)) return false;
  return true;
}

const matchers = {
  'cinema.entries': isSameCinemaTitle,
};

/** The existing item `item` would duplicate, or null. Collections without a matcher never clash. */
export function findDuplicate(schemaKey, item, existingItems) {
  const same = matchers[schemaKey];
  if (!same || !Array.isArray(existingItems)) return null;
  return existingItems.find((other) => other && same(item, other)) ?? null;
}
