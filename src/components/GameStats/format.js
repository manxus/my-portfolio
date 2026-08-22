export function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
}

export function formatScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/**
 * Record grids mix counts with totals four orders of magnitude larger -- 979 knife kills next to
 * 289,908,620 dollars earned. Grouping digits keeps the counts exact and readable, but the big
 * totals would blow the cell width, so those alone fall back to the abbreviated form.
 */
export function formatStat(value) {
  return Number(value) >= 1_000_000 ? formatScore(value) : formatNumber(value);
}

export function formatPct(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : '0%';
}

/** 8003131 -> "92d 14h". Hours alone stop meaning anything at four figures. */
export function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return '0h';

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;

  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** Metres to a human distance: 111349 -> "111.3 km". Belt runs pass a kilometre early. */
export function formatDistance(metres) {
  const n = Number(metres);
  if (!Number.isFinite(n)) return '0 m';
  return n >= 1000 ? `${(n / 1000).toFixed(1)} km` : `${formatNumber(Math.round(n))} m`;
}
