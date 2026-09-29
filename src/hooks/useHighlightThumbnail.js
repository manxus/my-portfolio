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
  const sync = highlightThumbnailSrcSync(item);
  const videoUrl = typeof item?.videoUrl === 'string' ? item.videoUrl.trim() : '';
  // Only Twitch VODs need the network; everything else resolves above.
  const pageUrl =
    !sync && videoUrl && parseTwitchVideoId(videoUrl) && isTwitchOembedUrl(videoUrl)
      ? normalizeTwitchPageUrl(videoUrl)
      : null;

  // Tagged with the page it came from, so a changed item never shows a stale
  // thumbnail while its own lookup is in flight.
  const [fetched, setFetched] = useState({ pageUrl: null, src: '' });

  useEffect(() => {
    if (!pageUrl) return undefined;
    let cancelled = false;

    fetch(`/api/twitch-oembed?url=${encodeURIComponent(pageUrl)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.thumbnail_url) {
          setFetched({ pageUrl, src: data.thumbnail_url });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pageUrl]);

  return sync || (pageUrl && fetched.pageUrl === pageUrl ? fetched.src : '');
}
