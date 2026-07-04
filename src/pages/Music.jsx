import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import musicData from '../data/music.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import { fetchSpotifyThumbnailUrl } from '../utils/spotify';
import styles from './Music.module.css';

const FAVORITES = musicData.favorites || [];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function coverSrc(item) {
  const url = typeof item.coverUrl === 'string' ? item.coverUrl.trim() : '';
  return url;
}

function resolveListenUrl(url) {
  const href = typeof url === 'string' ? url.trim() : '';
  if (!href) return '';
  if (href.startsWith('/')) return href;
  return /^https?:\/\//i.test(href) ? href : `https://${href}`;
}

function openListenUrl(url) {
  const resolved = resolveListenUrl(url);
  if (!resolved) return;
  if (resolved.startsWith('/')) {
    window.location.assign(resolved);
    return;
  }
  window.open(resolved, '_blank', 'noopener,noreferrer');
}

function isKind(item, kind) {
  return (item.kind || '').trim().toLowerCase() === kind.toLowerCase();
}

function isFeaturedAlbum(item) {
  return isKind(item, 'Album') && item.featured === true;
}

function physicalFormatLabel(item) {
  if (!isKind(item, 'Album')) return '';
  const format = typeof item.physicalFormat === 'string' ? item.physicalFormat.trim() : '';
  if (!format || format.toLowerCase() === 'none') return '';
  return format;
}

function hasPhysicalCopy(item) {
  return Boolean(physicalFormatLabel(item));
}

function FavoriteCover({ item }) {
  const manualCover = coverSrc(item);
  const [autoCover, setAutoCover] = useState('');

  useEffect(() => {
    if (manualCover) {
      setAutoCover('');
      return undefined;
    }

    const listenUrl = resolveListenUrl(item.listenUrl);
    if (!listenUrl) return undefined;

    let cancelled = false;
    fetchSpotifyThumbnailUrl(listenUrl).then((thumb) => {
      if (!cancelled && thumb) setAutoCover(thumb);
    });

    return () => {
      cancelled = true;
    };
  }, [manualCover, item.listenUrl]);

  const cover = manualCover || autoCover;

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

function FavoriteCard({ item, index, showPhysicalBadge = false }) {
  const hasLink = Boolean(resolveListenUrl(item.listenUrl));
  const artist = typeof item.artist === 'string' ? item.artist.trim() : '';
  const showArtist = isKind(item, 'Album') && artist;
  const physical = showPhysicalBadge ? physicalFormatLabel(item) : '';

  return (
    <motion.div
      role={hasLink ? 'link' : undefined}
      tabIndex={hasLink ? 0 : undefined}
      variants={fadeUp}
      className={`${styles.card} ${hasLink ? styles.cardClickable : ''}`}
      onClick={() => hasLink && openListenUrl(item.listenUrl)}
      onKeyDown={(e) => {
        if (!hasLink) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openListenUrl(item.listenUrl);
        }
      }}
    >
      <div className={styles.imageWrap}>
        <FavoriteCover item={item} />
        {physical && (
          <div className={styles.overlay}>
            <span className={styles.physicalBadge} title={`Physical copy · ${physical}`}>
              {physical.toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className={styles.cardInfo}>
        <div className={styles.cardTitleRow}>
          <h4 className={styles.cardTitle}>{item.title}</h4>
          {index >= 0 && <EditableItemControls index={index} />}
        </div>
        {showArtist && <p className={styles.cardArtist}>{artist}</p>}
        {item.description && (
          <p className={styles.cardDesc}>{item.description}</p>
        )}
      </div>
    </motion.div>
  );
}

function ItemGrid({ items, filter, showPhysicalBadge = false }) {
  const filtered = items.filter(filter);
  if (filtered.length === 0) return null;

  return (
    <motion.div className={styles.grid} variants={stagger}>
      {filtered.map((item) => {
        const fullIndex = items.findIndex((entry) => entry.id === item.id);
        return (
          <FavoriteCard
            key={item.id}
            item={item}
            index={fullIndex}
            showPhysicalBadge={showPhysicalBadge}
          />
        );
      })}
    </motion.div>
  );
}

export default function Music() {
  const artists = FAVORITES.filter((item) => isKind(item, 'Artist'));
  const favoriteAlbums = FAVORITES.filter(isFeaturedAlbum);
  const physicalAlbums = FAVORITES.filter(hasPhysicalCopy);

  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <EditableSection collection="music" dataKey="favorites">
        <div className={styles.catalogWrap}>
          {artists.length > 0 && (
            <motion.section variants={fadeUp} className={styles.catalogSection}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>&gt;</span> ARTISTS
              </h2>
              <ItemGrid items={FAVORITES} filter={(item) => isKind(item, 'Artist')} />
            </motion.section>
          )}

          {favoriteAlbums.length > 0 && (
            <motion.section variants={fadeUp} className={styles.catalogSection}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>&gt;</span> FAVORITE ALBUMS
              </h2>
              <ItemGrid
                items={FAVORITES}
                filter={isFeaturedAlbum}
                showPhysicalBadge
              />
            </motion.section>
          )}

          {physicalAlbums.length > 0 && (
            <motion.section variants={fadeUp} className={styles.catalogSection}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>&gt;</span> PHYSICAL SHELF
              </h2>
              <ItemGrid
                items={FAVORITES}
                filter={hasPhysicalCopy}
                showPhysicalBadge
              />
            </motion.section>
          )}
        </div>
      </EditableSection>
    </motion.div>
  );
}
