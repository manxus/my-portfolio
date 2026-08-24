import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import steamReviewsData from '../../data/steam-reviews.json';
import EditableSection, { EditableItemControls } from '../../admin/EditableSection';
import SteamGameCover from '../SteamGameCover/SteamGameCover';
import SteamFilters from '../SteamFilters/SteamFilters';
import ReviewModal from './ReviewModal';
import { trackSteamCuratorClick } from '../../hooks/useVisitorTracking';
import styles from './SteamReviews.module.css';

const { reviews } = steamReviewsData;

const STEAM_CURATOR_URL =
  'https://store.steampowered.com/curator/33245545/';

/** A grid fits far more per screen than the list this replaced. */
const REVIEWS_PER_PAGE = 24;

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

/** "2026-08-19" -> "19 Aug 2026" — the card has no room for the long form. */
function formatShortDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

export default function SteamReviews({ games }) {
  const [sortBy, setSortBy] = useState('date');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

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

  const closeModal = useCallback(() => setSelected(null), []);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    setPage(1);
    setSelected(null);
  }, []);

  const handleSortChange = useCallback((key) => {
    setSortBy(key);
    setPage(1);
    setSelected(null);
  }, []);

  const handlePageChange = useCallback((next) => {
    setPage(next);
    setSelected(null);
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
            placeholder="Search reviews..."
          />
        </div>

        {sorted.length === 0 ? (
          <p className={styles.empty}>No reviews match your search.</p>
        ) : (
          <motion.div
            key={`${sortBy}-${search}-${safePage}`}
            className={styles.grid}
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            {pagedReviews.map((review) => {
              const appId = Number(review.appId);
              const game = gameMap[appId];
              // Index into the untouched source array — sorting and paging must
              // not change which entry the admin controls edit.
              const originalIndex = reviews.indexOf(review);
              const displayName = getGameName(review);
              const key = `${appId}-${review.date}-${originalIndex}`;
              // Never inferred from the rating: a 6/10 can still be a negative review.
              const recommended = Boolean(review.recommended);

              return (
                <motion.article
                  key={key}
                  className={styles.card}
                  variants={fadeUp}
                  role="button"
                  tabIndex={0}
                  aria-label={`${displayName} review`}
                  onClick={() => setSelected(review)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelected(review);
                    }
                  }}
                >
                  <div className={styles.cover}>
                    <SteamGameCover
                      fill
                      variant="cover"
                      appId={appId}
                      title={displayName}
                      headerUrl={game?.headerUrl}
                      libraryCapsuleUrl={game?.libraryCapsuleUrl}
                      libraryHeaderUrl={game?.libraryHeaderUrl}
                      iconUrl={game?.iconUrl}
                      alt={displayName}
                      rootClassName={styles.coverRoot}
                      imageClassName={styles.coverImg}
                    />
                    <span
                      className={`${styles.badge} ${
                        recommended ? styles.recommended : styles.notRecommended
                      }`}
                    >
                      {recommended ? 'RECOMMENDED' : 'NOT RECOMMENDED'}
                    </span>
                  </div>

                  <div className={styles.info}>
                    <p className={styles.name} title={displayName}>
                      {displayName}
                    </p>
                    <div className={styles.meta}>
                      <span className={styles.score}>{review.rating}/10</span>
                      <span className={styles.date}>
                        {formatShortDate(review.date)}
                      </span>
                    </div>
                  </div>

                  {/* Editing a review shouldn't also pop the reader open. */}
                  <span
                    className={styles.adminControls}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    <EditableItemControls index={originalIndex} />
                  </span>
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

        <AnimatePresence>
          {selected && (
            <ReviewModal
              review={selected}
              game={gameMap[Number(selected.appId)]}
              displayName={getGameName(selected)}
              onClose={closeModal}
            />
          )}
        </AnimatePresence>
      </>
    </EditableSection>
  );
}
