import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import musicData from '../data/music.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import { fetchSpotifyThumbnailUrl } from '../utils/spotify';
import styles from './Music.module.css';

const FAVORITES = musicData.favorites || [];
const PERFORMANCES = musicData.performances || [];

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

const MONTH_LABELS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

function formatPerformanceDate(dateStr) {
  const match = String(dateStr ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(dateStr ?? '').trim();
  const month = MONTH_LABELS[Number(match[2]) - 1] || match[2];
  return `${match[3]} ${month} ${match[1]}`;
}

function sortPerformancesByDate(performances) {
  return [...performances].sort((a, b) => {
    const dateCmp = String(b.date ?? '').localeCompare(String(a.date ?? ''));
    if (dateCmp !== 0) return dateCmp;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

function PerformanceList({ performances }) {
  const sorted = sortPerformancesByDate(performances);

  if (sorted.length === 0) {
    return <p className={styles.emptyList}>No shows logged yet.</p>;
  }

  return (
    <div className={styles.performanceList}>
      {sorted.map((show) => {
        const fullIndex = performances.findIndex((entry) => entry.id === show.id);
        const artist = typeof show.artist === 'string' ? show.artist.trim() : '';
        const venue = typeof show.venue === 'string' ? show.venue.trim() : '';
        const city = typeof show.city === 'string' ? show.city.trim() : '';
        const tourFestival = typeof show.tourFestival === 'string' ? show.tourFestival.trim() : '';
        const hasLink = Boolean(resolveListenUrl(show.listenUrl));
        const hasCoverSource = Boolean(coverSrc(show) || hasLink);

        return (
          <motion.div key={show.id} variants={fadeUp} className={styles.performanceItem}>
            <div className={styles.performanceDot} aria-hidden />
            <article
              role={hasLink ? 'link' : undefined}
              tabIndex={hasLink ? 0 : undefined}
              className={`${styles.performanceRow}${hasLink ? ` ${styles.performanceRowClickable}` : ''}`}
              onClick={() => hasLink && openListenUrl(show.listenUrl)}
              onKeyDown={(e) => {
                if (!hasLink) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openListenUrl(show.listenUrl);
                }
              }}
            >
              <time className={styles.performanceDate} dateTime={show.date}>
                {formatPerformanceDate(show.date)}
              </time>
              {hasCoverSource && (
                <div className={styles.performanceCoverWrap}>
                  <PerformanceCover show={show} />
                </div>
              )}
              <div className={styles.performanceContent}>
                {tourFestival && (
                  <span className={styles.performanceTourFestival}>{tourFestival}</span>
                )}
                <div className={styles.performanceTitleRow}>
                  <h3 className={styles.performanceArtist}>{artist}</h3>
                  {fullIndex >= 0 && <EditableItemControls index={fullIndex} />}
                </div>
                {(venue || city) && (
                  <p className={styles.performanceMeta}>
                    {[venue, city].filter(Boolean).join(' \u00b7 ')}
                  </p>
                )}
              </div>
            </article>
          </motion.div>
        );
      })}
    </div>
  );
}

function AutoCover({ coverUrl, listenUrl, alt, imageClassName, placeholderClassName }) {
  const manualCover = typeof coverUrl === 'string' ? coverUrl.trim() : '';
  const [autoCover, setAutoCover] = useState('');

  useEffect(() => {
    if (manualCover) {
      setAutoCover('');
      return undefined;
    }

    const resolved = resolveListenUrl(listenUrl);
    if (!resolved) return undefined;

    let cancelled = false;
    fetchSpotifyThumbnailUrl(resolved).then((thumb) => {
      if (!cancelled && thumb) setAutoCover(thumb);
    });

    return () => {
      cancelled = true;
    };
  }, [manualCover, listenUrl]);

  const cover = manualCover || autoCover;

  if (cover) {
    return (
      <img
        src={cover}
        alt={alt}
        className={imageClassName}
        loading="lazy"
      />
    );
  }

  return <div className={placeholderClassName} aria-hidden />;
}

function FavoriteCover({ item }) {
  return (
    <AutoCover
      coverUrl={item.coverUrl}
      listenUrl={item.listenUrl}
      alt={item.title}
      imageClassName={styles.image}
      placeholderClassName={styles.coverPlaceholder}
    />
  );
}

function PerformanceCover({ show }) {
  const artist = typeof show.artist === 'string' ? show.artist.trim() : '';
  return (
    <AutoCover
      coverUrl={show.coverUrl}
      listenUrl={show.listenUrl}
      alt={artist}
      imageClassName={styles.performanceCoverImage}
      placeholderClassName={styles.performanceCoverPlaceholder}
    />
  );
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

      <motion.section variants={fadeUp} className={styles.catalogSection}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> LIVE SHOWS
        </h2>
        <EditableSection collection="music" dataKey="performances">
          <PerformanceList performances={PERFORMANCES} />
        </EditableSection>
      </motion.section>
    </motion.div>
  );
}
