/**
 * Extract YouTube video id from common URL shapes (watch, youtu.be, embed, shorts, live).
 */
export function parseYoutubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*\bv=)([\w-]{11})\b/,
    /youtu\.be\/([\w-]{11})\b/,
    /youtube\.com\/embed\/([\w-]{11})\b/,
    /youtube\.com\/shorts\/([\w-]{11})\b/,
    /youtube\.com\/live\/([\w-]{11})\b/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return null;
}

export function youtubeEmbedUrl(videoId) {
  const q = new URLSearchParams({ rel: '0', modestbranding: '1' });
  return `https://www.youtube.com/embed/${videoId}?${q}`;
}

/** hqdefault exists for almost all videos; maxresdefault can 404 on older uploads */
export function youtubeThumbnailUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
