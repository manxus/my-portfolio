/**
 * Extract Twitch clip slug from common URL shapes.
 */
export function parseTwitchClipSlug(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const patterns = [
    /clips\.twitch\.tv\/([\w-]+)\b/i,
    /twitch\.tv\/[\w]+\/clip\/([\w-]+)\b/i,
    /twitch\.tv\/clip\/([\w-]+)\b/i,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return null;
}

/**
 * Extract Twitch VOD / upload id from watch URLs (e.g. twitch.tv/videos/1234567890).
 */
export function parseTwitchVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const patterns = [
    /twitch\.tv\/videos\/(\d+)\b/i,
    /player\.twitch\.tv\/\?[^#]*\bvideo=(\d+)\b/i,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return null;
}

export function twitchClipEmbedUrl(slug, parentHostname) {
  const q = new URLSearchParams({
    clip: slug,
    parent: parentHostname,
  });
  return `https://clips.twitch.tv/embed?${q}`;
}

/** Preview image bundled with Twitch clip embeds. */
export function twitchClipThumbnailUrl(slug) {
  if (!slug) return '';
  return `https://clips-media-assets2.twitch.tv/${slug}-preview-480x272.jpg`;
}

export function twitchVideoEmbedUrl(videoId, parentHostname) {
  const q = new URLSearchParams({
    video: videoId,
    parent: parentHostname,
  });
  return `https://player.twitch.tv/?${q}`;
}

/** Normalize a Twitch page URL for oEmbed (clips + VODs). */
export function normalizeTwitchPageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function isTwitchOembedUrl(url) {
  const normalized = normalizeTwitchPageUrl(url);
  if (!normalized) return false;
  return /twitch\.tv/i.test(normalized) && (
    parseTwitchVideoId(normalized) != null || parseTwitchClipSlug(normalized) != null
  );
}
