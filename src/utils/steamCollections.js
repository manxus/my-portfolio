/**
 * Series grouping for the Steam library.
 *
 * The Cinema page can group on `entry.collection` because TMDB hands it a
 * franchise per film. Steam has no such field, so membership lives in
 * `src/data/steam-collections.json` as appId lists and is resolved against the
 * library here. That is why `groupByCollection` in ./collections.js is not
 * reused: it keys off a field on the entry, and it sorts by group size, whereas
 * a 100% showcase wants to rank on how much of the series is perfected.
 *
 * The shape of the result mirrors `franchiseProgress` in ./collections.js --
 * a name, a denominator, and how far through it the library is.
 */

import { isPerfected } from './steamAchievements.js';

/**
 * Games with no achievements at all still belong to their series and still get
 * a cover, but they sit outside the denominator: a game Steam tracks nothing
 * for can never be perfected, so counting it would make a swept series read as
 * permanently incomplete.
 */
function isTracked(game) {
  return Boolean(game?.achievements?.total);
}

/**
 * Resolve the curated definitions against the library.
 *
 * Returns one row per collection, ranked with complete series first, then by
 * how close the rest are. Definitions naming fewer than two resolvable games
 * are dropped -- one game is not a series, the same rule `groupByCollection`
 * applies to loose films.
 *
 * `includeInvalid` keeps those dropped definitions in the result, flagged, so
 * the admin editor can reach them. Without it a half-finished entry (the editor
 * does not enforce required fields, so "+" then Save writes an empty one) is
 * invisible on the page and therefore impossible to delete from it.
 */
export function buildCollections(games, defs, { includeInvalid = false } = {}) {
  const byAppId = new Map();
  for (const g of games || []) byAppId.set(g.appId, g);

  const rows = [];
  const invalid = [];

  const list = defs || [];
  for (let index = 0; index < list.length; index++) {
    const def = list[index];
    const name = String(def?.name ?? '').trim();

    const ignored = new Set(def?.ignoreAppIds || []);
    const members = (def?.appIds || [])
      .filter((id) => !ignored.has(id))
      .map((id) => byAppId.get(id))
      // An appId can go missing when a game leaves the library; skip it rather
      // than rendering a card with no name or art.
      .filter(Boolean);

    const problem = !name
      ? 'No name'
      : members.length < 2
        ? `Only ${members.length} of its games are in your library`
        : null;

    if (problem) {
      if (includeInvalid) {
        invalid.push({
          name: name || '(unnamed)',
          index,
          note: def?.note || '',
          games: members,
          tracked: 0,
          perfected: 0,
          complete: false,
          totalAchievements: 0,
          pct: 0,
          invalid: problem,
        });
      }
      continue;
    }

    const tracked = members.filter(isTracked);
    const perfected = members.filter(isPerfected);
    const totalAchievements = tracked.reduce(
      (sum, g) => sum + g.achievements.total,
      0,
    );

    rows.push({
      name,
      // Position in the source file, so the admin editor can target the right
      // entry after these rows are filtered and re-sorted for display.
      index,
      note: def.note || '',
      // Stored order, deliberately unsorted: the first game is the one the
      // card shows front and centre, so the order in the file is the author's
      // choice and re-sorting here would take that control away.
      games: members,
      tracked: tracked.length,
      perfected: perfected.length,
      // Two perfected games at minimum. A series where only one member tracks
      // achievements at all reads as "1/1 complete" off a single game, which
      // inflated the headline count by a third on the real library.
      complete: tracked.length >= 2 && perfected.length === tracked.length,
      totalAchievements,
      pct: tracked.length > 0 ? perfected.length / tracked.length : 0,
    });
  }

  rows.sort(
    (a, b) =>
      Number(b.complete) - Number(a.complete) ||
      b.pct - a.pct ||
      b.perfected - a.perfected ||
      a.name.localeCompare(b.name),
  );

  // Broken entries last: they are a to-do list, not part of the showcase.
  return [...rows, ...invalid];
}

/** Headline numbers for the strip above the collection list. */
export function collectionsSummary(rows) {
  const valid = rows.filter((r) => !r.invalid);
  return {
    total: valid.length,
    complete: valid.filter((r) => r.complete).length,
    perfectedGames: valid.reduce((sum, r) => sum + r.perfected, 0),
  };
}
