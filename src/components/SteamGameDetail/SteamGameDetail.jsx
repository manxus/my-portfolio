import { motion } from 'framer-motion';
import styles from './SteamGameDetail.module.css';

export default function SteamGameDetail({ game, onClose, style }) {
  if (!game) return null;

  const pct = game.achievements
    ? Math.round(
        (game.achievements.unlocked / game.achievements.total) * 100,
      )
    : null;

  const storeUrl = `https://store.steampowered.com/app/${game.appId}`;

  return (
    <motion.div
      className={styles.detail}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      style={{ overflow: 'hidden', ...style }}
    >
      <div className={styles.inner}>
        <img
          src={game.headerUrl}
          alt={game.name}
          className={styles.banner}
        />

        <div className={styles.body}>
          <div className={styles.topRow}>
            <h3 className={styles.name}>{game.name}</h3>
            <button className={styles.closeBtn} onClick={onClose} title="Close">
              &#10005;
            </button>
          </div>

          <div className={styles.metrics}>
            <span className={styles.metric}>
              <span className={styles.metricValue}>
                {game.playtimeHours.toLocaleString()}
              </span>
              <span className={styles.metricLabel}>HOURS</span>
            </span>

            {pct !== null && (
              <span className={styles.metric}>
                <span className={styles.metricValue}>{pct}%</span>
                <span className={styles.metricLabel}>ACHIEVEMENTS</span>
              </span>
            )}

            {game.achievements && (
              <div className={styles.achGroup}>
                <div className={styles.achTrack}>
                  <div
                    className={styles.achFill}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={styles.achText}>
                  {game.achievements.unlocked}/{game.achievements.total}
                </span>
              </div>
            )}

            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.storeLink}
            >
              STEAM &#8599;
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
