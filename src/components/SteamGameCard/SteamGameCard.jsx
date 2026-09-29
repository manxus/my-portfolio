import SteamGameCover from '../SteamGameCover/SteamGameCover';
import { completionPct, isPerfected } from '../../utils/steamAchievements';
import styles from './SteamGameCard.module.css';

/**
 * Portrait library card: cover art with playtime and achievement completion
 * burned into the bottom of the poster. The whole card links to the Steam
 * store page, same as the wishlist grid.
 */
function formatHours(hours) {
  const n = Number(hours) || 0;
  if (n > 0 && n < 10) return n.toFixed(1);
  return Math.round(n).toLocaleString();
}

export default function SteamGameCard({ game }) {
  const hours = Number(game.playtimeHours) || 0;
  const fraction = completionPct(game);
  const pct = fraction == null ? null : Math.round(fraction * 100);
  const perfect = isPerfected(game);

  // Four in five games in the library are untouched bundle filler; a grid of
  // repeated "0h" badges buries the titles that actually have numbers.
  const hasStats = hours > 0 || (game.achievements?.unlocked ?? 0) > 0;

  const achLabel =
    game.achievements &&
    `${game.achievements.unlocked}/${game.achievements.total} achievements`;

  return (
    <a
      href={`https://store.steampowered.com/app/${game.appId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.card}
      title={[game.name, `${formatHours(hours)}h played`, achLabel]
        .filter(Boolean)
        .join(' — ')}
      aria-label={game.name}
    >
      <SteamGameCover
        fill
        variant="cover"
        appId={game.appId}
        title={game.name}
        headerUrl={game.headerUrl}
        libraryCapsuleUrl={game.libraryCapsuleUrl}
        libraryHeaderUrl={game.libraryHeaderUrl}
        iconUrl={game.iconUrl}
        alt={game.name}
        rootClassName={styles.coverRoot}
        imageClassName={styles.image}
      />

      {hasStats && (
        <>
          <div className={styles.meta}>
            <span className={styles.hours}>
              {formatHours(hours)}
              <span className={styles.unit}>h</span>
            </span>
            {pct !== null && (
              <span
                className={`${styles.pct} ${perfect ? styles.pctPerfect : ''}`}
              >
                {pct}%
              </span>
            )}
          </div>

          {pct !== null && (
            <div className={styles.track}>
              <div
                className={`${styles.fill} ${perfect ? styles.fillPerfect : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </>
      )}
    </a>
  );
}
