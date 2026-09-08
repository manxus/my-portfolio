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
