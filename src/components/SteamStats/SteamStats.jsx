import { motion } from 'framer-motion';
import styles from './SteamStats.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function SteamStats({ games, profile, wishlistCount, compact, className }) {
  if (!games || games.length === 0) return null;

  const totalHours = games.reduce((sum, g) => sum + g.playtimeHours, 0);
  const top5 = games.slice(0, 5);
  const maxHours = top5[0]?.playtimeHours || 1;

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
            (s, g) => s + (g.achievements.unlocked / g.achievements.total) * 100,
            0,
          ) / engagedGames.length,
        )
      : 0;

  const perfectGames = gamesWithAch.filter(
    (g) => g.achievements.total > 0 && g.achievements.unlocked === g.achievements.total,
  ).length;

  const rootClass = [
    styles.container,
    compact && styles.compact,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const Tag = compact ? 'div' : motion.div;
  const tagProps = compact ? {} : { variants: fadeUp };

  return (
    <Tag className={rootClass} {...tagProps}>
      {!compact && (
        <div className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> STATS OVERVIEW
        </div>
      )}

      {profile && (
        <div className={styles.profileRow}>
          <div className={styles.profileIdentity}>
            {profile.avatarUrl && (
              <img
                src={profile.avatarUrl}
                alt={profile.personaName}
                className={styles.avatar}
              />
            )}
            <div>
              <h3 className={styles.profileName}>{profile.personaName}</h3>
              <p className={styles.profileId}>Steam ID: {profile.steamId}</p>
            </div>
          </div>
          <div className={styles.profileStats}>
            <div className={styles.profileStatsRow}>
              <div className={styles.profileStat}>
                <span className={styles.profileStatValue}>
                  {Math.round(totalHours).toLocaleString()}
                </span>
                <span className={styles.profileStatLabel}>HOURS</span>
              </div>
              <div className={styles.profileStat}>
                <span className={styles.profileStatValue}>
                  {totalUnlocked.toLocaleString()}
                </span>
                <span className={styles.profileStatLabel}>ACHIEVEMENTS</span>
              </div>
              <div className={styles.profileStat}>
                <span className={styles.profileStatValue}>{perfectGames}</span>
                <span className={styles.profileStatLabel}>100%</span>
              </div>
            </div>
            <div className={styles.profileStatsRow}>
              <div className={styles.profileStat}>
                <span className={styles.profileStatValue}>{games.length}</span>
                <span className={styles.profileStatLabel}>GAMES</span>
              </div>
              <div className={styles.profileStat}>
                <span className={styles.profileStatValue}>{wishlistCount}</span>
                <span className={styles.profileStatLabel}>WISHLIST</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.chartPanel}>
          <p className={styles.chartLabel}>MOST PLAYED</p>
          <div className={styles.barChart}>
            {top5.map((game) => (
              <div key={game.appId} className={styles.barRow}>
                <span className={styles.barName}>{game.name}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${(game.playtimeHours / maxHours) * 100}%`,
                    }}
                  />
                </div>
                <span className={styles.barValue}>
                  {game.playtimeHours.toLocaleString()}h
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.sidePanel}>
          <div className={styles.ringSection}>
            <p className={styles.chartLabel}>ACHIEVEMENT RATE</p>
            <div className={styles.ringWrapper}>
              <div
                className={styles.ring}
                style={{
                  background: `conic-gradient(var(--accent-bright) ${achPct * 3.6}deg, var(--bg-hover) 0deg)`,
                }}
              >
                <div className={styles.ringInner}>
                  <span className={styles.ringPct}>{achPct}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Tag>
  );
}
