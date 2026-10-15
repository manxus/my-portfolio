import { useState, useRef, useEffect } from 'react';
import styles from './SteamFilters.module.css';

export default function SteamFilters({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  sortOptions,
  /**
   * Pass both to get a flip button beside SORT. Options can carry a
   * `reverseLabel` for the button to show while reversed (e.g. "Title Z–A").
   */
  sortReversed,
  onSortReversedChange,
  /** Reviews tab: only the sort control, no search field. */
  sortOnly = false,
  placeholder = 'Search games...',
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

  const currentOption = sortOptions.find((o) => o.key === sortBy);
  const currentLabel =
    (sortReversed && currentOption?.reverseLabel) || currentOption?.label || 'Sort';
  const canReverse = typeof onSortReversedChange === 'function';

  return (
    <div
      className={sortOnly ? styles.containerSortOnly : styles.container}
    >
      {!sortOnly && (
        <input
          type="text"
          className={styles.search}
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      )}

      <div className={styles.sortGroup}>
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

      {canReverse && (
        <button
          type="button"
          className={`${styles.reverseBtn} ${sortReversed ? styles.reverseBtnActive : ''}`}
          onClick={() => onSortReversedChange(!sortReversed)}
          aria-pressed={Boolean(sortReversed)}
          aria-label="Reverse sort order"
          title="Reverse sort order"
        >
          <span aria-hidden="true">&#8645;</span>
        </button>
      )}
      </div>
    </div>
  );
}
