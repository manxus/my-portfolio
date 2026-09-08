/**
 * What the episode record says about a show, as opposed to what its `status`
 * field claims.
 *
 * `status` is typed by hand while progress accumulates episode by episode, so
 * the two drift apart in both directions: ticking the last episode leaves a
 * finished show under WATCHING, and a new season landing on a finished show
 * leaves it under WATCHED with episodes it hasn't seen. Deriving the status from
 * the record closes both gaps from one rule, shared by the page, the admin
 * episode picker and the TMDB refresh script.
 *
 * Extension is explicit on the import because the refresh script loads this
 * module in bare Node, where extensionless specifiers don't resolve.
 */

import { countWatched, totalEpisodes as sumSeasons } from './episodes.js';

function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function isShow(entry) {
  return entry?.mediaType === 'tv';
}

/**
 * Episodes a show has. The per-season sum wins: it is the only total the
 * episode record can address, and the stored `episodes` field goes stale the
 * moment a season is announced.
 */
export function episodeTotal(entry) {
  return sumSeasons(entry?.seasonEpisodes) || toCount(entry?.episodes);
}

/**
 * Episodes actually seen. The per-episode record wins where it exists; otherwise
 * fall back to the stored total, which still covers shows that were never synced.
 */
export function episodesWatched(entry) {
  if (!isShow(entry)) return 0;
  if (entry.watchedEpisodes) return countWatched(entry.watchedEpisodes);
  const seen = toCount(entry.episodesSeen);
  if (seen > 0) return seen;
  return entry.status === 'watched' ? toCount(entry.episodes) : 0;
}

/** Episode progress for a show that has been started, or null when it doesn't apply. */
export function watchProgress(entry) {
  const total = episodeTotal(entry);
  const seen = episodesWatched(entry);
  if (total <= 0 || seen <= 0) return null;
  return { seen, total, percent: Math.min(100, Math.round((seen / total) * 100)) };
}

/**
 * The status the episode record implies.
 *
 * Only shows are derived, and only where there is something to derive from:
 * a film, a show with no season data, and a show nobody has started keep
 * whatever status they were given. `dropped` is left alone too — abandoning a
 * show is a judgement no episode count can overrule.
 *
 * Note this can't oscillate on a show with no per-episode record:
 * `episodesWatched` reads such a show's `watched` status back as a full count,
 * so the rule returns the status it started from.
 */
export function derivedStatus(entry) {
  if (!isShow(entry)) return entry?.status;
  if (entry.status === 'dropped') return 'dropped';

  const total = episodeTotal(entry);
  if (total <= 0) return entry.status;

  const seen = episodesWatched(entry);
  if (seen <= 0) return entry.status;

  return seen >= total ? 'watched' : 'watching';
}
