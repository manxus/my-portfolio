import { useEffect, useMemo, useState } from 'react';
import {
  defaultHeaderUrl,
  fetchSteamLibraryAssets,
  legacyLibraryCapsuleUrls,
} from '../../utils/steamArt';
import styles from './SteamGameCover.module.css';

/**
 * Portrait grid art (same family as Steam library grid view).
 * cover: library_capsule → legacy library_600x900 → store header → app icon → text
 * banner: store header → library_header → app icon → text
 *
 * Header in portrait is only used when no library capsule exists (older titles).
 */
export default function SteamGameCover({
  appId,
  title,
  headerUrl,
  libraryCapsuleUrl,
  libraryHeaderUrl,
  iconUrl,
  fill = false,
  variant = 'cover',
  useIconFallback = true,
  rootClassName = '',
  imageClassName = '',
  alt = '',
}) {
  const id = Number(appId);
  const resolvedHeader = headerUrl || defaultHeaderUrl(id);

  // Looked-up art is stored with the appId it belongs to, so a different game
  // never shows the previous one's art while its own lookup is in flight.
  const [fetched, setFetched] = useState({ id: null, assets: null });
  const fetchedAssets = fetched.id === id ? fetched.assets : null;
  const resolvedAssets = {
    libraryCapsuleUrl: libraryCapsuleUrl || fetchedAssets?.libraryCapsuleUrl || null,
    libraryHeaderUrl: libraryHeaderUrl || fetchedAssets?.libraryHeaderUrl || null,
  };

  useEffect(() => {
    if (libraryCapsuleUrl && libraryHeaderUrl) return undefined;
    let cancelled = false;
    fetchSteamLibraryAssets(id).then((assets) => {
      if (!cancelled) setFetched({ id, assets });
    });
    return () => {
      cancelled = true;
    };
  }, [id, libraryCapsuleUrl, libraryHeaderUrl]);

  const sources = useMemo(() => {
    const list = [];
    if (variant === 'cover') {
      if (resolvedAssets.libraryCapsuleUrl) list.push(resolvedAssets.libraryCapsuleUrl);
      for (const url of legacyLibraryCapsuleUrls(id)) {
        if (!list.includes(url)) list.push(url);
      }
      if (!list.includes(resolvedHeader)) list.push(resolvedHeader);
      if (
        resolvedAssets.libraryHeaderUrl &&
        !list.includes(resolvedAssets.libraryHeaderUrl)
      ) {
        list.push(resolvedAssets.libraryHeaderUrl);
      }
    } else {
      list.push(resolvedHeader);
      if (
        resolvedAssets.libraryHeaderUrl &&
        !list.includes(resolvedAssets.libraryHeaderUrl)
      ) {
        list.push(resolvedAssets.libraryHeaderUrl);
      }
    }
    if (useIconFallback && iconUrl && !list.includes(iconUrl)) {
      list.push(iconUrl);
    }
    return list;
  }, [
    variant,
    id,
    resolvedHeader,
    resolvedAssets.libraryCapsuleUrl,
    resolvedAssets.libraryHeaderUrl,
    iconUrl,
    useIconFallback,
  ]);

  // Failed-image count for this exact source list; a new list starts at 0.
  const [failures, setFailures] = useState({ sources: null, count: 0 });
  const index = failures.sources === sources ? failures.count : 0;
  const src = sources[index];
  const showImage = index < sources.length;

  const advance = () => {
    setFailures((f) => ({ sources, count: (f.sources === sources ? f.count : 0) + 1 }));
  };

  return (
    <div
      className={`${styles.root} ${fill ? styles.fill : ''} ${rootClassName}`.trim()}
    >
      {showImage && (
        <img
          key={src}
          src={src}
          alt={alt}
          className={`${styles.image} ${imageClassName}`.trim()}
          loading="lazy"
          onError={advance}
        />
      )}
      {!showImage && (
        <div className={styles.placeholder}>
          <span className={styles.placeholderTitle}>{title}</span>
        </div>
      )}
    </div>
  );
}
