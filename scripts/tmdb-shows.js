/**
 * The two things every show-syncing script needs from TMDB.
 *
 * Specials are excluded throughout. TMDB files them as season 0 and leaves them
 * out of number_of_episodes, so counting them would put every derived position
 * out by however many specials a show has (27 of them for Family Guy).
 */

/** Episodes per season, index 0 = season 1, specials dropped. */
export function seasonEpisodeCounts(show) {
  if (!Array.isArray(show.seasons)) return [];
  return show.seasons
    .filter((s) => Number(s.season_number) > 0)
    .sort((a, b) => Number(a.season_number) - Number(b.season_number))
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
