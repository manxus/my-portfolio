/**
 * Build-time script to fetch Satisfactory factory stats.
 *
 * Usage:
 *   node --env-file=.env scripts/fetch-satisfactory-data.js
 *
 * Outputs:
 *   src/data/satisfactory.json
 *
 * Coffee Stain ships no display names at all -- every one of the 70 stats comes back with an empty
 * `displayName` -- so the labels below are written by hand against self-describing keys
 * (`LENGTH_BELT_BUILT`, `NUM_DRINK_COFFEE`). That is the same approach fetch-cs2-data.js takes for
 * its record grid, and it is why a key this script has not been taught about is a hard failure
 * rather than a silent drop.
 *
 * Units: the keys separate counts (`NUM_`) from lengths (`LENGTH_`), and Satisfactory measures
 * length in metres in-game -- a belt segment runs from half a metre to 56 -- so the LENGTH_ keys are
 * rendered as distances. Nothing in the payload states the unit, so the page says where it comes
 * from rather than presenting it as Coffee Stain's own label.
 *
 * 26 of the 70 keys are `NUM_SCHEMATIC_UNLOCKED_<tier>_<n>` flags that are only ever 1 when the
 * milestone is unlocked. Rendered literally those are 26 tiles all reading "1"; they are counted
 * per tier instead, which reconciles against NUM_UNLOCKED_MILESTONES as a sanity check.
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
  barPct,
} from './steam-stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../src/data/satisfactory.json');

const APP_ID = 526870;

requireCredentials('fetch-satisfactory-data.js');

const SCHEMATIC_KEY = /^NUM_SCHEMATIC_UNLOCKED_(\d+)_(\d+)$/;

/** Lengths, in metres. Everything else is a plain count. */
const LENGTH_KEYS = new Set(['LENGTH_BELT_BUILT', 'LENGTH_PIPELINE_PLACED', 'LENGTH_RAILWAY_PLACED']);

const LABELS = {
  LENGTH_BELT_BUILT: 'Conveyor belt built',
  LENGTH_PIPELINE_PLACED: 'Pipeline laid',
  LENGTH_RAILWAY_PLACED: 'Railway laid',
  NUM_FOUNDATION_PLACED: 'Foundations placed',
  NUM_BUILT_MANUFACTURERS: 'Manufacturers built',
  NUM_BUILT_SPACEELEVATOR: 'Space elevators built',
  NUM_PLACED_PORTABLE_MINER: 'Portable miners placed',
  NUM_FUSE_RESET: 'Fuses reset',
  NUM_SAVED_TIMETABLE: 'Train timetables saved',

  NUM_UNLOCKED_MILESTONES: 'Milestones unlocked',
  NUM_FINISHED_RESEARCH_TREE: 'Research trees finished',
  NUM_FINISHED_ALL_RESEARCH_TREES: 'All research trees finished',
  NUM_UNLOCKED_ALT_RECIPE: 'Alternate recipes unlocked',
  NUM_PICKED_UP_HARDDRIVE: 'Hard drives recovered',
  NUM_PRINTED_COUPONS: 'AWESOME coupons printed',
  NUM_GAME_PHASE1_COMPLETE: 'Phase 1 complete',
  NUM_GAME_PHASE2_COMPLETE: 'Phase 2 complete',
  NUM_GAME_PHASE3_COMPLETE: 'Phase 3 complete',
  NUM_GAME_PHASE4_COMPLETE: 'Phase 4 complete',
  NUM_ONBOARDING_COMPLETED: 'Onboarding completed',

  NUM_VISIT_GRASSFIELDS: 'Grass Fields visits',
  NUM_VISIT_ROCKYDESERT: 'Rocky Desert visits',
  NUM_VISIT_DUNEDESERT: 'Dune Desert visits',
  NUM_VISIT_NORTHERNFOREST: 'Northern Forest visits',
  NUM_STARTING_AREAS_VISITED: 'Starting areas visited',
  NUM_HIGHEST_PEAK_VISITED: 'Highest peak reached',
  NUM_PICKED_UP_FOLIAGE: 'Foliage harvested',
  NUM_PICKED_UP_BERYL: 'Beryl nuts picked',
  NUM_PICKED_UP_BERRY: 'Paleberries picked',
  NUM_PICKED_UP_BACON: 'Bacon agaric picked',
  NUM_PICKED_UP_EDIBLE_TYPES: 'Edible types found',
  NUM_PICKED_UP_BLUESLUG: 'Blue power slugs',
  NUM_PICKED_UP_YELLOWSLUG: 'Yellow power slugs',
  NUM_PICKED_UP_PURPLESLUG: 'Purple power slugs',
  NUM_PICKED_UP_SLUG_TYPES: 'Slug types found',
  NUM_PICKED_UP_SOMERSLOOP: 'Somersloops recovered',
  NUM_PICKED_UP_MERCER: 'Mercer spheres recovered',
  NUM_PICKED_UP_BOOMTAPE: 'Boom tape recovered',

  NUM_DRINK_COFFEE: 'Coffee drunk',
  NUM_TAMED_DOGGO: 'Lizard doggos tamed',
  NUM_MANTA_PETTED: 'Mantas petted',
  NUM_JUMPED_SPACEGIRAFFE: 'Space giraffe jumps',
  NUM_FLOOR_IS_LAVA: 'Floor-is-lava runs',
  NUM_TOO_FAST: 'Went too fast',
  NUM_SURVIVED_FALL: 'Survived a fall',
  NUM_CREATURE_KNOCKED_OVER: 'Creatures knocked over',
  NUM_ENTERED_CYBERWAGON: 'Cyber wagon rides',
};

const SECTIONS = [
  {
    id: 'construction',
    title: 'CONSTRUCTION',
    keys: [
      'NUM_FOUNDATION_PLACED',
      'LENGTH_BELT_BUILT',
      'LENGTH_PIPELINE_PLACED',
      'LENGTH_RAILWAY_PLACED',
      'NUM_BUILT_MANUFACTURERS',
      'NUM_BUILT_SPACEELEVATOR',
      'NUM_PLACED_PORTABLE_MINER',
      'NUM_FUSE_RESET',
      'NUM_SAVED_TIMETABLE',
    ],
  },
  {
    id: 'progression',
    title: 'PROGRESSION',
    keys: [
      'NUM_UNLOCKED_MILESTONES',
      'NUM_FINISHED_RESEARCH_TREE',
      'NUM_FINISHED_ALL_RESEARCH_TREES',
      'NUM_UNLOCKED_ALT_RECIPE',
      'NUM_PICKED_UP_HARDDRIVE',
      'NUM_PRINTED_COUPONS',
      'NUM_GAME_PHASE1_COMPLETE',
      'NUM_GAME_PHASE2_COMPLETE',
      'NUM_GAME_PHASE3_COMPLETE',
      'NUM_GAME_PHASE4_COMPLETE',
      'NUM_ONBOARDING_COMPLETED',
    ],
  },
  {
    id: 'exploration',
    title: 'EXPLORATION',
    keys: [
      'NUM_VISIT_GRASSFIELDS',
      'NUM_VISIT_ROCKYDESERT',
      'NUM_VISIT_DUNEDESERT',
      'NUM_VISIT_NORTHERNFOREST',
      'NUM_STARTING_AREAS_VISITED',
      'NUM_HIGHEST_PEAK_VISITED',
      'NUM_PICKED_UP_FOLIAGE',
      'NUM_PICKED_UP_BERYL',
      'NUM_PICKED_UP_BERRY',
      'NUM_PICKED_UP_BACON',
      'NUM_PICKED_UP_EDIBLE_TYPES',
      'NUM_PICKED_UP_BLUESLUG',
      'NUM_PICKED_UP_YELLOWSLUG',
      'NUM_PICKED_UP_PURPLESLUG',
      'NUM_PICKED_UP_SLUG_TYPES',
      'NUM_PICKED_UP_SOMERSLOOP',
      'NUM_PICKED_UP_MERCER',
      'NUM_PICKED_UP_BOOMTAPE',
    ],
  },
  {
    id: 'anomalies',
    title: 'FICSIT ANOMALIES',
    keys: [
      'NUM_DRINK_COFFEE',
      'NUM_TAMED_DOGGO',
      'NUM_MANTA_PETTED',
      'NUM_JUMPED_SPACEGIRAFFE',
      'NUM_FLOOR_IS_LAVA',
      'NUM_TOO_FAST',
      'NUM_SURVIVED_FALL',
      'NUM_CREATURE_KNOCKED_OVER',
      'NUM_ENTERED_CYBERWAGON',
    ],
  },
];

/** Milestones unlocked per tier, from the per-schematic flags. */
function deriveTiers(stats) {
  const counts = new Map();
  for (const [key, value] of Object.entries(stats)) {
    const match = SCHEMATIC_KEY.exec(key);
    if (match && value > 0) {
      const tier = Number(match[1]);
      counts.set(tier, (counts.get(tier) ?? 0) + 1);
    }
  }

  const best = Math.max(0, ...counts.values());
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tier, unlocked]) => ({
      key: `tier-${tier}`,
      name: `Tier ${tier}`,
      unlocked,
      barPct: barPct(unlocked, best),
    }));
}

function assertSanity(stats, tiers, sections) {
  if (!(stats.LENGTH_BELT_BUILT > 0)) {
    throw new Error('LENGTH_BELT_BUILT came back at zero -- the stat payload is not usable.');
  }

  // The per-tier flags and Coffee Stain's own milestone counter are independent readings of the
  // same thing; if they disagree the schematic keys are being parsed wrong.
  const fromTiers = tiers.reduce((sum, tier) => sum + tier.unlocked, 0);
  const reported = stats.NUM_UNLOCKED_MILESTONES ?? 0;
  if (reported > 0 && fromTiers !== reported) {
    throw new Error(
      `Milestone counts disagree: ${fromTiers} from the per-tier flags against ${reported} from ` +
        'NUM_UNLOCKED_MILESTONES.',
    );
  }

  if (sections.every((section) => section.entries.length === 0)) {
    throw new Error('No stats landed in any section.');
  }
}

async function main() {
  console.log('Fetching Satisfactory stats...');

  const stats = await fetchUserStats(APP_ID);

  const sections = SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    entries: section.keys
      .filter((key) => stats[key] !== undefined)
      .map((key) => ({
        key,
        label: LABELS[key],
        value: stats[key],
        kind: LENGTH_KEYS.has(key) ? 'distance' : 'count',
      })),
  }));

  const tiers = deriveTiers(stats);

  const placed = new Set(SECTIONS.flatMap((section) => section.keys));
  const unplaced = Object.keys(stats).filter(
    (key) => !placed.has(key) && !SCHEMATIC_KEY.test(key),
  );
  if (unplaced.length > 0) {
    // A hard failure rather than a warning: with no display names to fall back on, an unknown key
    // has no label at all and would render as a blank tile.
    throw new Error(
      `${unplaced.length} stat(s) have no label or section: ${unplaced.join(', ')}. ` +
        'Add them to LABELS and SECTIONS.',
    );
  }

  const library = readLibraryEntry(APP_ID);
  const profile = buildProfile(APP_ID, library);

  const phasesComplete = Object.keys(stats).filter(
    (key) => /^NUM_GAME_PHASE\d+_COMPLETE$/.test(key) && stats[key] > 0,
  ).length;

  const summary = {
    beltMetres: stats.LENGTH_BELT_BUILT ?? 0,
    foundations: stats.NUM_FOUNDATION_PLACED ?? 0,
    milestones: stats.NUM_UNLOCKED_MILESTONES ?? 0,
    altRecipes: stats.NUM_UNLOCKED_ALT_RECIPE ?? 0,
    hardDrives: stats.NUM_PICKED_UP_HARDDRIVE ?? 0,
    phasesComplete,
    hoursPlayed: profile.libraryHours,
    // A foundation is 8 metres on a side, so this is roughly the footprint that has been paved.
    pavedHectares: round(((stats.NUM_FOUNDATION_PLACED ?? 0) * 64) / 10000, 1),
  };

  assertSanity(stats, tiers, sections);

  writeSnapshot(
    OUTPUT_PATH,
    { fetchedAt: new Date().toISOString(), profile, summary, sections, tiers },
    `Wrote src/data/satisfactory.json -- ${(summary.beltMetres / 1000).toFixed(1)}km of belt, ` +
      `${summary.foundations.toLocaleString('en-US')} foundations, ` +
      `${summary.milestones} milestones.`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
