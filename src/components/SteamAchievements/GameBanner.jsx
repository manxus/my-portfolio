import SteamGameCover from '../SteamGameCover/SteamGameCover';
import styles from './SteamAchievements.module.css';

/**
 * A wide game banner with the title and an achievement count over the art.
 * Shared by the showcase's perfect-games strip and the collections rows, which
 * differ only in whether unperfected members are dimmed.
 */
export default function GameBanner({ game, count, dim = false, progress }) {
  return (
    <>
      <SteamGameCover
        fill
        variant="banner"
        appId={game.appId}
        title={game.name}
        headerUrl={game.headerUrl}
        libraryHeaderUrl={game.libraryHeaderUrl}
        iconUrl={game.iconUrl}
        alt={game.name}
        rootClassName={styles.coverRoot}
        imageClassName={`${styles.coverImg} ${dim ? styles.coverDim : ''}`}
      />
      <div className={styles.coverOverlay}>
        <span className={styles.coverName}>{game.name}</span>
        {count && <span className={styles.coverCount}>{count}</span>}
      </div>
      {progress != null && (
        <div className={styles.coverProgress} aria-hidden="true">
          <div
            className={styles.coverProgressFill}
            style={{ width: `${Math.round(progress * 1000) / 10}%` }}
          />
        </div>
      )}
    </>
  );
}
