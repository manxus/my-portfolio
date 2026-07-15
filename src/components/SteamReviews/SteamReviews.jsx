import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import steamReviewsData from '../../data/steam-reviews.json';
import EditableSection, { EditableItemControls } from '../../admin/EditableSection';
import SteamGameCover from '../SteamGameCover/SteamGameCover';
import SteamFilters from '../SteamFilters/SteamFilters';
import { trackSteamCuratorClick } from '../../hooks/useVisitorTracking';
import styles from './SteamReviews.module.css';

const { reviews } = steamReviewsData;

const STEAM_CURATOR_URL =
  'https://store.steampowered.com/curator/33245545/';

const REVIEWS_PER_PAGE = 10;

const SORT_OPTIONS = [
  { key: 'date', label: 'Date (newest)' },
  { key: 'rating', label: 'Score (high to low)' },
  { key: 'name', label: 'Game name (A–Z)' },
];

function sortReviewRows(rows, sortBy, getGameName) {
  const out = [...rows];
  const byDateDesc = (a, b) => b.date.localeCompare(a.date);

  switch (sortBy) {
    case 'rating':
      out.sort((a, b) => {
        const dr = (b.rating ?? 0) - (a.rating ?? 0);
        if (dr !== 0) return dr;
        return byDateDesc(a, b);
      });
      break;
    case 'name':
      out.sort((a, b) => {
        const cmp = getGameName(a).localeCompare(getGameName(b), undefined, {
          sensitivity: 'base',
          numeric: true,
        });
        if (cmp !== 0) return cmp;
        return byDateDesc(a, b);
      });
      break;
    case 'date':
    default:
      out.sort(byDateDesc);
  }
  return out;
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export default function SteamReviews({ games }) {
  const [sortBy, setSortBy] = useState('date');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(() => new Set());

  const gameMap = useMemo(() => {
    const m = {};
    for (const g of games) m[Number(g.appId)] = g;
    return m;
  }, [games]);

  const getGameName = useMemo(
    () => (review) => {
      const appId = Number(review.appId);
      const game = gameMap[appId];
      return game?.name ?? review.gameName ?? `App ${appId}`;
    },
    [gameMap],
  );

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    setPage(1);
    setExpanded(new Set());
  }, []);

  const handleSortChange = useCallback((key) => {
    setSortBy(key);
    setPage(1);
    setExpanded(new Set());
  }, []);

  const handlePageChange = useCallback((next) => {
    setPage(next);
    setExpanded(new Set());
  }, []);

  const toggleExpanded = useCallback((key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((r) => {
      const name = getGameName(r).toLowerCase();
      const title = (r.title || '').toLowerCase();
      return name.includes(q) || title.includes(q);
    });
  }, [search, getGameName]);

  const sorted = useMemo(
    () => sortReviewRows(filtered, sortBy, getGameName),
    [filtered, sortBy, getGameName],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / REVIEWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pagedReviews = sorted.slice(
    (safePage - 1) * REVIEWS_PER_PAGE,
    safePage * REVIEWS_PER_PAGE,
  );

  if (reviews.length === 0) {
    return (
      <p className={styles.empty}>No reviews yet. Check back soon.</p>
    );
  }

  return (
    <EditableSection collection="steam-reviews" dataKey="reviews">
      <>
        <div className={styles.sortBar}>
          <a
            href={STEAM_CURATOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.curatorLink}
            onClick={() => trackSteamCuratorClick()}
          >
            STEAM CURATOR &#8599;
          </a>
          <SteamFilters
            search={search}
            onSearchChange={handleSearchChange}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            sortOptions={SORT_OPTIONS}
          />
        </div>

        {sorted.length === 0 ? (
          <p className={styles.empty}>No reviews match your search.</p>
        ) : (
          <motion.div
            key={`${sortBy}-${search}-${safePage}`}
            className={styles.list}
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            {pagedReviews.map((review) => {
              const appId = Number(review.appId);
              const game = gameMap[appId];
              const pct = review.rating * 10;
              const originalIndex = reviews.indexOf(review);
              const displayName =
                game?.name ?? review.gameName ?? `App ${appId}`;
              const key = `${appId}-${review.date}-${originalIndex}`;
              const isOpen = expanded.has(key);

              return (
                <motion.article
                  key={key}
                  className={`${styles.card} ${isOpen ? styles.cardOpen : ''}`}
                  variants={fadeUp}
                >
                  <div
                    className={styles.summary}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => toggleExpanded(key)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpanded(key);
                      }
                    }}
                  >
                    <SteamGameCover
                      variant="banner"
                      appId={appId}
                      title={displayName}
                      headerUrl={game?.headerUrl}
                      libraryCapsuleUrl={game?.libraryCapsuleUrl}
                      libraryHeaderUrl={game?.libraryHeaderUrl}
                      iconUrl={game?.iconUrl}
                      alt={displayName}
                      rootClassName={styles.coverRoot}
                      imageClassName={styles.coverImage}
                    />

                    <div className={styles.summaryBody}>
                      <div className={styles.titleRow}>
                        <h3 className={styles.title}>
                          {displayName}
                          <EditableItemControls index={originalIndex} />
                        </h3>
                        <span
                          className={`${styles.badge} ${review.recommended ? styles.recommended : styles.notRecommended}`}
                        >
                          {review.recommended ? 'RECOMMENDED' : 'NOT RECOMMENDED'}
                        </span>
                      </div>

                      <div className={styles.ratingRow}>
                        <span className={styles.ratingValue}>
                          {review.rating}/10
                        </span>
                        <div className={styles.ratingTrack}>
                          <div
                            className={styles.ratingFill}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={styles.date}>{review.date}</span>
                      </div>
                    </div>

                    <span
                      className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                      aria-hidden="true"
                    >
                      &#9662;
                    </span>
                  </div>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        className={styles.detail}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                      >
                        <div className={styles.detailInner}>
                          <h4 className={styles.reviewTitle}>{review.title}</h4>
                          <p className={styles.text}>{review.text}</p>

                          {(review.pros?.length > 0 ||
                            review.cons?.length > 0) && (
                            <div className={styles.proscons}>
                              {review.pros?.length > 0 && (
                                <div className={styles.column}>
                                  <span className={styles.columnLabel}>
                                    + PROS
                                  </span>
                                  <ul className={styles.bulletList}>
                                    {review.pros.map((p, i) => (
                                      <li key={i}>{p}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {review.cons?.length > 0 && (
                                <div className={styles.column}>
                                  <span className={styles.columnLabel}>
                                    - CONS
                                  </span>
                                  <ul className={styles.bulletList}>
                                    {review.cons.map((c, i) => (
                                      <li key={i}>{c}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </motion.div>
        )}

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              disabled={safePage <= 1}
              onClick={() => handlePageChange(safePage - 1)}
            >
              &laquo; PREV
            </button>
            <span className={styles.pageInfo}>
              PAGE {safePage} / {totalPages}
              <span className={styles.pageCount}>
                &nbsp;({sorted.length} reviews)
              </span>
            </span>
            <button
              className={styles.pageBtn}
              disabled={safePage >= totalPages}
              onClick={() => handlePageChange(safePage + 1)}
            >
              NEXT &raquo;
            </button>
          </div>
        )}
      </>
    </EditableSection>
  );
}
