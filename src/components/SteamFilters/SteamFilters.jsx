import { useMemo } from 'react';
import styles from './SteamFilters.module.css';

export default function SteamFilters({
  search,
  onSearchChange,
  activeFilters,
  onFilterToggle,
  games,
}) {
  const availableFilters = useMemo(() => {
    const genreSet = new Set();
    const categorySet = new Set();
    for (const g of games) {
      (g.genres || []).forEach((t) => genreSet.add(t));
      (g.categories || []).forEach((t) => categorySet.add(t));
    }
    return {
      genres: [...genreSet].sort(),
      categories: [...categorySet].sort(),
    };
  }, [games]);

  const hasFilters =
    availableFilters.genres.length > 0 ||
    availableFilters.categories.length > 0;

  return (
    <div className={styles.container}>
      <input
        type="text"
        className={styles.search}
        placeholder="Search games..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      {hasFilters && (
        <div className={styles.chipRows}>
          {availableFilters.categories.length > 0 && (
            <div className={styles.chipRow}>
              {availableFilters.categories.map((cat) => (
                <button
                  key={`cat-${cat}`}
                  className={`${styles.chip} ${activeFilters.has(cat) ? styles.chipActive : ''}`}
                  onClick={() => onFilterToggle(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          {availableFilters.genres.length > 0 && (
            <div className={styles.chipRow}>
              {availableFilters.genres.map((genre) => (
                <button
                  key={`genre-${genre}`}
                  className={`${styles.chip} ${activeFilters.has(genre) ? styles.chipActive : ''}`}
                  onClick={() => onFilterToggle(genre)}
                >
                  {genre}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
