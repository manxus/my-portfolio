import { useState } from 'react';
import SteamGameCover from '../SteamGameCover/SteamGameCover';
import coverStyles from '../SteamGameCover/SteamGameCover.module.css';
import styles from './PlaytestCover.module.css';

export default function PlaytestCover({
  title,
  appId,
  coverUrl,
  rootClassName = '',
  imageClassName = '',
}) {
  // Remembers which URL failed, so a new coverUrl gets its own attempt without
  // an effect resetting a boolean.
  const [failedUrl, setFailedUrl] = useState(null);
  const id = Number(appId);
  const hasSteamId = Number.isFinite(id) && id > 0;
  const showCustom = coverUrl && failedUrl !== coverUrl;

  if (showCustom) {
    return (
      <div className={`${styles.root} ${rootClassName}`.trim()}>
        <img
          src={coverUrl}
          alt={title}
          className={`${coverStyles.image} ${imageClassName}`.trim()}
          loading="lazy"
          onError={() => setFailedUrl(coverUrl)}
        />
      </div>
    );
  }

  if (hasSteamId) {
    return (
      <SteamGameCover
        fill
        variant="cover"
        appId={id}
        title={title}
        alt={title}
        rootClassName={`${styles.root} ${rootClassName}`.trim()}
        imageClassName={imageClassName}
      />
    );
  }

  return (
    <div className={`${styles.root} ${rootClassName}`.trim()}>
      <div className={coverStyles.placeholder}>
        <span className={coverStyles.placeholderTitle}>{title}</span>
      </div>
    </div>
  );
}
