import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { reviews } from '../../data/steam-reviews';
import styles from './SteamReviews.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export default function SteamReviews({ games }) {
  const gameMap = useMemo(() => {
    const m = {};
    for (const g of games) m[g.appId] = g;
    return m;
  }, [games]);

  const sorted = useMemo(
    () => [...reviews].sort((a, b) => b.date.localeCompare(a.date)),
    [],
  );

  if (sorted.length === 0) {
    return (
      <p className={styles.empty}>No reviews yet. Check back soon.</p>
    );
  }

  return (
    <motion.div
      className={styles.list}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {sorted.map((review) => {
        const game = gameMap[review.appId];
        if (!game) return null;
        const pct = review.rating * 10;

        return (
          <motion.article
            key={`${review.appId}-${review.date}`}
            className={styles.card}
            variants={fadeUp}
          >
            <img
              src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/library_600x900.jpg`}
              alt={game.name}
              className={styles.thumb}
              loading="lazy"
              onError={(e) => {
                e.target.src = game.headerUrl;
              }}
            />

            <div className={styles.body}>
              <div className={styles.header}>
                <div className={styles.titleRow}>
                  <h3 className={styles.title}>{review.title}</h3>
                  <span
                    className={`${styles.badge} ${review.recommended ? styles.recommended : styles.notRecommended}`}
                  >
                    {review.recommended ? 'RECOMMENDED' : 'NOT RECOMMENDED'}
                  </span>
                </div>
                <div className={styles.meta}>
                  <span className={styles.gameName}>{game.name}</span>
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
  );
}
