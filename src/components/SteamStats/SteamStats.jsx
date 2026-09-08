import { useMemo } from 'react';
import { motion } from 'framer-motion';
import styles from './SteamStats.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function SteamStats({ games, profile, className }) {
  const metrics = useMemo(() => {
    if (!games || games.length === 0) return null;

    const totalHours = games.reduce((sum, g) => sum + g.playtimeHours, 0);

    const gamesWithAch = games.filter((g) => g.achievements);
    const totalUnlocked = gamesWithAch.reduce(
      (s, g) => s + g.achievements.unlocked,
      0,
    );

    const engagedGames = gamesWithAch.filter((g) => g.achievements.unlocked > 0);
    const achPct =
      engagedGames.length > 0
        ? Math.round(
            engagedGames.reduce(
              (s, g) =>
                s + (g.achievements.unlocked / g.achievements.total) * 100,
              0,
            ) / engagedGames.length,
          )
        : 0;

    const perfectGames = gamesWithAch.filter(
      (g) =>
        g.achievements.total > 0 &&
        g.achievements.unlocked === g.achievements.total,
    ).length;

    return { totalHours, totalUnlocked, achPct, perfectGames };
  }, [games]);

  if (!metrics || !profile) return null;

  const rootClass = [styles.container, className].filter(Boolean).join(' ');

  return (
    <motion.div
      className={rootClass}
      variants={fadeUp}
      initial="hidden"
      animate="show"
    >
      <div className={styles.profileRow}>
        <div className={styles.profileIdentity}>
          {profile.avatarUrl && (
            <img
              src={profile.avatarUrl}
              alt={profile.personaName}
              className={styles.avatar}
            />
          )}
          <h3 className={styles.profileName}>{profile.personaName}</h3>
        </div>

        <div className={styles.metricStrip}>
          <div className={styles.profileStat}>
            <span className={styles.profileStatValue}>
              {Math.round(metrics.totalHours).toLocaleString()}
            </span>
            <span className={styles.profileStatLabel}>HOURS</span>
          </div>
          <span className={styles.metricDivider} />
          <div className={styles.profileStat}>
            <span className={styles.profileStatValue}>
              {metrics.totalUnlocked.toLocaleString()}
            </span>
            <span className={styles.profileStatLabel}>ACHIEVEMENTS</span>
          </div>
          <span className={styles.metricDivider} />
          <div className={styles.profileStat}>
            <span className={styles.profileStatValue}>
              {metrics.perfectGames}
            </span>
            <span className={styles.profileStatLabel}>100%</span>
          </div>
          <span className={styles.metricDivider} />
          <div className={styles.profileStat}>
            <span className={styles.profileStatValue}>
              {games.length.toLocaleString()}
            </span>
            <span className={styles.profileStatLabel}>GAMES</span>
          </div>
          <span className={styles.metricDivider} />
          <div className={styles.ringCell}>
            <div
              className={styles.ring}
              style={{
                background: `conic-gradient(var(--accent-bright) ${metrics.achPct * 3.6}deg, var(--bg-hover) 0deg)`,
              }}
            >
              <div className={styles.ringInner}>
                <span className={styles.ringPct}>{metrics.achPct}%</span>
              </div>
            </div>
            <span className={styles.ringLabel}>
              ACH
              <br />
              RATE
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
