import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import steamReviewsData from '../../data/steam-reviews.json';
import EditableSection, { EditableItemControls } from '../../admin/EditableSection';
import SteamGameCover from '../SteamGameCover/SteamGameCover';
import SteamFilters from '../SteamFilters/SteamFilters';
import styles from './SteamReviews.module.css';

const { reviews } = steamReviewsData;

const STEAM_CURATOR_URL =
  'https://store.steampowered.com/curator/33245545/';

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

  const sorted = useMemo(
    () => sortReviewRows(reviews, sortBy, getGameName),
    [sortBy, getGameName],
  );

  if (reviews.length === 0) {
    return (
      <div className={styles.scrollGutter}>
        <p className={styles.empty}>No reviews yet. Check back soon.</p>
      </div>
    );
  }

  return (
    <EditableSection collection="steam-reviews" dataKey="reviews">
      <div className={styles.scrollGutter}>
        <div className={styles.sortBar}>
          <a
            href={STEAM_CURATOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.curatorLink}
          >
            STEAM CURATOR &#8599;
          </a>
          <SteamFilters
            sortOnly
            sortBy={sortBy}
            onSortChange={setSortBy}
            sortOptions={SORT_OPTIONS}
          />
        </div>
        <motion.div
          className={styles.list}
          variants={stagger}
          initial="hidden"
          animate="show"
        >
        {sorted.map((review) => {
          const appId = Number(review.appId);
          const game = gameMap[appId];
          const pct = review.rating * 10;
          const originalIndex = reviews.indexOf(review);
          const displayName =
            game?.name ?? review.gameName ?? `App ${appId}`;

          return (
            <motion.article
              key={`${appId}-${review.date}-${originalIndex}`}
              className={styles.card}
              variants={fadeUp}
            >
              <SteamGameCover
                appId={appId}
                title={displayName}
                headerUrl={game?.headerUrl}
                useIconFallback={false}
                alt={displayName}
                rootClassName={styles.coverRoot}
                imageClassName={styles.coverImage}
              />

              <div className={styles.body}>
                <div className={styles.header}>
                  <div className={styles.titleRow}>
                    <h3 className={styles.title}>
                      {review.title}
                      <EditableItemControls index={originalIndex} />
                    </h3>
                    <span
                      className={`${styles.badge} ${review.recommended ? styles.recommended : styles.notRecommended}`}
                    >
                      {review.recommended ? 'RECOMMENDED' : 'NOT RECOMMENDED'}
                    </span>
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.gameName}>{displayName}</span>
                    <span className={styles.date}>{review.date}</span>
                  </div>
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
                </div>

                <p className={styles.text}>{review.text}</p>

                {(review.pros?.length > 0 || review.cons?.length > 0) && (
                  <div className={styles.proscons}>
                    {review.pros?.length > 0 && (
                      <div className={styles.column}>
                        <span className={styles.columnLabel}>+ PROS</span>
                        <ul className={styles.bulletList}>
                          {review.pros.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {review.cons?.length > 0 && (
                      <div className={styles.column}>
                        <span className={styles.columnLabel}>- CONS</span>
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
            </motion.article>
          );
        })}
        </motion.div>
      </div>
    </EditableSection>
  );
}
