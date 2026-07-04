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

  const [resolvedAssets, setResolvedAssets] = useState({
    libraryCapsuleUrl: libraryCapsuleUrl || null,
    libraryHeaderUrl: libraryHeaderUrl || null,
  });

  useEffect(() => {
    let cancelled = false;
    const fromProps = {
      libraryCapsuleUrl: libraryCapsuleUrl || null,
      libraryHeaderUrl: libraryHeaderUrl || null,
    };
    setResolvedAssets(fromProps);

    if (fromProps.libraryCapsuleUrl && fromProps.libraryHeaderUrl) {
      return undefined;
    }

    fetchSteamLibraryAssets(id).then((assets) => {
      if (cancelled) return;
      setResolvedAssets({
        libraryCapsuleUrl:
          fromProps.libraryCapsuleUrl || assets.libraryCapsuleUrl,
        libraryHeaderUrl:
          fromProps.libraryHeaderUrl || assets.libraryHeaderUrl,
      });
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

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [sources]);

  const src = sources[index];
  const showImage = index < sources.length;

  const advance = () => {
    setIndex((i) => i + 1);
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
