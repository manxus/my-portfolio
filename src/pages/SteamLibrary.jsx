import { useState } from 'react';
import { motion } from 'framer-motion';
import steamData from '../data/steam-library.json';
import styles from './SteamLibrary.module.css';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function SteamLibrary() {
  const [selectedGame, setSelectedGame] = useState(null);
  const { profile, games } = steamData;

  const totalHours = games.reduce((sum, g) => sum + g.playtimeHours, 0);
  const totalAchievements = games.reduce(
    (sum, g) => sum + (g.achievements?.unlocked || 0),
    0,
  );

  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Profile header */}
      <motion.div variants={fadeUp} className={styles.profileBar}>
        <div className={styles.profileInfo}>
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
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{games.length}</span>
            <span className={styles.statLabel}>GAMES</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {Math.round(totalHours).toLocaleString()}
            </span>
            <span className={styles.statLabel}>HOURS</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {totalAchievements.toLocaleString()}
            </span>
            <span className={styles.statLabel}>ACHIEVEMENTS</span>
          </div>
        </div>
      </motion.div>

      {/* Game grid */}
      <motion.div variants={fadeUp} className={styles.grid}>
        {games.map((game) => (
          <button
            key={game.appId}
            className={`${styles.gameCard} ${selectedGame === game.appId ? styles.gameSelected : ''}`}
            onClick={() =>
              setSelectedGame(
                selectedGame === game.appId ? null : game.appId,
              )
            }
          >
            <div className={styles.gameHeader}>
              <img
                src={game.headerUrl}
                alt={game.name}
                className={styles.gameImage}
                loading="lazy"
              />
              <div className={styles.gameOverlay}>
                <span className={styles.gameHours}>
                  {game.playtimeHours.toLocaleString()}h
                </span>
              </div>
            </div>
            <div className={styles.gameInfo}>
              <h4 className={styles.gameName}>{game.name}</h4>
              {game.achievements && (
                <div className={styles.achievementBar}>
                  <div className={styles.achievementTrack}>
                    <div
                      className={styles.achievementFill}
                      style={{
                        width: `${(game.achievements.unlocked / game.achievements.total) * 100}%`,
                      }}
                    />
                  </div>
                  <span className={styles.achievementText}>
                    {game.achievements.unlocked}/{game.achievements.total}
                  </span>
                </div>
              )}
            </div>
          </button>
        ))}
      </motion.div>

      <motion.p variants={fadeUp} className={styles.hint}>
        Run <code>node scripts/fetch-steam-data.js</code> with your Steam API
        key to populate with real data.
      </motion.p>
    </motion.div>
  );
}
