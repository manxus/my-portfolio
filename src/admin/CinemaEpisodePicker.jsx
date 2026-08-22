import { useState } from 'react';
import {
  countWatched,
  formatEpisodeCode,
  nextEpisode,
  seasonLength,
  setSeasonWatched,
  toggleEpisode,
  totalEpisodes,
  watchedInSeason,
} from '../utils/episodes';
import styles from './CinemaEpisodePicker.module.css';

/** Real checkbox so the browser handles focus and keys; ref sets the mixed state. */
function TriStateBox({ checked, mixed, onChange, label }) {
  return (
    <input
      type="checkbox"
      className={styles.box}
      checked={checked}
      aria-label={label}
      ref={(el) => {
        if (el) el.indeterminate = mixed && !checked;
      }}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function SeasonRow({ season, length, watched, expanded, onToggleExpand, onSetSeason, onToggleEpisode }) {
  const seen = new Set(watched);
  const complete = length > 0 && seen.size === length;

  return (
    <div className={styles.season}>
      <div
        className={styles.seasonHeader}
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
      >
        <TriStateBox
          checked={complete}
          mixed={seen.size > 0}
          label={`Season ${season} watched`}
          onChange={(e) => onSetSeason(season, length, e.target.checked)}
        />
        <span className={styles.seasonName}>Season {season}</span>
        <span className={styles.seasonCount}>
          {seen.size}/{length}
        </span>
        <span className={styles.caret}>{expanded ? '\u25be' : '\u25b8'}</span>
      </div>

      {expanded && (
        <div className={styles.episodes}>
          {Array.from({ length }, (_, i) => i + 1).map((episode) => (
            <label key={episode} className={styles.episode}>
              <input
                type="checkbox"
                className={styles.box}
                checked={seen.has(episode)}
                onChange={() => onToggleEpisode(season, episode)}
              />
              <span>E{episode}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Per-episode watch tracker. Reads seasonEpisodes/watchedEpisodes off the entry
 * and patches watchedEpisodes together with the episodesSeen total it implies,
 * so the stored count can never disagree with the ticked episodes.
 */
export default function CinemaEpisodePicker({ value, onChange }) {
  const [expanded, setExpanded] = useState(() => new Set());

  const seasonEpisodes = Array.isArray(value?.seasonEpisodes) ? value.seasonEpisodes : [];
  const watchedEpisodes = value?.watchedEpisodes || {};
  const isShow = value?.mediaType === 'tv';

  const total = totalEpisodes(seasonEpisodes);
  const seen = countWatched(watchedEpisodes);
  // Cheap enough to run inline — it stops at the first unwatched episode.
  const next = nextEpisode(seasonEpisodes, watchedEpisodes);

  const commit = (nextWatched) => {
    onChange({ watchedEpisodes: nextWatched, episodesSeen: countWatched(nextWatched) });
  };

  const handleSetSeason = (season, length, watched) => {
    commit(setSeasonWatched(watchedEpisodes, season, length, watched));
  };

  const handleToggleEpisode = (season, episode) => {
    commit(toggleEpisode(watchedEpisodes, season, episode));
  };

  const toggleExpand = (season) => {
    setExpanded((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(season)) nextSet.delete(season);
      else nextSet.add(season);
      return nextSet;
    });
  };

  if (!isShow) {
    return <p className={styles.hint}>Only shows track episodes.</p>;
  }

  if (seasonEpisodes.length === 0) {
    return (
      <p className={styles.hint}>
        No season data yet. Re-pick the show under &ldquo;Find on TMDB&rdquo; above, or run{' '}
        <code>node --env-file=.env scripts/backfill-cinema-episodes.js</code> to sync every show at
        once.
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        <span className={styles.summaryCount}>
          {seen} / {total}
        </span>
        <span className={styles.summaryNext}>
          {next ? `next ${formatEpisodeCode(next)}` : 'complete'}
        </span>
      </div>

      <div className={styles.seasons}>
        {seasonEpisodes.map((_, i) => {
          const season = i + 1;
          return (
            <SeasonRow
              key={season}
              season={season}
              length={seasonLength(seasonEpisodes, season)}
              watched={watchedInSeason(watchedEpisodes, season)}
              expanded={expanded.has(season)}
              onToggleExpand={() => toggleExpand(season)}
              onSetSeason={handleSetSeason}
              onToggleEpisode={handleToggleEpisode}
            />
          );
        })}
      </div>
    </div>
  );
}
