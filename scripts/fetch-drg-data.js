/**
 * Build-time script to fetch Deep Rock Galactic career stats.
 *
 * Usage:
 *   node --env-file=.env scripts/fetch-drg-data.js
 *
 * Outputs:
 *   src/data/deeprockgalactic.json
 *
 * Deep Rock is the one game in the library where Steam does the labelling work itself: 35 of the 38
 * stats in the schema carry a real `displayName` ("Amount of weakspots hit"), so this script mostly
 * zips the schema against the values and groups them. The label overrides below only shorten the
 * handful that read as a sentence rather than a tile caption.
 *
 * Ghost Ship never shipped per-class or per-mission-type counters through Steam, so there is no
 * list to draw bars against -- the page is grids and tallies, and the numbers stand on their own.
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  requireCredentials,
  fetchUserStats,
  fetchSchemaLabels,
  readLibraryEntry,
  buildProfile,
  writeSnapshot,
  round,
  ratio,
} from './steam-stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../src/data/deeprockgalactic.json');

const APP_ID = 548430;

requireCredentials('fetch-drg-data.js');

/**
 * Steam's stat keys double the name ("MissionsCompleted_MissionsCompleted"); the halves are always
 * identical, so the key the page sees is the first one.
 */
const shortKey = (key) => key.split('_')[0];

/** Schema captions written as full sentences, shortened to fit a tile. */
const LABEL_OVERRIDES = {
  MissionsCompleted: 'Missions completed',
  HostedMissionsCompleted: 'Hosted missions',
  SoloMissionsCompleted: 'Solo missions',
  MilestonesCompleted: 'Milestones completed',
  LowerRankMissionsCompleted: 'Missions carrying rookies',
  AmountOfWeakspotsHit: 'Weakspots hit',
  KilledDreadnaughts: 'Dreadnaughts killed',
  BulkDetonatorsKilled: 'Bulk detonators killed',
  BittergemsCollected: 'Bittergems',
  ErrorCubesCollected: 'Error cubes',
  CompressedGoldCollected: 'Compressed gold',
  MoustachesBought: 'Moustaches bought',
  LootBugsKilled: 'Lootbugs killed',
  SupplyDropsCalled: 'Supply drops called',
  DeepDivesCompleted: 'Deep Dives completed',
  BetCRepaired: 'Bet-C repaired',
  BarRoundsOrdered: 'Rounds bought at the bar',
  TotalDancingTime: 'Time spent dancing',
  SongsPlayed: 'Jukebox songs played',
  LongestMissionTime: 'Longest mission',
  PerksUnlocked: 'Perks unlocked',
  MutatorsPlayed: 'Mutators played',
  MiniMulesRepaired: 'Mini-M.U.L.E.s repaired',
  NumberOfPromotedClasses: 'Classes promoted',
  MissionsPlayedWithoutKicking: 'Missions without a kick',
  HighestBarrelScorePer100Barrels: 'Best barrel-kicking score',
  HighestHoopGameStreak: 'Best hoop streak',
  LongestMollyRideTime: 'Longest Molly ride',
  LongestSilicateRideTime: 'Longest Silicate ride',
  Haz3NoFailStreak: 'Hazard 3 no-fail streak',
  Haz4NoFailStreak: 'Hazard 4 no-fail streak',
  Haz5NoFailStreak: 'Hazard 5 no-fail streak',
};

/** Counters measured in seconds, so the page formats them as durations rather than raw numbers. */
const DURATION_KEYS = new Set([
  'TotalDancingTime',
  'LongestMissionTime',
  'LongestMollyRideTime',
  'LongestSilicateRideTime',
]);

/**
 * Stats Steam returns that the page deliberately does not show. Both are keys Ghost Ship left
 * without a display name, and neither the unit nor the event being counted can be pinned down from
 * the key alone -- captioning them would mean inventing a meaning. Listing them here rather than
 * ignoring them keeps the "not in any section" warning below a real signal that a game update added
 * something new.
 */
const EXCLUDED_KEYS = new Set(['DrillByShootingStat', 'LongPipeStat']);

/**
 * Sections in reading order. Every key Steam returns has to land in exactly one of these or in
 * EXCLUDED_KEYS above, so the warning at the end of the sync stays a real signal that a game update
 * added something new -- silently dropping a new stat is how a page goes quietly stale.
 */
const SECTIONS = [
  {
    id: 'missions',
    title: 'MISSION RECORD',
    keys: [
      'MissionsCompleted',
      'HostedMissionsCompleted',
      'SoloMissionsCompleted',
      'MilestonesCompleted',
      'LowerRankMissionsCompleted',
      'MissionsPlayedWithoutKicking',
      'DeepDivesCompleted',
      'SupplyDropsCalled',
      'LongestMissionTime',
      'MutatorsPlayed',
    ],
  },
  {
    id: 'combat',
    title: 'COMBAT',
    keys: [
      'AmountOfWeakspotsHit',
      'KilledDreadnaughts',
      'BulkDetonatorsKilled',
      // Lootbugs are harmless. 1,535 of them is not an accident.
      'LootBugsKilled',
    ],
  },
  {
    id: 'hazard',
    title: 'HAZARD STREAKS',
    keys: ['Haz3NoFailStreak', 'Haz4NoFailStreak', 'Haz5NoFailStreak'],
  },
  {
    id: 'salvage',
    title: 'SALVAGE',
    keys: [
      'BittergemsCollected',
      'ErrorCubesCollected',
      'CompressedGoldCollected',
      'PerksUnlocked',
      'NumberOfPromotedClasses',
      'MiniMulesRepaired',
      'BetCRepaired',
    ],
  },
  {
    id: 'rockandstone',
    title: 'ROCK AND STONE',
    keys: [
      'TotalDancingTime',
      'SongsPlayed',
      'BarRoundsOrdered',
      'MoustachesBought',
      'HighestBarrelScorePer100Barrels',
      'HighestHoopGameStreak',
      'LongestMollyRideTime',
      'LongestSilicateRideTime',
    ],
  },
];

function labelFor(key, schemaLabels, rawKey) {
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  const fromSchema = schemaLabels[rawKey];
  if (fromSchema) {
    // "Amount of moustaches bought" -> "Moustaches bought".
    const trimmed = fromSchema.replace(/^Amount of\s+/i, '');
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  // Last resort: split the camel case rather than print a machine key.
  return key.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function assertSanity(sections, stats) {
  const missions = stats.MissionsCompleted ?? 0;
  if (missions <= 0) {
    throw new Error('MissionsCompleted came back at zero -- the stat payload is not usable.');
  }
  if ((stats.SoloMissionsCompleted ?? 0) > missions) {
    throw new Error('Solo missions exceed total missions completed; the keys are being misread.');
  }
  const placed = sections.reduce((sum, section) => sum + section.entries.length, 0);
  if (placed === 0) throw new Error('No stats landed in any section.');
}

async function main() {
  console.log('Fetching Deep Rock Galactic stats...');

  const [rawStats, schemaLabels] = await Promise.all([
    fetchUserStats(APP_ID),
    fetchSchemaLabels(APP_ID),
  ]);

  const stats = Object.fromEntries(
    Object.entries(rawStats).map(([key, value]) => [shortKey(key), value]),
  );
  const rawKeyFor = Object.fromEntries(
    Object.keys(rawStats).map((rawKey) => [shortKey(rawKey), rawKey]),
  );

  const sections = SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    entries: section.keys
      .filter((key) => stats[key] !== undefined)
      .map((key) => ({
        key,
        label: labelFor(key, schemaLabels, rawKeyFor[key]),
        value: stats[key],
        kind: DURATION_KEYS.has(key) ? 'duration' : 'count',
      })),
  }));

  const placed = new Set(SECTIONS.flatMap((section) => section.keys));
  const unplaced = Object.keys(stats).filter((key) => !placed.has(key) && !EXCLUDED_KEYS.has(key));
  if (unplaced.length > 0) {
    console.warn(`  ${unplaced.length} stat(s) not in any section: ${unplaced.join(', ')}`);
  }

  const library = readLibraryEntry(APP_ID);
  const profile = buildProfile(APP_ID, library);

  const summary = {
    missionsCompleted: stats.MissionsCompleted ?? 0,
    soloMissions: stats.SoloMissionsCompleted ?? 0,
    hostedMissions: stats.HostedMissionsCompleted ?? 0,
    milestones: stats.MilestonesCompleted ?? 0,
    weakspotsHit: stats.AmountOfWeakspotsHit ?? 0,
    dreadnaughts: stats.KilledDreadnaughts ?? 0,
    promotions: stats.NumberOfPromotedClasses ?? 0,
    hoursPlayed: profile.libraryHours,
    // Roughly how much of the career was spent leading rather than joining -- the two counters do
    // not overlap, so the remainder is missions joined through someone else's lobby.
    hostedPct: ratio(stats.HostedMissionsCompleted ?? 0, stats.MissionsCompleted ?? 0),
    minutesPerMission:
      stats.MissionsCompleted > 0
        ? round((profile.libraryHours * 60) / stats.MissionsCompleted)
        : 0,
  };

  assertSanity(sections, stats);

  writeSnapshot(
    OUTPUT_PATH,
    { fetchedAt: new Date().toISOString(), profile, summary, sections },
    `Wrote src/data/deeprockgalactic.json -- ${summary.missionsCompleted} missions, ` +
      `${summary.weakspotsHit.toLocaleString('en-US')} weakspots hit.`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
