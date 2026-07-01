import { useEffect, useMemo, useState } from 'react';
import styles from './SteamGameCover.module.css';

export function libraryCapsuleUrl(appId) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
}

/**
 * Library capsule → header → optional Steam community icon → text placeholder.
 * Icons are tiny; set useIconFallback={false} for large thumbs (e.g. reviews).
 * Set textFallbackOnly to skip header/icon and use the text tile when the capsule fails.
 * Set preferHeader to lead with the horizontal header banner (falls back to the capsule).
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
  /** Only try the library capsule; on error show the text placeholder (no header/icon). */
  textFallbackOnly = false,
  /** Lead with the horizontal header banner instead of the vertical capsule. */
  preferHeader = false,
  rootClassName = '',
  imageClassName = '',
  alt = '',
}) {
  const id = Number(appId);

  const sequence = useMemo(() => {
    if (textFallbackOnly) return ['library', 'none'];
    const seq = [];
    if (preferHeader && headerUrl) {
      seq.push('header', 'library');
    } else {
      seq.push('library');
      if (headerUrl) seq.push('header');
    }
    if (useIconFallback && iconUrl) seq.push('icon');
    seq.push('none');
    return seq;
  }, [textFallbackOnly, preferHeader, headerUrl, iconUrl, useIconFallback]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [id, headerUrl, iconUrl, useIconFallback, textFallbackOnly, preferHeader]);

  const phase = sequence[Math.min(index, sequence.length - 1)];

  const advance = () => {
    setIndex((i) => Math.min(i + 1, sequence.length - 1));
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
