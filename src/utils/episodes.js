/**
 * Episode bookkeeping for shows tracked one episode at a time.
 *
 * `seasonEpisodes` is an array of episode counts where index 0 is season 1, with
 * specials (TMDB's season 0) excluded — that exclusion is what makes the counts
 * sum to TMDB's own `number_of_episodes`.
 *
 * `watchedEpisodes` maps a season number to the episode numbers watched in it.
 * Keys arrive from JSON as strings, so every lookup goes through String().
 */

function seasonKey(season) {
  return String(season);
}

function toNumbers(value) {
  return Array.isArray(value) ? value.map(Number).filter(Number.isInteger) : [];
}

/** Episodes in a season, or 0 when the season isn't known. */
export function seasonLength(seasonEpisodes, season) {
  const list = Array.isArray(seasonEpisodes) ? seasonEpisodes : [];
  const n = Number(list[season - 1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Sorted episode numbers watched in one season. */
export function watchedInSeason(watchedEpisodes, season) {
  if (!watchedEpisodes) return [];
  return toNumbers(watchedEpisodes[seasonKey(season)]).sort((a, b) => a - b);
}

export function totalEpisodes(seasonEpisodes) {
  return (Array.isArray(seasonEpisodes) ? seasonEpisodes : []).reduce(
    (sum, n) => sum + (Number(n) > 0 ? Number(n) : 0),
    0,
  );
}

/** How many episodes are ticked across every season. */
export function countWatched(watchedEpisodes) {
  if (!watchedEpisodes) return 0;
  return Object.values(watchedEpisodes).reduce((sum, list) => sum + toNumbers(list).length, 0);
}

/**
 * The first episode not yet ticked, scanning seasons in order — the episode to
 * resume on. Returns null once everything is watched. Because it looks for the
 * first gap rather than the highest ticked episode, unticking an earlier episode
 * moves the resume point back to it.
 */
export function nextEpisode(seasonEpisodes, watchedEpisodes) {
  const list = Array.isArray(seasonEpisodes) ? seasonEpisodes : [];
  for (let season = 1; season <= list.length; season += 1) {
    const length = seasonLength(list, season);
    const seen = new Set(watchedInSeason(watchedEpisodes, season));
    for (let episode = 1; episode <= length; episode += 1) {
      if (!seen.has(episode)) return { season, episode };
    }
  }
  return null;
}

/** "S13E20" */
export function formatEpisodeCode(position) {
  if (!position) return '';
  return `S${position.season}E${position.episode}`;
}

/**
 * Seed a watched map by filling the first `count` episodes in broadcast order.
 * Used to migrate a bare `episodesSeen` total into per-episode data.
 */
export function fillInOrder(seasonEpisodes, count) {
  const list = Array.isArray(seasonEpisodes) ? seasonEpisodes : [];
  const watched = {};
  let left = Math.max(0, Number(count) || 0);

  for (let season = 1; season <= list.length && left > 0; season += 1) {
    const length = seasonLength(list, season);
    if (length === 0) continue;
    const take = Math.min(left, length);
    watched[seasonKey(season)] = Array.from({ length: take }, (_, i) => i + 1);
    left -= take;
  }

  return watched;
}

/** Every episode of every season ticked. */
export function fillAll(seasonEpisodes) {
  return fillInOrder(seasonEpisodes, totalEpisodes(seasonEpisodes));
}

/** Toggle one episode, returning a new map. Empty seasons are dropped. */
export function toggleEpisode(watchedEpisodes, season, episode) {
  const next = { ...(watchedEpisodes || {}) };
  const key = seasonKey(season);
  const seen = new Set(watchedInSeason(watchedEpisodes, season));

  if (seen.has(episode)) seen.delete(episode);
  else seen.add(episode);

  if (seen.size === 0) delete next[key];
  else next[key] = [...seen].sort((a, b) => a - b);

  return next;
}

/** Tick or clear a whole season, returning a new map. */
export function setSeasonWatched(watchedEpisodes, season, length, watched) {
  const next = { ...(watchedEpisodes || {}) };
  const key = seasonKey(season);

  if (!watched || length <= 0) delete next[key];
  else next[key] = Array.from({ length }, (_, i) => i + 1);

  return next;
}
