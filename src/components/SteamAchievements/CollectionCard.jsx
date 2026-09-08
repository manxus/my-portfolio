import SteamGameCover from '../SteamGameCover/SteamGameCover';
import styles from './SteamCollections.module.css';

/**
 * One collection as a single card, its artwork a row of the series' own box
 * art standing upright and fanned like games on a shelf.
 *
 * Perfected games come first, so a complete series leads with the art you
 * actually earned.
 */

/**
 * Beyond three the covers are thin slivers you cannot identify, which defeats
 * the point of showing art at all. The rest of the series is one click away in
 * the detail panel.
 */
const MAX_TILES = 3;

/** Widest a single cover may get, as a share of the card. */
const MAX_TILE_WIDTH = 42;

/** How far each cover advances past the one before it, as a share of a cover. */
const ADVANCE = 0.62;

/**
 * Share of the card the fan may span. Short of 100 on purpose: the outer covers
 * are rotated, so their corners reach wider than their layout box and would
 * otherwise clip against the card edge.
 */
const SPAN = 88;

/** Degrees between neighbouring covers in the fan. */
const TILT_STEP = 5;

/**
 * How far the outermost cover may lean. Without a cap the fan widens with every
 * extra game -- a seven-cover series reached 15 degrees, and the rotated corners
 * pushed past the card edge.
 */
const MAX_FAN = 10;

/** Pixels each cover rises toward the centre of the fan. */
const LIFT_STEP = 3;

/**
 * Size the covers so any number of them spans the card without overflowing:
 * each one advances a fixed fraction of its own width, so more games simply
 * means more overlap rather than a wider row.
 */
function shelfMetrics(count) {
  const width = Math.min(MAX_TILE_WIDTH, SPAN / (1 + ADVANCE * (count - 1)));
  return {
    '--tile-w': `${width}%`,
    '--tile-overlap': `${width * (1 - ADVANCE)}%`,
  };
}

/** Degrees per step, tightened so the outermost cover never passes MAX_FAN. */
function tiltStep(count) {
  const outermost = Math.max(1, (count - 1) / 2);
  return Math.min(TILT_STEP, MAX_FAN / outermost);
}

/**
 * Lay the covers out from the middle: the first game in the collection stands
 * front and centre, the second goes to its left, the third to its right.
 *
 * Order comes straight from the collection's game list, so rearranging that
 * list in the editor is what decides which cover leads the card.
 */
function arrangeFromCentre(list) {
  const out = [];
  list.forEach((game, rank) => {
    const entry = { game, rank };
    if (rank === 0) out.push(entry);
    else if (rank % 2 === 1) out.unshift(entry);
    else out.push(entry);
  });
  return out;
}

export default function CollectionCard({ row, expanded, onToggle, children }) {
  const chosen = row.games.slice(0, MAX_TILES);
  const tiles = arrangeFromCentre(chosen);
  const complete = row.complete;
  const step = tiltStep(tiles.length);

  return (
    <div
      className={`${styles.card} ${complete ? styles.cardComplete : ''} ${
        row.invalid ? styles.cardInvalid : ''
      } ${expanded ? styles.cardExpanded : ''}`}
    >
      <button
        type="button"
        className={styles.cardMain}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span
          className={styles.shelf}
          style={shelfMetrics(tiles.length)}
          aria-hidden="true"
        >
          {tiles.map(({ game, rank }, i) => {
            // Fan out from the middle: the centre cover stands straight, the
            // outer ones lean away from it.
            const spread = tiles.length > 1 ? i - (tiles.length - 1) / 2 : 0;
            return (
              <span
                key={game.appId}
                className={styles.tile}
                style={{
                  '--tilt': `${spread * step}deg`,
                  '--lift': `${Math.abs(spread) * LIFT_STEP}px`,
                  // Earlier in the list means further forward, so the first
                  // game overlaps the rest rather than being covered by them.
                  zIndex: tiles.length - rank,
                }}
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
                  alt=""
                  rootClassName={styles.tileRoot}
                  imageClassName={styles.tileImg}
                />
              </span>
            );
          })}
          {tiles.length === 0 && <span className={styles.tileEmpty} />}
        </span>

        {/* Name bottom-left, completion bottom-right. */}
        <span className={styles.cardOverlay}>
          <span className={styles.cardName}>{row.name.toUpperCase()}</span>
          <span
            className={`${styles.rollup} ${row.invalid ? styles.rollupInvalid : ''} ${
              complete ? styles.rollupComplete : ''
            }`}
          >
            {row.invalid
              ? 'NEEDS FIXING'
              : `${row.perfected}/${row.tracked} PERFECTED`}
          </span>
        </span>
      </button>

      {children}
    </div>
  );
}
