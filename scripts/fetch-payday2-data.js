/**
 * Build-time script to fetch PAYDAY 2 career stats (record, weapons, enemies, difficulty spread,
 * melee and throwables).
 *
 * Usage:
 *   node --env-file=.env scripts/fetch-payday2-data.js
 *
 * Outputs:
 *   src/data/payday2.json
 *
 * PAYDAY 2 returns 1,248 stat keys, more than four times Counter-Strike's schema, and about a fifth
 * of them are threshold flags rather than counters: `player_time_250h`, `player_level_100`,
 * `player_cash_100000k` are all "1" when a milestone is passed and "0" otherwise. Rendered literally
 * they are hundreds of tiles reading 1 or 0. They are dropped here, the same way fetch-cs2-data.js
 * drops Valve's `GI.lesson.*` tutorial telemetry.
 *
 * What is left is genuinely rich, and unlike Team Fortress the shot counters work, so the weapon
 * table carries real accuracy.
 *
 * Naming: Overkill publishes no display names at all, so everything is labelled from the internal
 * id. Enemies and difficulties get an explicit table below because their ids actively mislead --
 * `spooc` is the Cloaker, `tank` is the Bulldozer, and the difficulty ids are frozen at the names
 * the tiers had years ago, so `easy_wish` is Mayhem and `overkill_290` is Death Wish. Weapons are
 * prettified from the id rather than renamed, because there are 66 of them and guessing at the ones
 * whose id is not the marketing name would put invented weapon names on the page.
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
const OUTPUT_PATH = resolve(__dirname, '../src/data/payday2.json');

const APP_ID = 218620;

requireCredentials('fetch-payday2-data.js');

/**
 * Difficulty tiers in ascending order, with the names the game shows today. The ids never changed
 * as the tiers were renamed and reshuffled over the years, which is why they read out of order --
 * `easy_wish` sits above `overkill_145`, and `overkill` is the tier now called Very Hard.
 */
const DIFFICULTIES = [
  { key: 'difficulty_normal', name: 'Normal' },
  { key: 'difficulty_hard', name: 'Hard' },
  { key: 'difficulty_overkill', name: 'Very Hard' },
  { key: 'difficulty_overkill_145', name: 'Overkill' },
  { key: 'difficulty_easy_wish', name: 'Mayhem' },
  { key: 'difficulty_overkill_290', name: 'Death Wish' },
  { key: 'difficulty_sm_wish', name: 'Death Sentence' },
];

/** Enemy ids whose internal name is not what the game calls them. */
const ENEMY_NAMES = {
  spooc: 'Cloaker',
  tank: 'Bulldozer',
  tank_hw: 'Bulldozer (Titan)',
  tank_green: 'Bulldozer (green)',
  tank_black: 'Bulldozer (black)',
  tank_skull: 'Bulldozer (skull)',
  shield: 'Shield',
  taser: 'Taser',
  medic: 'Medic',
  sniper: 'Sniper',
  cop: 'Cop',
  cop_female: 'Cop (female)',
  fbi: 'FBI agent',
  fbi_swat: 'FBI SWAT',
  fbi_heavy_swat: 'FBI Heavy SWAT',
  swat: 'SWAT',
  heavy_swat: 'Heavy SWAT',
  city_swat: 'City SWAT',
  security: 'Security guard',
  security_undominatable: 'Security guard (undominatable)',
  mute_security_undominatable: 'Security guard (silent)',
  gensec: 'GenSec guard',
  murkywater: 'Murkywater guard',
  gangster: 'Gangster',
  mobster: 'Mobster',
  mobster_boss: 'Mobster boss',
  biker: 'Biker',
  biker_boss: 'Biker boss',
  triad: 'Triad',
  triad_boss_no_armor: 'Triad boss',
  bolivian: 'Bolivian',
  bolivian_indoors_mex: 'Bolivian (indoors)',
  security_mex: 'Security guard (Mexico)',
  security_mex_no_pager: 'Security guard (Mexico, no pager)',
  phalanx_minion: "Captain Winters' guard",
  marshal_marksman: 'Marshal marksman',
  marshal_shield: 'Marshal shield',
  marshal_shield_break: 'Marshal shield (broken)',
  swat_turret: 'SWAT turret',
  hector_boss: 'Hector',
  hector_boss_no_armor: 'Hector (unarmoured)',
  chavez_boss: 'Chavez',
  drug_lord_boss: 'Drug lord',
  drug_lord_boss_stealth: 'Drug lord (stealth)',
  bank_manager: 'Bank manager',
  civilian: 'Civilian',
  civilian_female: 'Civilian (female)',
  civilian_mariachi: 'Civilian (mariachi)',
  civilian_no_penalty: 'Civilian (no penalty)',
  hostage_rescue: 'Hostage rescued',
};

/** Enemy ids that are not enemies at all, so they do not belong in a kill table. */
const NON_ENEMY_KEYS = new Set(['hostage_rescue']);

/** Melee and throwable ids whose internal name reads as nonsense. */
const GEAR_NAMES = {
  weapon: 'Weapon butt',
  fists: 'Fists',
  brass_knuckles: 'Brass knuckles',
  boxing_gloves: 'Boxing gloves',
  kabartanto: 'Ka-Bar tanto',
  moneybundle: 'Money bundle',
  fairbair: 'Fairbairn-Sykes knife',
  cqc: 'CQC knife',
  iceaxe: 'Ice axe',
  piggy_hammer: 'Piggy hammer',
  frag: 'Frag grenade',
  molotov: 'Molotov',
  dynamite: 'Dynamite',
};

/**
 * Keys that are thresholds, flags or bookkeeping rather than counters. Everything matching is
 * dropped before the page ever sees it.
 */
const NOISE = [
  /^player_(time|level|cash)_/, // milestone flags: player_level_90 = 1 once level 90 is passed
  /^player_specialization_\d+$/, // per-tree "unlocked" flags, all 9
  /^player_rank_\d+$/,
  /^skill_/, // one flag per skill purchased; a 60-row list of ones
  /^(gage\d?|crimefest|halloween|sb17|cac|pxp\d|dec21|eng|gmod|ranc|pim|eagle|grv|rvd|pdth|bph|gsu|sawp|pig|ameno|scorpion|main|join|type|option|setting|stats?|info|mission)_/,
  /^(weapon_color|equipped|suit_used|gloves_used|gadget_used|specialization_used|armored_\d+_stat)/,
  /_stat$/,
];

const isNoise = (key) => NOISE.some((pattern) => pattern.test(key));

/**
 * Weapon and gear ids are lowercase internal names. Most are the weapon's real name already
 * (`deagle`, `mp7`, `famas`); the rest are Overkill's own shorthand and are left as-is rather than
 * guessed at. The one convention worth expanding is the `x_` prefix, which is the game's marker for
 * an akimbo pair.
 */
function prettifyId(id) {
  if (GEAR_NAMES[id]) return GEAR_NAMES[id];

  const akimbo = id.startsWith('x_');
  const base = akimbo ? id.slice(2) : id;

  const words = base
    .replace(/^(new|wpn_prj)_/, '')
    .split('_')
    .filter(Boolean)
    .map((word) =>
      // Short tokens and anything with a digit read as model designations (M4, G36, AK5, MP7).
      /\d/.test(word) || word.length <= 3 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1),
    );

  return `${akimbo ? 'Akimbo ' : ''}${words.join(' ')}`;
}

/** Pulls one `<prefix><id>` family into rows, ranked, with bars against the family's own best. */
function deriveFamily(stats, prefix, { nameFor = prettifyId, extra = () => ({}), skip = () => false } = {}) {
  const rows = Object.entries(stats)
    .filter(([key, value]) => key.startsWith(prefix) && value > 0)
    .map(([key, value]) => ({ id: key.slice(prefix.length), value }))
    .filter(({ id }) => !skip(id))
    .map(({ id, value }) => ({ slug: id, name: nameFor(id), value, ...extra(id, stats) }));

  const best = Math.max(0, ...rows.map((row) => row.value));
  return rows
    .sort((a, b) => b.value - a.value)
    .map((row) => ({ ...row, barPct: barPct(row.value, best) }));
}

function deriveWeapons(stats) {
  return deriveFamily(stats, 'weapon_kills_', {
    extra: (id) => {
      const shots = stats[`weapon_shots_${id}`] ?? 0;
      const hits = stats[`weapon_hits_${id}`] ?? 0;
      // Explosives register a hit per enemy caught in the blast, so one shot can log several hits
      // -- the M32 reads 47 shots against 101 hits. An accuracy percentage is not a meaningful
      // number for those, so they carry null and the page shows a dash rather than "215%".
      const splash = hits > shots;
      return {
        shots,
        hits,
        splash,
        used: stats[`weapon_used_${id}`] ?? 0,
        accuracy: splash ? null : ratio(hits, shots),
        akimbo: id.startsWith('x_'),
      };
    },
  }).map((row) => ({ ...row, kills: row.value }));
}

function deriveEnemies(stats) {
  return deriveFamily(stats, 'enemy_kills_', {
    nameFor: (id) => ENEMY_NAMES[id] ?? prettifyId(id),
    skip: (id) => NON_ENEMY_KEYS.has(id),
  }).map((row) => ({ ...row, kills: row.value }));
}

/** Melee and throwables share a shape -- used and killed -- so they share a table. */
function deriveGear(stats) {
  const build = (usedPrefix, killPrefix, kind) =>
    deriveFamily(stats, usedPrefix, {
      nameFor: (id) => GEAR_NAMES[id] ?? prettifyId(id),
      extra: (id) => ({ kills: stats[`${killPrefix}${id}`] ?? 0, kind }),
    }).map((row) => ({ ...row, used: row.value }));

  const rows = [
    ...build('melee_used_', 'melee_kills_', 'Melee'),
    ...build('grenade_used_', 'grenade_kills_', 'Throwable'),
  ];

  const best = Math.max(0, ...rows.map((row) => row.used));
  return rows
    .sort((a, b) => b.used - a.used)
    .map((row) => ({ ...row, barPct: barPct(row.used, best) }));
}

function deriveDifficulties(stats) {
  const rows = DIFFICULTIES.filter((tier) => (stats[tier.key] ?? 0) > 0).map((tier) => ({
    slug: tier.key,
    name: tier.name,
    value: stats[tier.key],
    plays: stats[tier.key],
  }));

  const best = Math.max(0, ...rows.map((row) => row.value));
  // Left in tier order rather than ranked: the shape of the curve across the difficulties is the
  // point, and sorting by count would destroy it.
  return rows.map((row) => ({ ...row, barPct: barPct(row.value, best) }));
}

function assertSanity(summary, weapons, enemies, difficulties) {
  if (summary.level <= 0) throw new Error('player_level came back at zero.');
  if (summary.heistsPlayed <= 0) throw new Error('No heists recorded.');
  if (weapons.length === 0) throw new Error('No weapons carried any kills.');
  if (enemies.length === 0) throw new Error('No enemies carried any kills.');

  // A handful of splash weapons logging more hits than shots is expected; most of the table doing
  // it would mean the shot and hit families are being paired wrong.
  const splash = weapons.filter((w) => w.splash);
  if (splash.length > weapons.length / 4) {
    throw new Error(
      `${splash.length} of ${weapons.length} weapons log more hits than shots. The shot and hit ` +
        'families are being paired wrong.',
    );
  }
  if (splash.length > 0) {
    console.log(`  ${splash.length} splash weapon(s) carry no accuracy: ${splash.map((w) => w.name).join(', ')}.`);
  }

  // Both readings of how much has been played. They will not match exactly -- the difficulty
  // counters include runs that ended in neither a win nor a recorded failure -- but an order of
  // magnitude apart means the families are being misread.
  const fromDifficulty = difficulties.reduce((sum, tier) => sum + tier.plays, 0);
  if (fromDifficulty > 0 && summary.heistsPlayed > 0) {
    const factor = fromDifficulty / summary.heistsPlayed;
    if (factor < 0.2 || factor > 5) {
      throw new Error(
        `Difficulty plays (${fromDifficulty}) and heists played (${summary.heistsPlayed}) are ` +
          'implausibly far apart.',
      );
    }
  }
}

async function main() {
  console.log('Fetching PAYDAY 2 stats...');

  const raw = await fetchUserStats(APP_ID);

  const stats = Object.fromEntries(Object.entries(raw).filter(([key]) => !isNoise(key)));
  console.log(`  ${Object.keys(raw).length} keys in, ${Object.keys(stats).length} after dropping flags.`);

  const weapons = deriveWeapons(stats);
  const enemies = deriveEnemies(stats);
  const gear = deriveGear(stats);
  const difficulties = deriveDifficulties(stats);
  const library = readLibraryEntry(APP_ID);
  const profile = buildProfile(APP_ID, library);

  const success = stats.heist_success ?? 0;
  const failed = stats.heist_failed ?? 0;
  const totalShots = weapons.reduce((sum, w) => sum + w.shots, 0);
  const totalHits = weapons.reduce((sum, w) => sum + w.hits, 0);

  const summary = {
    level: stats.player_level ?? 0,
    cash: stats.player_cash ?? 0,
    heistsSucceeded: success,
    heistsFailed: failed,
    heistsPlayed: success + failed,
    successPct: ratio(success, success + failed),
    enemyKills: enemies.reduce((sum, e) => sum + e.kills, 0),
    accuracy: ratio(totalHits, totalShots),
    hoursPlayed: profile.libraryHours,
    killsPerHeist:
      success + failed > 0 ? round(enemies.reduce((s, e) => s + e.kills, 0) / (success + failed)) : 0,
  };

  const record = [
    { key: 'level', label: 'Infamy level', value: summary.level },
    { key: 'cash', label: 'Offshore cash', value: summary.cash },
    { key: 'success', label: 'Heists completed', value: success },
    { key: 'failed', label: 'Heists failed', value: failed },
    { key: 'kills', label: 'Enemies killed', value: summary.enemyKills },
    { key: 'shots', label: 'Shots fired', value: totalShots },
    { key: 'hits', label: 'Shots hit', value: totalHits },
    { key: 'hostages', label: 'Hostages rescued', value: stats.enemy_kills_hostage_rescue ?? 0 },
  ];

  assertSanity(summary, weapons, enemies, difficulties);

  writeSnapshot(
    OUTPUT_PATH,
    {
      fetchedAt: new Date().toISOString(),
      profile,
      summary,
      record,
      weapons,
      enemies,
      gear,
      difficulties,
    },
    `Wrote src/data/payday2.json -- level ${summary.level}, ${success}/${summary.heistsPlayed} heists, ` +
      `${weapons.length} weapons, ${enemies.length} enemy types, ` +
      `${summary.enemyKills.toLocaleString('en-US')} kills.`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
