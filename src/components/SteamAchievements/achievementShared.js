// Shared achievement helpers + derived-data builder used by the Achievements
// and Overview tabs so the flattening/labeling logic lives in one place.

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
 * Derive the shared achievement collections from the raw games list:
 * - gamesWithItems: games that carry full per-achievement detail
 * - unlockedAch: every unlocked achievement, annotated with appId + gameName
 * - perfectGames: 100%-completed games, sorted by achievement count desc
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
    .filter(
      (g) =>
        g.achievements.total > 0 &&
        g.achievements.unlocked === g.achievements.total,
    )
    .sort((a, b) => b.achievements.total - a.achievements.total);

  return { gamesWithItems, unlockedAch, perfectGames };
}
