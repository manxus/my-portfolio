import { useEffect, useState } from 'react';
import styles from './SteamGameCover.module.css';

export function libraryCapsuleUrl(appId) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
}

/**
 * Library capsule → header → optional Steam community icon → text placeholder.
 * Icons are tiny; set useIconFallback={false} for large thumbs (e.g. reviews).
 */
export default function SteamGameCover({
  appId,
  title,
  headerUrl,
  iconUrl,
  /** Stretch to fill a sized parent (wishlist + library grid). Omit on review thumbs. */
  fill = false,
  /** Steam icons are low-res; upscaling them in a big portrait slot looks awful. */
  useIconFallback = true,
  rootClassName = '',
  imageClassName = '',
  alt = '',
}) {
  const id = Number(appId);
  const [phase, setPhase] = useState('library');

  useEffect(() => {
    setPhase('library');
  }, [id, headerUrl, iconUrl, useIconFallback]);

  const advance = () => {
    setPhase((p) => {
      if (p === 'library') {
        if (headerUrl) return 'header';
        if (useIconFallback && iconUrl) return 'icon';
        return 'none';
      }
      if (p === 'header') {
        if (useIconFallback && iconUrl) return 'icon';
        return 'none';
      }
      return 'none';
    });
  };

  const showImage =
    phase === 'library' ||
    (phase === 'header' && Boolean(headerUrl)) ||
    (phase === 'icon' && Boolean(iconUrl));

  const src =
    phase === 'library'
      ? libraryCapsuleUrl(id)
      : phase === 'header'
        ? headerUrl
        : iconUrl;

  return (
    <div
      className={`${styles.root} ${fill ? styles.fill : ''} ${rootClassName}`.trim()}
    >
      {showImage && (
        <img
          src={src}
          alt={alt}
          className={`${styles.image} ${imageClassName}`.trim()}
          loading="lazy"
          onError={advance}
        />
      )}
      {phase === 'none' && (
        <div className={styles.placeholder}>
          <span className={styles.placeholderTitle}>{title}</span>
        </div>
      )}
    </div>
  );
}
