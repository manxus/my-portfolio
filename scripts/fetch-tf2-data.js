/**
 * Build-time script to fetch Team Fortress 2 career stats (per-class record, per-map time, the
 * class specialities, and the Mann vs Machine counters).
 *
 * Usage:
 *   node --env-file=.env scripts/fetch-tf2-data.js
 *
 * Outputs:
 *   src/data/teamfortress2.json
 *
 * TF2 has the richest stat schema of anything in the library -- 391 populated keys against
 * Counter-Strike's 286 -- and unusually it needs no lookup table: the keys are `<Class>.accum.<metric>`
 * and `<Class>.max.<metric>`, which is enough structure to build the whole page from. The schema's
 * `displayName` fields are useless here (they just repeat the key), so the labels below are written
 * by hand.
 *
 * Three things about this data that the page has to be honest about, all verified against the live
 * API rather than assumed:
 *
 *   1. `iNumDeaths` is 0 for all nine classes. Valve never wired the counter up, so there is no K/D
 *      to show and the script drops the field rather than emitting a misleading zero.
 *   2. `iNumShotsFired` and `iNumShotsHit` are 0 for all nine classes too, so there is no accuracy
 *      either -- the same reason.
 *   3. The `.max.` values are inflated by Mann vs Machine, where a wave kills far more than a
 *      normal round: Heavy's best-round kills reads 206 against a normal-mode ceiling around 13.
 *      They are carried as "best round" with MvM named in the label, not as a clean personal best.
 *
 * There is also a coverage gap worth stating on the page: the per-class playtime counters add up to
 * noticeably less than Steam's own figure for the game, because the latter counts the client being
 * open. Both numbers are emitted so the page can show the gap rather than pick one.
 *
 * Valve also publishes per-map timers, but only for a frozen 2012-era pool that covers about an
 * eighth of the playtime and includes no Mann vs Machine map. The page dropped that section, so this
 * script no longer derives it.
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  requireCredentials,
  fetchUserStats,
  readLibraryEntry,
  buildProfile,
  writeSnapshot,
  round,
  ratio,
  barPct,
} from './steam-stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../src/data/teamfortress2.json');

const APP_ID = 440;

requireCredentials('fetch-tf2-data.js');

/** The nine, in the order the class-selection menu lists them. */
const CLASSES = [
  { key: 'Scout', name: 'Scout' },
  { key: 'Soldier', name: 'Soldier' },
  { key: 'Pyro', name: 'Pyro' },
  { key: 'Demoman', name: 'Demoman' },
  { key: 'Heavy', name: 'Heavy' },
  { key: 'Engineer', name: 'Engineer' },
  { key: 'Medic', name: 'Medic' },
  { key: 'Sniper', name: 'Sniper' },
  { key: 'Spy', name: 'Spy' },
];

/** Counters that accumulate across the career, and what to call them. */
const ACCUM_METRICS = {
  iNumberOfKills: 'Kills',
  iDamageDealt: 'Damage dealt',
  iPlayTime: 'Time played',
  iPointsScored: 'Points scored',
  iKillAssists: 'Kill assists',
  iPointCaptures: 'Point captures',
  iPointDefenses: 'Point defenses',
  iDominations: 'Dominations',
  iRevenge: 'Revenge kills',
  iBuildingsDestroyed: 'Buildings destroyed',
  iBuildingsBuilt: 'Buildings built',
  iNumTeleports: 'Teleports taken',
  iHeadshots: 'Headshots',
  iBackstabs: 'Backstabs',
  iHealthPointsHealed: 'Health healed',
  iHealthPointsLeached: 'Health leached',
  iNumInvulnerable: 'ÜberCharges deployed',
  iFireDamage: 'Fire damage',
};

/** Career-record cells, in reading order. */
const RECORD_METRICS = [
  'iNumberOfKills',
  'iDamageDealt',
  'iPointsScored',
  'iKillAssists',
  'iPointCaptures',
  'iPointDefenses',
  'iDominations',
  'iRevenge',
  'iBuildingsDestroyed',
  'iBuildingsBuilt',
  'iNumTeleports',
  'iFireDamage',
];

/**
 * The counters that only one or two classes ever move, so they read better as a list of what each
 * class is actually for than as columns that are zero eight times out of nine.
 */
const SPECIALITY_METRICS = [
  'iHeadshots',
  'iBackstabs',
  'iHealthPointsHealed',
  'iNumInvulnerable',
  'iHealthPointsLeached',
];

/**
 * Mann vs Machine counters. `TF_MVM_KILL_ROBOT_MEGA_GRIND_STAT` is deliberately absent: it tracks
 * the identical number as the plain grind stat (both read 1,539) because Valve wired one counter to
 * two achievement tiers, and showing it twice would read as two separate facts.
 */
const MVM_LABELS = {
  TF_MVM_KILL_ROBOT_GRIND_STAT: 'Robots destroyed',
  TF_MVM_COLLECT_MONEY_GRIND_STAT: 'Credits collected',
  TF_MVM_MAPS_MANNHATTAN_BOMB_BOT_GRIND_STAT: 'Mannhattan bomb bots stopped',
  TF_MVM_MAPS_MANNHATTAN_PIT_STAT: 'Mannhattan pit kills',
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

function deriveClasses(stats) {
  const rows = CLASSES.map((entry) => {
    const accum = (metric) => stats[`${entry.key}.accum.${metric}`] ?? 0;
    const max = (metric) => stats[`${entry.key}.max.${metric}`] ?? 0;

    return {
      slug: entry.key.toLowerCase(),
      name: entry.name,
      kills: accum('iNumberOfKills'),
      damage: accum('iDamageDealt'),
      secondsPlayed: accum('iPlayTime'),
      // Best single round, inflated by Mann vs Machine -- see the header note. Kept because it is
      // what marks a class's rate columns as MvM-skewed, and the page quotes it in that tooltip.
      bestKills: max('iNumberOfKills'),
      // Damage per minute is the closest thing to a rate this data supports, with deaths and shots
      // both unrecorded.
      damagePerMinute: accum('iPlayTime') > 0 ? round((accum('iDamageDealt') / accum('iPlayTime')) * 60) : 0,
    };
  });

  const best = Math.max(0, ...rows.map((row) => row.kills));
  const played = rows.filter((row) => row.secondsPlayed > 0 || row.kills > 0);
  const totalSeconds = played.reduce((sum, row) => sum + row.secondsPlayed, 0);

  // Mann vs Machine time is folded into the same per-class counters as normal play, and a wave kills
  // an order of magnitude more than a round does. Where a class's best round is wildly out of line
  // with the rest, its rate columns are measuring MvM rather than anything comparable -- flag it so
  // the page can say so instead of ranking a 1,024 dpm Heavy against a 294 dpm Scout as equals.
  const normalBestKills = median(played.map((row) => row.bestKills));
  return played
    .sort((a, b) => b.kills - a.kills)
    .map((row) => ({
      ...row,
      barPct: barPct(row.kills, best),
      // Share of tracked class time. The page leads on kills, so this is the only place the split
      // of where the hours actually went is readable.
      timeSharePct: ratio(row.secondsPlayed, totalSeconds),
      mvmSkewed: normalBestKills > 0 && row.bestKills > normalBestKills * 4,
    }));
}

function assertSanity(summary, classes, stats) {
  if (classes.length === 0) throw new Error('No classes carried any stats.');

  const summed = classes.reduce((sum, row) => sum + row.kills, 0);
  if (summed !== summary.kills) {
    throw new Error(`Class kills sum to ${summed} but the summary says ${summary.kills}.`);
  }
  if (summary.kills <= 0) throw new Error('Career kills came back at zero.');

  // The two facts the page's caveats rest on. If Valve ever populates these the caveats have to be
  // revisited, so fail loudly rather than keep printing a note that is no longer true.
  const deaths = CLASSES.reduce((sum, c) => sum + (stats[`${c.key}.accum.iNumDeaths`] ?? 0), 0);
  const shots = CLASSES.reduce((sum, c) => sum + (stats[`${c.key}.accum.iNumShotsFired`] ?? 0), 0);
  if (deaths > 0 || shots > 0) {
    throw new Error(
      `Valve now populates deaths (${deaths}) or shots (${shots}) for TF2. The page's "no K/D, ` +
        'no accuracy" caveats are stale and the class table should carry those columns.',
    );
  }

  // The shares are a second reading of the same seconds the table already shows, so they have to
  // account for all of it -- a class quietly dropped from the list shows up here and nowhere else.
  const shareSum = classes.reduce((sum, row) => sum + row.timeSharePct, 0);
  if (Math.abs(shareSum - 100) > 0.5) {
    throw new Error(`Class time shares sum to ${shareSum.toFixed(1)}%, not 100%.`);
  }
}

async function main() {
  console.log('Fetching Team Fortress 2 stats...');

  const stats = await fetchUserStats(APP_ID);

  const classes = deriveClasses(stats);

  const total = (metric) => classes.reduce((sum, row) => sum + (row[metric] ?? 0), 0);
  const totalAccum = (metric) =>
    CLASSES.reduce((sum, entry) => sum + (stats[`${entry.key}.accum.${metric}`] ?? 0), 0);

  const library = readLibraryEntry(APP_ID);
  const profile = buildProfile(APP_ID, library);

  const classSeconds = total('secondsPlayed');
  const summary = {
    kills: total('kills'),
    damage: totalAccum('iDamageDealt'),
    points: totalAccum('iPointsScored'),
    assists: totalAccum('iKillAssists'),
    dominations: totalAccum('iDominations'),
    hoursPlayed: round(classSeconds / 3600),
    // Steam's figure counts the client being open; the class counters count time in a class. The
    // gap is wide enough that showing only one of them would misrepresent both.
    libraryHours: profile.libraryHours,
    trackedPct: ratio(classSeconds / 3600, profile.libraryHours),
  };

  const record = RECORD_METRICS.filter((metric) => totalAccum(metric) > 0).map((metric) => ({
    key: metric,
    label: ACCUM_METRICS[metric],
    value: totalAccum(metric),
  }));

  const specialities = SPECIALITY_METRICS.map((metric) => {
    const owner = classes
      .filter((row) => (stats[`${CLASSES.find((c) => c.name === row.name).key}.accum.${metric}`] ?? 0) > 0)
      .map((row) => row.name);
    return {
      key: metric,
      label: ACCUM_METRICS[metric],
      value: totalAccum(metric),
      classes: owner,
    };
  }).filter((entry) => entry.value > 0);

  const mvm = Object.entries(MVM_LABELS)
    .filter(([key]) => (stats[key] ?? 0) > 0)
    .map(([key, label]) => ({ key, label, value: stats[key] }));

  assertSanity(summary, classes, stats);

  writeSnapshot(
    OUTPUT_PATH,
    {
      fetchedAt: new Date().toISOString(),
      profile,
      summary,
      record,
      classes,
      specialities,
      mvm,
    },
    `Wrote src/data/teamfortress2.json -- ${classes.length} classes, ` +
      `${summary.kills.toLocaleString('en-US')} kills, ` +
      `${summary.damage.toLocaleString('en-US')} damage.`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
