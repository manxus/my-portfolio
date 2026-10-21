/**
 * The two things every show-syncing script needs from TMDB.
 *
 * Specials are excluded throughout. TMDB files them as season 0 and leaves them
 * out of number_of_episodes, so counting them would put every derived position
 * out by however many specials a show has (27 of them for Family Guy).
 */

/**
 * Aired episodes per season, index 0 = season 1, specials dropped.
 *
 * TMDB lists a season's full episode order as soon as it is announced, so
 * `episode_count` runs ahead of what has actually aired. Counting those would
 * let a watched show be ticked through episodes that don't exist yet, and the
 * episodes then air inside a total that never grows — the show stays WATCHED.
 * Cutting every count at `last_episode_to_air` makes each new episode grow the
 * total the week it airs. Mirrored in dev-api/tmdb.cjs.
 */
export function seasonEpisodeCounts(show) {
  if (!Array.isArray(show.seasons)) return [];
  const seasons = show.seasons
    .filter((s) => Number(s.season_number) > 0)
    .sort((a, b) => Number(a.season_number) - Number(b.season_number));

  const last = show.last_episode_to_air;
  const lastSeason = Number(last?.season_number);
  if (lastSeason > 0) {
    return seasons
      .filter((s) => Number(s.season_number) <= lastSeason)
      .map((s) =>
        Number(s.season_number) === lastSeason
          ? Number(last.episode_number) || 0
          : Number(s.episode_count) || 0,
      );
  }

  // No regular episode has aired (or the latest was a special): fall back to
  // whole seasons that have premiered.
  const today = new Date().toISOString().slice(0, 10);
  return seasons
    .filter((s) => s.air_date && s.air_date <= today)
    .map((s) => Number(s.episode_count) || 0);
}

export async function fetchShow(tmdbId, apiKey) {
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}?${new URLSearchParams({
    api_key: apiKey,
    language: 'en-US',
  })}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}
