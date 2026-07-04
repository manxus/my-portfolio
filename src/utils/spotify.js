const thumbnailCache = new Map();

export function isSpotifyUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const { hostname } = new URL(url.trim());
    return hostname === 'open.spotify.com' || hostname.endsWith('.spotify.com');
  } catch {
    return false;
  }
}

/** Album/artist/playlist/track cover via Spotify's public oEmbed API. */
export async function fetchSpotifyThumbnailUrl(spotifyUrl) {
  const normalized = spotifyUrl.trim();
  if (!isSpotifyUrl(normalized)) return null;

  if (thumbnailCache.has(normalized)) {
    return thumbnailCache.get(normalized);
  }

  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(normalized)}`;

  try {
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;
    const data = await res.json();
    const thumb =
      typeof data.thumbnail_url === 'string' ? data.thumbnail_url.trim() : '';
    if (thumb) thumbnailCache.set(normalized, thumb);
    return thumb || null;
  } catch {
    return null;
  }
}
