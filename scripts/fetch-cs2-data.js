/**
 * Build-time script to fetch Counter-Strike 2 career stats (summary, service record, per-weapon
 * and per-map tables, objectives).
 *
 * Usage:
 *   node --env-file=.env scripts/fetch-cs2-data.js            # normal sync
 *   node --env-file=.env scripts/fetch-cs2-data.js --icons    # also download weapon/map art
 *   node --env-file=.env scripts/fetch-cs2-data.js --force    # re-download icons that exist
 *
 * Env:
 *   STEAM_API_KEY   Steam Web API key (shared with fetch-steam-data.js)
 *   STEAM_ID        64-bit SteamID
 *   CS2_STEAM_ID    overrides STEAM_ID for this script only
 *
 * Outputs:
 *   src/data/counterstrike.json
 *   public/counterstrike/{weapons,maps}/*.png   (--icons only, committed once)
 *
 * ISteamUserStats/GetUserStatsForGame is the only endpoint that exposes the per-weapon and per-map
 * counters, and it needs the profile's game details to be public -- a private profile returns HTTP
 * 403 and a friends-only one returns an empty stat array. The counters are cumulative across the
 * CS:GO era, so they are a career record rather than a CS2-only one.
 *
 * Two things the raw payload gets wrong for a page: the stat keys are machine names, and roughly a
 * quarter of them are tutorial telemetry. Labels come from GetSchemaForGame (127 of 286 stats carry
 * a real displayName) and the GI.lesson.* / steam_stat_* keys are dropped outright. Weapon names,
 * categories and art come from the community-maintained CSGO-API mirror, keyed on the same short
 * names Valve uses in the stat keys -- all 29 weapons that appear in the stats resolve.
 *
 * Like the other game pages this is a committed snapshot: the JSON and the art live in the repo so
 * the page keeps working when Steam or the icon mirror does not.
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../src/data/counterstrike.json');
const LIBRARY_PATH = resolve(__dirname, '../src/data/steam-library.json');
const PUBLIC_DIR = resolve(__dirname, '../public/counterstrike');

const APP_ID = 730;
const STEAM_API = 'https://api.steampowered.com';
const WEAPON_DB =
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/base_weapons.json';
const MAP_ICON_BASE =
  'https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/econ/set_icons';

/**
 * Steam's economy CDN resizes on demand via a suffix. The mirror links the 512x384 master, which is
 * 71KB an asset for something drawn at 44x28 -- this asks for 128x96 instead and takes the whole
 * weapon set from 2.8MB to under 400KB, still at 3x the rendered size.
 */
const WEAPON_IMAGE_SIZE = '/128fx96f';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const WANT_ICONS = process.argv.includes('--icons');
const FORCE = process.argv.includes('--force');

const API_KEY = process.env.STEAM_API_KEY;
const STEAM_ID = process.env.CS2_STEAM_ID || process.env.STEAM_ID;

if (!API_KEY || !STEAM_ID) {
  console.error('Missing STEAM_API_KEY or STEAM_ID environment variables.');
  console.error('Usage: node --env-file=.env scripts/fetch-cs2-data.js');
  process.exit(1);
}

/**
 * Valve's stat keys use the short weapon name the engine uses internally, so the CSGO-API entries
 * are keyed the same way and the two line up without a translation table. The category strings come
 * straight from the mirror and become the filter chips, in the order the buy menu uses.
 */
const CATEGORY_ORDER = ['Pistols', 'SMGs', 'Rifles', 'Heavy'];

/** Maps whose collection icon is published under a name that is not just the map's own slug. */
const MAP_ICONS = {
  de_dust2: 'set_dust_2',
  cs_assault: 'set_assault',
  cs_italy: 'set_italy',
  cs_office: 'set_office',
  cs_militia: 'set_militia',
  ar_baggage: 'set_baggage',
};

/** Valve never shipped display names for the maps, and the slugs read badly in a bar chart. */
const MAP_NAMES = {
  de_dust2: 'Dust II',
  de_cbble: 'Cobblestone',
  de_stmarc: 'St. Marc',
  de_shorttrain: 'Shorttrain',
  de_sugarcane: 'Sugarcane',
  de_safehouse: 'Safehouse',
  ar_monastery: 'Monastery',
  ar_baggage: 'Baggage',
  ar_shoots: 'Shoots',
};

/** The prefix is the game mode the map was built for, which is worth showing next to the name. */
const MAP_MODES = { de: 'Defusal', cs: 'Hostage', ar: 'Arms Race' };

/** Service record cells, in reading order. Labels fall back to the schema's own displayName. */
const RECORD_KEYS = [
  'total_kills',
  'total_deaths',
  'total_kills_headshot',
  'total_rounds_played',
  'total_wins',
  'total_matches_played',
  'total_matches_won',
  'total_mvps',
  'total_damage_done',
  'total_shots_fired',
  'total_shots_hit',
  'total_money_earned',
  'total_contribution_score',
  'total_kills_knife',
  'total_dominations',
  'total_weapons_donated',
];

/** The objective and flourish counters that do not belong in the headline record. */
const OBJECTIVE_KEYS = [
  'total_planted_bombs',
  'total_defused_bombs',
  'total_rescued_hostages',
  'total_wins_pistolround',
  'total_kills_enemy_weapon',
  'total_kills_against_zoomed_sniper',
  'total_kills_enemy_blinded',
  'total_kills_knife_fight',
  'total_domination_overkills',
  'total_revenges',
  'total_kills_hegrenade',
  'total_kills_molotov',
  'total_kills_taser',
  'total_broken_windows',
];

/** Short labels for the cells the schema either omits or names too verbosely for a tile. */
const LABEL_OVERRIDES = {
  total_kills: 'Kills',
  total_deaths: 'Deaths',
  total_kills_headshot: 'Headshot kills',
  total_rounds_played: 'Rounds played',
  total_wins: 'Rounds won',
  total_matches_played: 'Matches played',
  total_matches_won: 'Matches won',
  total_mvps: 'MVPs',
  total_damage_done: 'Damage dealt',
  total_shots_fired: 'Shots fired',
  total_shots_hit: 'Shots hit',
  total_money_earned: 'Money earned',
  total_contribution_score: 'Contribution score',
  total_kills_knife: 'Knife kills',
  total_dominations: 'Dominations',
  total_weapons_donated: 'Weapons donated',
  total_planted_bombs: 'Bombs planted',
  total_defused_bombs: 'Bombs defused',
  total_rescued_hostages: 'Hostages rescued',
  total_wins_pistolround: 'Pistol rounds won',
  total_kills_enemy_weapon: 'Kills with enemy weapons',
  total_kills_against_zoomed_sniper: 'Kills vs zoomed snipers',
  total_kills_enemy_blinded: 'Kills on blinded enemies',
  total_kills_knife_fight: 'Knife fights won',
  total_domination_overkills: 'Overkills',
  total_revenges: 'Revenge kills',
  total_kills_hegrenade: 'Grenade kills',
  total_kills_molotov: 'Molotov kills',
  total_kills_taser: 'Zeus kills',
  total_broken_windows: 'Windows broken',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Guards every derived ratio: a zero denominator is a real state here, not a bug. */
const ratio = (numerator, denominator, digits = 1) =>
  denominator > 0 ? round((numerator / denominator) * 100, digits) : 0;

/**
 * Bars are read against the best entry in the same group rather than the total, because the top
 * weapon owns a third of all kills and a share-of-total bar would leave everything below it flat.
 * The 2% floor keeps a used-once entry visible as a bar rather than an empty track.
 */
const barPct = (value, best) => (best > 0 ? Math.max(2, Math.round((value / best) * 100)) : 0);

async function fetchJson(url, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        const wait = attempt * 2000;
        console.warn(`  retry ${attempt}/${attempts - 1} in ${wait / 1000}s -- ${err.message}`);
        await sleep(wait);
      }
    }
  }

  throw new Error(
    `${url.replace(API_KEY, '<key>')} failed after ${attempts} attempts: ${lastError.message}`,
  );
}

/**
 * Only emits a path for art that is actually on disk, so a map or weapon the mirror never published
 * degrades to the initials tile instead of a broken image.
 */
function iconPath(kind, slug) {
  return existsSync(join(PUBLIC_DIR, kind, `${slug}.png`))
    ? `/counterstrike/${kind}/${slug}.png`
    : null;
}

/**
 * Takes the candidate URLs in preference order and keeps the first that answers. Steam only serves
 * a resized variant for hashes it has already cached one for -- four of the weapons 404 on the
 * 128x96 suffix and have to fall back to the full-size master.
 */
async function downloadIcon(sources, target) {
  if (existsSync(target) && !FORCE) return 'skipped';

  for (const url of sources.filter(Boolean)) {
    // A 404 means this variant was never published and is not worth retrying; 5xx under load is.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.ok) {
        writeFileSync(target, Buffer.from(await res.arrayBuffer()));
        await sleep(100);
        return 'downloaded';
      }
      if (res.status < 500) break;
      if (attempt === 1) await sleep(1500);
    }
  }

  return 'missing';
}

async function downloadIcons(weaponArt, mapSlugs) {
  const tally = { downloaded: 0, skipped: 0, missing: 0 };

  const groups = [
    [
      'weapons',
      weaponArt.map(({ slug, image }) => [
        slug,
        image ? [image + WEAPON_IMAGE_SIZE, image] : [],
      ]),
    ],
    [
      'maps',
      mapSlugs.map((slug) => [
        slug,
        [`${MAP_ICON_BASE}/${MAP_ICONS[slug] ?? `set_${slug.replace(/^(de|cs|ar)_/, '')}`}_png.png`],
      ]),
    ],
  ];

  for (const [kind, entries] of groups) {
    const dir = join(PUBLIC_DIR, kind);
    mkdirSync(dir, { recursive: true });

    for (const [slug, sources] of entries) {
      tally[await downloadIcon(sources, join(dir, `${slug}.png`))] += 1;
    }
  }

  console.log(
    `  art: ${tally.downloaded} downloaded, ${tally.skipped} already present, ` +
      `${tally.missing} unavailable`,
  );
}

/**
 * The raw stat list is a flat name/value array with a quarter of it given over to tutorial
 * telemetry (GI.lesson.*, which tracks which hints the client has shown) and Steam's own
 * steam_stat_* rollups. Neither is a career stat, and both would otherwise land in the record grid.
 */
function toStatMap(rawStats) {
  const map = {};
  for (const { name, value } of rawStats ?? []) {
    if (name.startsWith('GI.lesson.') || name.startsWith('steam_stat_')) continue;
    map[name] = Number(value) || 0;
  }
  return map;
}

function labelFor(key, schemaLabels) {
  return LABEL_OVERRIDES[key] ?? schemaLabels[key] ?? key.replace(/^total_/, '').replace(/_/g, ' ');
}

/**
 * The weapons that earn a row in the table, shared with the art download so the two can never
 * disagree about what to fetch.
 *
 * Grenades and knives have kill counts but no shots, and the Zeus has shots but no hits, so none of
 * them can carry an accuracy column -- they live in the objectives block instead. The category test
 * is what excludes the Zeus: it is the one entry the mirror files under Equipment rather than a
 * buy-menu category, so it would otherwise show under ALL and under no chip at all.
 */
function usedWeaponSlugs(stats, weaponDb) {
  return Object.keys(stats)
    .filter((key) => /^total_kills_[a-z0-9]+$/.test(key))
    .map((key) => key.slice('total_kills_'.length))
    .filter(
      (slug) =>
        weaponDb[slug] &&
        stats[`total_shots_${slug}`] > 0 &&
        CATEGORY_ORDER.includes(weaponDb[slug].category),
    );
}

/**
 * Every map slug the stats mention, with the wins-but-no-rounds entries already dropped.
 *
 * Valve froze the per-map counters at the CS:GO launch-era pool: the schema defines keys for 31
 * maps and has never added one since, so Mirage, Overpass, Cache, Anubis and Ancient have no
 * counters at all and are invisible here no matter how much they were played. That is why the page
 * publishes mapCoverage alongside the list -- roughly a third of all rounds land on maps this
 * section cannot show, and presenting the list without that figure would read as a complete record.
 */
function usedMapSlugs(stats) {
  return [
    ...new Set(
      Object.keys(stats)
        .filter((key) => /^total_(wins|rounds)_map_/.test(key))
        .map((key) => key.replace(/^total_(wins|rounds)_map_/, '')),
    ),
  ].filter((slug) => (stats[`total_rounds_map_${slug}`] ?? 0) > 0);
}

function deriveWeapons(stats, weaponDb) {
  const used = usedWeaponSlugs(stats, weaponDb);
  const best = Math.max(...used.map((slug) => stats[`total_kills_${slug}`]), 0);

  const weapons = used
    .map((slug) => {
      const kills = stats[`total_kills_${slug}`] ?? 0;
      const shots = stats[`total_shots_${slug}`] ?? 0;
      const hits = stats[`total_hits_${slug}`] ?? 0;

      return {
        slug,
        name: weaponDb[slug].name,
        category: weaponDb[slug].category,
        kills,
        shots,
        hits,
        accuracy: ratio(hits, shots),
        // How many of the rounds that left the barrel ended someone: the AWP's 36% against the
        // AK's 7% is the clearest single number for how differently the two play.
        killsPerShot: ratio(kills, shots, 2),
        iconUrl: iconPath('weapons', slug),
        barPct: barPct(kills, best),
      };
    })
    .sort((a, b) => b.kills - a.kills);

  const categories = CATEGORY_ORDER.filter((name) => weapons.some((w) => w.category === name)).map(
    (name) => ({ name, count: weapons.filter((w) => w.category === name).length }),
  );

  return { weapons, categories };
}

function deriveMaps(stats) {
  // Maps with wins but no rounds are dropped rather than shown -- de_house carries five wins and no
  // rounds at all, and a win rate needs a denominator. Rendering it would put a confident 0%
  // against a map that was in fact won every time it was played.
  const slugs = usedMapSlugs(stats);
  const best = Math.max(...slugs.map((slug) => stats[`total_rounds_map_${slug}`] ?? 0), 0);

  return slugs
    .map((slug) => {
      const rounds = stats[`total_rounds_map_${slug}`] ?? 0;
      const wins = stats[`total_wins_map_${slug}`] ?? 0;
      const prefix = slug.split('_')[0];

      return {
        slug,
        name:
          MAP_NAMES[slug] ??
          slug
            .replace(/^(de|cs|ar)_/, '')
            .replace(/(^|_)([a-z])/g, (_, sep, char) => (sep ? ' ' : '') + char.toUpperCase()),
        mode: MAP_MODES[prefix] ?? 'Other',
        rounds,
        wins,
        winPct: ratio(wins, rounds),
        iconUrl: iconPath('maps', slug),
        barPct: barPct(rounds, best),
      };
    })
    .sort((a, b) => b.rounds - a.rounds || b.wins - a.wins);
}

function deriveEntries(keys, stats, schemaLabels) {
  return keys
    .filter((key) => stats[key] !== undefined)
    .map((key) => ({ key, label: labelFor(key, schemaLabels), value: stats[key] }));
}

function readExisting() {
  if (!existsSync(OUTPUT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'));
  } catch {
    console.warn('Warning: existing counterstrike.json is unreadable, starting fresh.');
    return null;
  }
}

/**
 * Keeps the previous timestamp when nothing else moved, so the weekly sync leaves the file
 * byte-identical and the workflow's "commit if changed" check has something to be false about. A
 * fresh fetchedAt on every run would otherwise put a commit in the history every Monday whether or
 * not a single round had been played.
 */
function withStableTimestamp(output, existing) {
  if (!existing) return output;

  const sameData = JSON.stringify({ ...output, fetchedAt: null }) ===
    JSON.stringify({ ...existing, fetchedAt: null });

  return sameData ? { ...output, fetchedAt: existing.fetchedAt } : output;
}

/** The appid 730 row already carries the store art and Steam's own playtime figure. */
function readLibraryEntry() {
  if (!existsSync(LIBRARY_PATH)) return { profile: {}, game: {} };
  try {
    const library = JSON.parse(readFileSync(LIBRARY_PATH, 'utf8'));
    return {
      profile: library.profile ?? {},
      game: (library.games ?? []).find((entry) => entry.appId === APP_ID) ?? {},
    };
  } catch {
    console.warn('Warning: steam-library.json is unreadable, falling back to a stats-only profile.');
    return { profile: {}, game: {} };
  }
}

function assertSanity(summary, weapons, maps, stats) {
  // Knife, grenade, molotov and Zeus kills count towards the total but have no shots and so are not
  // in the weapon table, which is why this checks for an overshoot rather than a match. Overtaking
  // the total would mean the shots filter let something double-counted through.
  const weaponKills = weapons.reduce((sum, w) => sum + w.kills, 0);
  if (weaponKills > stats.total_kills) {
    console.warn(
      `Warning: weapon kills ${weaponKills.toLocaleString()} exceed the reported total ` +
        `${stats.total_kills.toLocaleString()} -- the weapon table may be double-counting.`,
    );
  }

  const overWon = maps.filter((map) => map.rounds > 0 && map.wins > map.rounds);
  if (overWon.length > 0) {
    console.warn(
      `Warning: more wins than rounds on ` +
        `${overWon.map((m) => `${m.name} ${m.wins}/${m.rounds}`).join(', ')}.`,
    );
  }

  const mapRounds = maps.reduce((sum, m) => sum + m.rounds, 0);
  if (mapRounds > stats.total_rounds_played * 1.05) {
    console.warn(
      `Warning: per-map rounds total ${mapRounds.toLocaleString()} against ` +
        `${stats.total_rounds_played.toLocaleString()} played overall.`,
    );
  }

  if (summary.libraryHours > 0 && summary.hoursPlayed > summary.libraryHours) {
    console.warn(
      `Warning: in-match time (${summary.hoursPlayed}h) exceeds Steam's playtime ` +
        `(${summary.libraryHours}h), which should not be possible.`,
    );
  }
}

async function main() {
  console.log('Fetching Counter-Strike 2 stats...');

  const [raw, schema, weaponList] = await Promise.all([
    fetchJson(
      `${STEAM_API}/ISteamUserStats/GetUserStatsForGame/v0002/?appid=${APP_ID}` +
        `&key=${API_KEY}&steamid=${STEAM_ID}`,
    ),
    fetchJson(`${STEAM_API}/ISteamUserStats/GetSchemaForGame/v2/?appid=${APP_ID}&key=${API_KEY}`),
    fetchJson(WEAPON_DB),
  ]);

  const stats = toStatMap(raw?.playerstats?.stats);
  if (Object.keys(stats).length === 0) {
    console.error('Steam returned no stats for this account.');
    console.error('Game details have to be public on the profile for this endpoint to answer.');
    process.exit(1);
  }
  console.log(`  ${Object.keys(stats).length} career stats`);

  const schemaLabels = Object.fromEntries(
    (schema?.game?.availableGameStats?.stats ?? [])
      .filter((entry) => entry.displayName)
      .map((entry) => [entry.name, entry.displayName]),
  );

  // The mirror keys entries as "base_weapon-weapon_ak47"; the stats use the bare "ak47".
  const weaponDb = {};
  for (const entry of Object.values(weaponList ?? {})) {
    const slug = String(entry.id ?? '').replace('base_weapon-weapon_', '');
    if (!slug) continue;
    const record = {
      slug,
      name: entry.name,
      category: entry.category?.name ?? 'Other',
      image: entry.image,
    };
    weaponDb[slug] = record;
  }

  // Art first: iconPath() only emits a URL for a file already on disk, so the download has to
  // happen before anything is derived.
  if (WANT_ICONS) {
    console.log('Downloading art...');
    await downloadIcons(
      usedWeaponSlugs(stats, weaponDb).map((slug) => weaponDb[slug]),
      usedMapSlugs(stats),
    );
  }

  const { weapons, categories } = deriveWeapons(stats, weaponDb);
  const maps = deriveMaps(stats);
  const { profile: steamProfile, game } = readLibraryEntry();

  const summary = {
    kills: stats.total_kills ?? 0,
    deaths: stats.total_deaths ?? 0,
    killDeath: stats.total_deaths > 0 ? round(stats.total_kills / stats.total_deaths, 3) : 0,
    secondsPlayed: stats.total_time_played ?? 0,
    hoursPlayed: round((stats.total_time_played ?? 0) / 3600),
    // Steam's own figure counts the client being open; total_time_played counts rounds. The gap is
    // wide enough -- about a third here -- that showing only one of them would misrepresent both.
    libraryHours: game.playtimeHours ?? 0,
    accuracy: ratio(stats.total_shots_hit ?? 0, stats.total_shots_fired ?? 0),
    headshotPct: ratio(stats.total_kills_headshot ?? 0, stats.total_kills ?? 0),
    roundWinPct: ratio(stats.total_wins ?? 0, stats.total_rounds_played ?? 0),
    matchWinPct: ratio(stats.total_matches_won ?? 0, stats.total_matches_played ?? 0),
    roundsPlayed: stats.total_rounds_played ?? 0,
    matchesPlayed: stats.total_matches_played ?? 0,
    mvps: stats.total_mvps ?? 0,
    // Damage per round, the figure the scoreboard calls ADR.
    adr:
      stats.total_rounds_played > 0 ? round(stats.total_damage_done / stats.total_rounds_played) : 0,
    killsPerRound:
      stats.total_rounds_played > 0 ? round(stats.total_kills / stats.total_rounds_played, 2) : 0,
  };

  const output = {
    fetchedAt: new Date().toISOString(),
    profile: {
      steamId: String(STEAM_ID),
      personaName: steamProfile.personaName ?? 'Unknown',
      avatarUrl: steamProfile.avatarUrl ?? null,
      profileUrl: steamProfile.profileUrl ?? null,
      capsuleUrl: game.libraryCapsuleUrl ?? game.headerUrl ?? null,
    },
    summary,
    record: deriveEntries(RECORD_KEYS, stats, schemaLabels),
    weaponCategories: categories,
    weapons,
    maps,
    mapCoverage: {
      trackedRounds: maps.reduce((sum, map) => sum + map.rounds, 0),
      totalRounds: stats.total_rounds_played ?? 0,
      untrackedRounds: Math.max(0, (stats.total_rounds_played ?? 0) - maps.reduce((s, x) => s + x.rounds, 0)),
      coveragePct: ratio(
        maps.reduce((sum, map) => sum + map.rounds, 0),
        stats.total_rounds_played ?? 0,
      ),
    },
    objectives: deriveEntries(OBJECTIVE_KEYS, stats, schemaLabels),
  };

  assertSanity(summary, weapons, maps, stats);

  const existing = readExisting();
  const final = withStableTimestamp(output, existing);

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(final, null, 2)}\n`);
  console.log(
    `Wrote src/data/counterstrike.json -- ${weapons.length} weapons, ${maps.length} maps, ` +
      `${summary.kills.toLocaleString('en-US')} kills at ${summary.killDeath} K/D.`,
  );
  if (existing && final.fetchedAt === existing.fetchedAt) {
    console.log('  No counters moved since the last sync; the file is unchanged.');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
