// Shared achievement helpers + derived-data builder used by the Achievements
// and Overview tabs so the flattening/labeling logic lives in one place.

import { isPerfected, completionPct } from '../../utils/steamAchievements';

// Re-exported so achievement consumers have one import site for all of this.
export { isPerfected, completionPct };

// Ordered ascending by max percent; first match wins.
export const RARITY_BUCKETS = [
  { label: 'Ultra Rare', max: 1 },
  { label: 'Very Rare', max: 5 },
  { label: 'Rare', max: 10 },
  { label: 'Uncommon', max: 25 },
  { label: 'Common', max: 50 },
  { label: 'Very Common', max: 101 },
];

export function fmtPct(pct) {
  if (pct == null) return '—';
  if (pct < 1) return `${pct.toFixed(2)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

export function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDate(unixSeconds) {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function rarityLabel(pct) {
  if (pct == null) return null;
  const bucket = RARITY_BUCKETS.find((b) => pct < b.max);
  return bucket ? bucket.label : 'Very Common';
}


/**
 * When a game hit 100%: the moment its last achievement fell.
 *
 * Steam reports unlockTime 0 for achievements earned before it started
 * recording timestamps, so an old game can be perfected with no date at all.
 * Those sort to the back rather than jumping to the front as epoch zero.
 */
export function perfectedAt(game) {
  let latest = 0;
  for (const item of game.achievements?.items || []) {
    if (item.unlocked && item.unlockTime > latest) latest = item.unlockTime;
  }
  return latest;
}

/** Completion at or above which an unfinished game counts as "almost there". */
export const NEAR_COMPLETE_MIN = 0.75;

/**
 * The locked achievement fewest owners have, i.e. what probably stands between
 * this game and 100%. Null when the item list has no locked entries with a
 * known rarity (some games report more achievements than their schema lists).
 */
function hardestLeft(game) {
  let hardest = null;
  for (const item of game.achievements?.items || []) {
    if (item.unlocked || item.globalPct == null) continue;
    if (!hardest || item.globalPct < hardest.globalPct) hardest = item;
  }
  return hardest;
}

/**
 * Derive the shared achievement collections from the raw games list:
 * - gamesWithItems: games that carry full per-achievement detail
 * - unlockedAch: every unlocked achievement, annotated with appId + gameName
 * - perfectGames: 100%-completed games, most recently completed first
 * - nearComplete: unfinished games at NEAR_COMPLETE_MIN or above, fewest
 *   achievements left first (ties go to the higher completion)
 */
export function buildAchievementData(games) {
  const gamesWithItems = (games || []).filter(
    (g) => Array.isArray(g.achievements?.items) && g.achievements.items.length > 0,
  );

  const unlockedAch = [];
  for (const g of gamesWithItems) {
    for (const item of g.achievements.items) {
      if (item.unlocked) {
        unlockedAch.push({ ...item, appId: g.appId, gameName: g.name });
      }
    }
  }

  const perfectGames = gamesWithItems
    .filter(isPerfected)
    .map((g) => ({ ...g, perfectedAt: perfectedAt(g) }))
    .sort((a, b) => b.perfectedAt - a.perfectedAt);

  // Built from the counts, so a game still qualifies without per-achievement
  // detail; it just can't name its hardest achievement left.
  const nearComplete = (games || [])
    .map((g) => ({ game: g, pct: completionPct(g) }))
    .filter(({ pct }) => pct != null && pct >= NEAR_COMPLETE_MIN && pct < 1)
    .map(({ game, pct }) => ({
      ...game,
      pct,
      left: game.achievements.total - game.achievements.unlocked,
      hardestLeft: hardestLeft(game),
    }))
    .sort((a, b) => a.left - b.left || b.pct - a.pct);

  return { gamesWithItems, unlockedAch, perfectGames, nearComplete };
}
