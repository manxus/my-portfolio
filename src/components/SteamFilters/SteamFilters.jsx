import { useState, useRef, useEffect } from 'react';
import styles from './SteamFilters.module.css';

export default function SteamFilters({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  sortOptions,
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortPanelRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (sortPanelRef.current && !sortPanelRef.current.contains(e.target)) {
        setSortOpen(false);
      }
    }
    if (sortOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortOpen]);

  const currentLabel = sortOptions.find((o) => o.key === sortBy)?.label || 'Sort';

  return (
    <div className={styles.container}>
      <input
        type="text"
        className={styles.search}
        placeholder="Search games..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <div className={styles.sortWrapper} ref={sortPanelRef}>
        <button
          className={styles.sortBtn}
          onClick={() => setSortOpen((p) => !p)}
        >
          SORT: {currentLabel.toUpperCase()}
        </button>

        {sortOpen && (
          <div className={styles.sortPanel}>
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                className={`${styles.sortOption} ${sortBy === opt.key ? styles.sortOptionActive : ''}`}
                onClick={() => {
                  onSortChange(opt.key);
                  setSortOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
