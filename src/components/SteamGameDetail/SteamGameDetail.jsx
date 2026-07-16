import { motion } from 'framer-motion';
import SteamGameCover from '../SteamGameCover/SteamGameCover';
import styles from './SteamGameDetail.module.css';

function formatHours(hours) {
  if (hours == null || Number.isNaN(hours)) return null;
  return Number(hours).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

export default function SteamGameDetail({ game, onClose, style }) {
  if (!game) return null;

  const pct = game.achievements
    ? Math.round(
        (game.achievements.unlocked / game.achievements.total) * 100,
      )
    : null;

  const completionistHours = game.hltb?.completionistHours ?? null;
  const completionistLabel = formatHours(completionistHours);
  const playtimeLabel = formatHours(game.playtimeHours);
  const storeUrl = `https://store.steampowered.com/app/${game.appId}`;
  const hltbUrl =
    game.hltb?.id != null
      ? `https://howlongtobeat.com/game/${game.hltb.id}`
      : 'https://howlongtobeat.com/';

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
        <SteamGameCover
          variant="banner"
          appId={game.appId}
          title={game.name}
          headerUrl={game.headerUrl}
          libraryHeaderUrl={game.libraryHeaderUrl}
          iconUrl={game.iconUrl}
          alt={game.name}
          rootClassName={styles.banner}
          imageClassName={styles.bannerImage}
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

            {completionistLabel != null && (
              <span className={styles.metric}>
                <span className={styles.metricValue}>~{completionistLabel}h</span>
                <span className={styles.metricLabel}>100%</span>
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

            {completionistLabel != null && playtimeLabel != null && (
              <span className={styles.hltbProgress} title="Your hours vs HowLongToBeat 100%">
                {playtimeLabel}h / ~{completionistLabel}h
              </span>
            )}

            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.storeLink}
            >
              STEAM &#8599;
            </a>

            {game.hltb?.id != null && (
              <a
                href={hltbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.hltbLink}
                title="HowLongToBeat"
              >
                HLTB &#8599;
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
