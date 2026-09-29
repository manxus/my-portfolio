/**
 * Achievement primitives shared by the Steam page, its components and the
 * collections rollup. These live in utils rather than in the Achievements
 * component folder so `steamCollections.js` can use them without a util
 * reaching back into components.
 */

/** A game is perfected when every tracked achievement is unlocked. */
export function isPerfected(game) {
  const ach = game?.achievements;
  return Boolean(ach && ach.total > 0 && ach.unlocked === ach.total);
}

/** Fraction unlocked, or null when the game tracks no achievements at all. */
export function completionPct(game) {
  const ach = game?.achievements;
  if (!ach || !ach.total) return null;
  return ach.unlocked / ach.total;
}

/**
 * Every achievement icon lives at the same CDN path under its own app id, so
 * the snapshot stores only the file stem (`icon`) instead of the full URL
 * twice over. The prefix alone came to about 8 MB of the library JSON. A full
 * `iconUrl` still wins when present, so an older snapshot keeps working.
 */
const ACH_ICON_BASE = 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps';

export function achievementIconUrl(appId, item) {
  if (item?.iconUrl) return item.iconUrl;
  if (!item?.icon) return null;
  return `${ACH_ICON_BASE}/${appId}/${item.icon}.jpg`;
}

/** Inverse of achievementIconUrl: the stem to store, or null when the URL is off-pattern. */
export function achievementIconStem(appId, url) {
  const prefix = `${ACH_ICON_BASE}/${appId}/`;
  if (typeof url !== 'string' || !url.startsWith(prefix) || !url.endsWith('.jpg')) return null;
  const stem = url.slice(prefix.length, -'.jpg'.length);
  return stem && !stem.includes('/') ? stem : null;
}
