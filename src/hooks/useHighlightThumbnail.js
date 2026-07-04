import { useEffect, useState } from 'react';
import { youtubeThumbnailUrl, parseYoutubeVideoId } from '../utils/youtube';
import {
  parseTwitchClipSlug,
  parseTwitchVideoId,
  twitchClipThumbnailUrl,
  isTwitchOembedUrl,
  normalizeTwitchPageUrl,
} from '../utils/twitch';

/** Thumbnails available synchronously (custom, YouTube, Twitch clips). */
export function highlightThumbnailSrcSync(item) {
  const thumb = typeof item?.thumbnail === 'string' ? item.thumbnail.trim() : '';
  if (thumb) return thumb;

  const videoUrl = typeof item?.videoUrl === 'string' ? item.videoUrl.trim() : '';
  if (!videoUrl) return '';

  const yt = parseYoutubeVideoId(videoUrl);
  if (yt) return youtubeThumbnailUrl(yt);

  const clip = parseTwitchClipSlug(videoUrl);
  if (clip) return twitchClipThumbnailUrl(clip);

  return '';
}

/** Resolves highlight thumbnail, fetching Twitch VOD preview via oEmbed when needed. */
export function useHighlightThumbnail(item) {
  const [src, setSrc] = useState(() => highlightThumbnailSrcSync(item));

  useEffect(() => {
    const sync = highlightThumbnailSrcSync(item);
    setSrc(sync);
    if (sync) return undefined;

    const videoUrl = typeof item?.videoUrl === 'string' ? item.videoUrl.trim() : '';
    if (!videoUrl || !parseTwitchVideoId(videoUrl) || !isTwitchOembedUrl(videoUrl)) {
      return undefined;
    }

    const pageUrl = normalizeTwitchPageUrl(videoUrl);
    let cancelled = false;

    fetch(`/api/twitch-oembed?url=${encodeURIComponent(pageUrl)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.thumbnail_url) {
          setSrc(data.thumbnail_url);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [item?.thumbnail, item?.videoUrl]);

  return src;
}
