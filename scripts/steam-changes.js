/**
 * Achievement-schema change detection for the Steam library.
 *
 * Developers patch new achievements into games that are already owned. When that
 * happens the completion percentage on the library page silently drops and
 * nothing explains why. `games[].achievements.total` in steam-library.json is
 * the game's schema-level achievement count, so comparing it against the last
 * known value turns that into a readable event:
 *
 *   SULFUR added 2 new achievements (now 131 total)
 *
 * Two writers share this module -- the nightly fetch (fetch-steam-data.js) and
 * the one-off git backfill (backfill-steam-changes.js) -- so the rules for what
 * counts as a change live in exactly one place.
 *
 * Outputs:
 *   src/data/steam-changes.json              the feed, imported by the UI
 *   src/data/steam-achievement-baselines.json  last known total per app, data only
 *
 * The baselines file exists because `total` flaps. Steam intermittently answers
 * with nothing for an app it answered for yesterday -- observed live, where one
 * app went 18 -> null -> 18 across two consecutive syncs. Diffing against the
 * previous file would report that as a change twice over, and would lose a real
 * one in an 18 -> null -> 25 sequence. Diffing against the last *non-null* total
 * instead makes an outage a no-op that the next healthy run catches up on.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const CHANGES_PATH = resolve(__dirname, '../src/data/steam-changes.json');
export const BASELINES_PATH = resolve(__dirname, '../src/data/steam-achievement-baselines.json');

/** How far back the feed keeps events, in days. */
export const RETENTION_DAYS = 90;
/** Hard cap on feed length, so a busy patch week cannot bloat the bundle. */
export const MAX_EVENTS = 150;

/**
 * `YYYY-MM-DD` from an ISO timestamp. Slicing the UTC string rather than going
 * through local time keeps this identical to the `--date=short` keys the
 * backfill reads out of git, so the two writers cannot disagree by a day.
 */
export function toDateKey(iso) {
  return String(iso).slice(0, 10);
}

/** Every date on or after `days` ago, as a `YYYY-MM-DD` cutoff. */
export function cutoffDate(days, from = new Date()) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * appId -> { name, total, unlocked }. `total` is a number, or null when Steam
 * gave us nothing for that app.
 */
export function extractTotals(library) {
  const totals = new Map();
  for (const game of library?.games || []) {
    const total = game.achievements?.total;
    totals.set(game.appId, {
      name: game.name,
      total: typeof total === 'number' ? total : null,
      unlocked: game.achievements?.unlocked ?? 0,
    });
  }
  return totals;
}

/**
 * Games whose achievement list grew since their baseline.
 *
 * Every guard here suppresses a specific false positive:
 *  - no baseline    -> the app is new to the library (out of scope), and it stops
 *                      the first real sync after the hand-made seed commit from
 *                      reporting four thousand games at once
 *  - total not a number -> the `-> null` half of a flap
 *  - total <= baseline  -> a removal (out of scope), and the `null -> 18` recovery,
 *                      since the baseline still reads 18
 *  - nothing unlocked   -> a game that has never been played. The point of the
 *                      feed is explaining why a completion percentage moved, and
 *                      an untouched game has no percentage to move. Most of the
 *                      4000-game library is in this state, so without the guard
 *                      the handful of real entries are buried.
 */
export function diffTotals(baselines, totals, date) {
  const events = [];
  for (const [appId, { name, total, unlocked }] of totals) {
    if (typeof total !== 'number') continue;
    if (!(unlocked > 0)) continue;
    const baseline = baselines[appId];
    if (typeof baseline !== 'number' || baseline <= 0) continue;
    if (total <= baseline) continue;
    events.push({ appId, name, added: total - baseline, total, date });
  }
  return sortEvents(events);
}

/**
 * Carry the baselines forward. Only a real number overwrites a real number, so a
 * night where Steam answers with nothing leaves yesterday's value standing.
 */
export function updateBaselines(baselines, totals) {
  const next = { ...baselines };
  for (const [appId, { total }] of totals) {
    if (typeof total === 'number' && total > 0) next[appId] = total;
  }
  return next;
}

/** Newest first; within a day, biggest addition first, then by name. */
export function sortEvents(events) {
  return [...events].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.added - a.added || a.name.localeCompare(b.name),
  );
}

/** Combine feeds, drop duplicates and anything past the retention window, then cap. */
export function mergeEvents(existing, incoming, from = new Date()) {
  const seen = new Set();
  const cutoff = cutoffDate(RETENTION_DAYS, from);
  const merged = [];
  for (const event of sortEvents([...(existing || []), ...(incoming || [])])) {
    const key = `${event.appId}-${event.date}`;
    if (seen.has(key)) continue;
    if (event.date < cutoff) continue;
    seen.add(key);
    merged.push(event);
  }
  return merged.slice(0, MAX_EVENTS);
}

/** One-line console summary, shared by both writers. */
export function formatEvent(event) {
  const noun = event.added === 1 ? 'achievement' : 'achievements';
  return `${event.date}  ${event.name} +${event.added} ${noun} (now ${event.total})`;
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    console.warn(`Could not parse ${path}, starting fresh.`);
    return fallback;
  }
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

export function readChanges() {
  return readJson(CHANGES_PATH, { generatedAt: null, events: [] }).events || [];
}

export function readBaselines() {
  return readJson(BASELINES_PATH, { updatedAt: null, totals: {} }).totals || {};
}

export function writeChanges(events, generatedAt = new Date().toISOString()) {
  writeJson(CHANGES_PATH, { generatedAt, events });
}

export function writeBaselines(totals, updatedAt = new Date().toISOString()) {
  writeJson(BASELINES_PATH, { updatedAt, totals });
}
