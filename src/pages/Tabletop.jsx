import { motion } from 'framer-motion';
import defaultTabletopData from '../data/tabletop.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import styles from './Tabletop.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

function coverSrc(item) {
  const url = typeof item.coverUrl === 'string' ? item.coverUrl.trim() : '';
  return url;
}

function resolveExternalUrl(url) {
  const href = typeof url === 'string' ? url.trim() : '';
  if (!href) return '';
  if (href.startsWith('/')) return href;
  return /^https?:\/\//i.test(href) ? href : `https://${href}`;
}

function openExternalUrl(url) {
  const resolved = resolveExternalUrl(url);
  if (!resolved) return;
  if (resolved.startsWith('/')) {
    window.location.assign(resolved);
    return;
  }
  window.open(resolved, '_blank', 'noopener,noreferrer');
}

function isOwned(item) {
  return item.owned === true;
}

function isFavorite(item) {
  return item.featured === true;
}

function isWishlist(item) {
  return item.wishlist === true;
}

function toStatCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function hasStats(item) {
  return toStatCount(item.wins) > 0 || toStatCount(item.losses) > 0;
}

function formatStats(item) {
  const wins = toStatCount(item.wins);
  const losses = toStatCount(item.losses);
  if (wins === 0 && losses === 0) return '';
  return `${wins}W · ${losses}L`;
}

function computeRecord(games) {
  let wins = 0;
  let losses = 0;
  for (const game of games) {
    wins += toStatCount(game.wins);
    losses += toStatCount(game.losses);
  }
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  return { wins, losses, total, winRate };
}

function GameCover({ item }) {
  const cover = coverSrc(item);
  if (cover) {
    return (
      <img
        src={cover}
        alt={item.title}
        className={styles.image}
        loading="lazy"
      />
    );
  }
  return <div className={styles.coverPlaceholder} aria-hidden />;
}

function GameCard({ item, index }) {
  const hasLink = Boolean(resolveExternalUrl(item.bggUrl));
  const designer = typeof item.designer === 'string' ? item.designer.trim() : '';
  const playerCount = typeof item.playerCount === 'string' ? item.playerCount.trim() : '';
  const statsLine = formatStats(item);

  return (
    <motion.div
      role={hasLink ? 'link' : undefined}
      tabIndex={hasLink ? 0 : undefined}
      variants={fadeUp}
      className={`${styles.card}${hasLink ? ` ${styles.cardClickable}` : ''}`}
      onClick={() => hasLink && openExternalUrl(item.bggUrl)}
      onKeyDown={(e) => {
        if (!hasLink) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openExternalUrl(item.bggUrl);
        }
      }}
    >
      <div className={styles.imageWrap}>
        <GameCover item={item} />
      </div>
      <div className={styles.cardInfo}>
        <div className={styles.cardTitleRow}>
          <h4 className={styles.cardTitle}>{item.title}</h4>
          {index >= 0 && <EditableItemControls index={index} />}
        </div>
        {designer && <p className={styles.cardDesigner}>{designer}</p>}
        {statsLine && <p className={styles.statsLine}>{statsLine}</p>}
        {playerCount && <p className={styles.playerCount}>{playerCount} players</p>}
        {item.description && (
          <p className={styles.cardDesc}>{item.description}</p>
        )}
      </div>
    </motion.div>
  );
}

function ItemGrid({ items, filter }) {
  const filtered = items.filter(filter);
  if (filtered.length === 0) return null;

  return (
    <motion.div className={styles.grid} variants={stagger}>
      {filtered.map((item) => {
        const fullIndex = items.findIndex((entry) => entry.id === item.id);
        return (
          <GameCard
            key={item.id}
            item={item}
            index={fullIndex}
          />
        );
      })}
    </motion.div>
  );
}

export default function Tabletop() {
  const games = defaultTabletopData.games ?? [];
  const favorites = games.filter(isFavorite);
  const physicalShelf = games.filter(isOwned);
  const wishlist = games.filter(isWishlist);
  const record = computeRecord(games);
  const showRecord = games.some(hasStats);
  const hasCatalog =
    favorites.length > 0 || physicalShelf.length > 0 || wishlist.length > 0;

  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <EditableSection collection="tabletop" dataKey="games">
        <div className={styles.catalogWrap}>
          {games.length === 0 ? (
            <p className={styles.emptyCatalog}>No games logged yet.</p>
          ) : (
            <>
              {showRecord && (
                <motion.section variants={fadeUp} className={styles.recordSection}>
                  <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}>&gt;</span> RECORD
                  </h2>
                  <div className={styles.recordBar}>
                    <span className={styles.recordStat}>
                      <span className={styles.recordValue}>{record.wins}</span>
                      <span className={styles.recordLabel}>WINS</span>
                    </span>
                    <span className={styles.recordDivider} aria-hidden>
                      ·
                    </span>
                    <span className={styles.recordStat}>
                      <span className={styles.recordValue}>{record.losses}</span>
                      <span className={styles.recordLabel}>LOSSES</span>
                    </span>
                    {record.total > 0 && (
                      <>
                        <span className={styles.recordDivider} aria-hidden>
                          ·
                        </span>
                        <span className={styles.recordStat}>
                          <span className={styles.recordValue}>{record.winRate}%</span>
                          <span className={styles.recordLabel}>WIN RATE</span>
                        </span>
                      </>
                    )}
                  </div>
                </motion.section>
              )}

              {!hasCatalog && (
                <p className={styles.emptyCatalog}>
                  No favorites, owned games, or wishlist items yet.
                </p>
              )}

              {favorites.length > 0 && (
                <motion.section variants={fadeUp} className={styles.catalogSection}>
                  <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}>&gt;</span> FAVORITES
                  </h2>
                  <ItemGrid items={games} filter={isFavorite} />
                </motion.section>
              )}

              {physicalShelf.length > 0 && (
                <motion.section variants={fadeUp} className={styles.catalogSection}>
                  <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}>&gt;</span> PHYSICAL SHELF
                  </h2>
                  <ItemGrid items={games} filter={isOwned} />
                </motion.section>
              )}

              {wishlist.length > 0 && (
                <motion.section variants={fadeUp} className={styles.catalogSection}>
                  <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}>&gt;</span> WISHLIST
                  </h2>
                  <ItemGrid items={games} filter={isWishlist} />
                </motion.section>
              )}
            </>
          )}
        </div>
      </EditableSection>
    </motion.div>
  );
}
