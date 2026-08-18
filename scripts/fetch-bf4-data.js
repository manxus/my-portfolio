/**
 * Build-time script to fetch Battlefield 4 service-record data (soldier stats, weapons, vehicles,
 * kits, gamemodes, unlock progress).
 *
 * Usage:
 *   node scripts/fetch-bf4-data.js                    # normal sync
 *   node scripts/fetch-bf4-data.js --icons            # also download the weapon/vehicle/kit icons
 *   node scripts/fetch-bf4-data.js --force            # re-download icons that already exist
 *   node scripts/fetch-bf4-data.js --id=247598934     # skip name resolution entirely
 *   node scripts/fetch-bf4-data.js --user=JackFrags   # override the persona name
 *
 * Env:
 *   BF4_PERSONA_ID  numeric Battlelog persona id (most reliable)
 *   BF4_USER        Battlelog persona name (default: manxuss)
 *   BF4_PLATFORM    pc | ps4 | xboxone | ps3 | xbox360 (default: pc)
 *
 * Outputs:
 *   src/data/battlefield4.json
 *   public/battlefield4/{weapons,vehicles,classes,ranks}/*.png   (--icons only, committed once)
 *
 * Battlelog itself can no longer be scripted: its search and stats endpoints redirect to
 * /bf4/gate/ (login wall), and bf4stats.com shut down in 2019. The community-run
 * api.gametools.network still reads Battlelog and needs no key, so it is the source of truth --
 * which also means the page must never depend on it at runtime. Hence the committed snapshot: the
 * JSON and the icons live in the repo and keep working when gametools does not.
 *
 * The soldier's Battlelog profile has to be public. A friends-only profile serves a stub page with
 * no personaId and no stats, and every lookup below will fail with "Player not found".
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve, join, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../src/data/battlefield4.json');
const PUBLIC_DIR = resolve(__dirname, '../public/battlefield4');

const API_BASE = 'https://api.gametools.network/bf4';
const BATTLELOG_USER = 'https://battlelog.battlefield.com/bf4/user';
const RANK_IMAGE_BASE = 'https://cdn.gametools.network/bf4';

// Battlelog 403s generic fetchers; gametools does not care but gets the same headers anyway.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const WANT_ICONS = process.argv.includes('--icons');
const FORCE = process.argv.includes('--force');
const flag = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const PERSONA_ID = flag('id') || process.env.BF4_PERSONA_ID || null;
const BF4_USER = flag('user') || process.env.BF4_USER || 'manxuss';
const PLATFORM = flag('platform') || process.env.BF4_PLATFORM || 'pc';

/** Battlelog's own category order, so the filter chips read like the in-game unlock screens. */
const WEAPON_CATEGORIES = [
  'Assault Rifles',
  'Carbines',
  'PDWs',
  'LMGs',
  'DMRs',
  'Sniper Rifles',
  'Shotguns',
  'Handguns',
  'Rocket Launchers',
  'Hand Grenades',
  'Underslung Launchers',
  'Gadgets Explosives',
  'Special',
];

const CATEGORY_LABELS = {
  'Gadgets Explosives': 'Gadgets',
  'Underslung Launchers': 'Underslung',
};

/**
 * vehicles[].type is 27 inconsistent strings -- some name a family ("Main Battle Tanks"), some a
 * single vehicle ("MBT M1 Abrams"), and "Stationary " ships with a trailing space. Anything not
 * listed here falls through to keyword matching and warns, so a new string gets noticed rather
 * than silently bucketed.
 */
const VEHICLE_FAMILIES = {
  'Main Battle Tanks': 'Land',
  'MBT M1 Abrams': 'Land',
  'MBT T90': 'Land',
  'Infantry Fighting Vehicle': 'Land',
  'IFV LAV-25': 'Land',
  'IFV BTR 90': 'Land',
  Transport: 'Land',
  'Jeep SPM3': 'Land',
  'Mobile Artillery': 'Land',
  HIMARS: 'Land',
  'AA 9K22 Tunguska': 'Land',
  'AA LAV-AD': 'Land',
  'Anti Air': 'Land',
  'Air Jet Attack': 'Air',
  'Air Jet Stealth': 'Air',
  'Air Helicopter Attack': 'Air',
  'Air Helicopter Scout': 'Air',
  'Air Helicopter Scout AH6': 'Air',
  'Air Helicopter Scout z11': 'Air',
  'Transport UH-1Y Venom': 'Air',
  'Transport KA-60': 'Air',
  Air: 'Air',
  'Fast Attack Craft': 'Sea',
  Boat: 'Sea',
  'Stationary AA': 'Emplacements',
  Stationary: 'Emplacements',
  'Soldier Equiment': 'Emplacements',
};

const VEHICLE_FAMILY_ORDER = ['Land', 'Air', 'Sea', 'Emplacements'];

/**
 * The API reports one score under several keys -- Conquest, Conquestlarge and Conquestladder were
 * all 4,500,800 on the reference account. Summing them would triple-count, so each group collapses
 * to a single canonical row.
 */
const GAMEMODE_GROUPS = [
  { label: 'Conquest', keys: ['Conquest', 'Conquestlarge', 'Conquestladder'] },
  { label: 'Rush', keys: ['Rush'] },
  { label: 'Obliteration', keys: ['Obliteration', 'Squadobliteration'] },
  { label: 'Domination', keys: ['Domination'] },
  { label: 'Team Deathmatch', keys: ['Teamdeathmatch', 'Sqdm'] },
  {
    label: 'Carrier Assault',
    keys: ['Carrierassault', 'Carrierassaultlarge', 'Carrierassaultsmall'],
  },
  { label: 'Chain Link', keys: ['Chainlink'] },
  { label: 'Capture the Flag', keys: ['Capturetheflag'] },
  { label: 'Defuse', keys: ['Elimination'] },
  { label: 'Air Superiority', keys: ['Airsuperiority'] },
  { label: 'Gun Master', keys: ['Gunmaster'] },
];

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** "17.18%" -> 17.18. format_values=true stringifies every ratio, and bars need numbers. */
function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = parseFloat(String(value ?? '').replace('%', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * gametools answers the first request for a cold persona with 502/504 while it populates its own
 * cache, then serves the real payload on a retry. One attempt is not enough.
 */
async function fetchJson(url, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      // Failures arrive as HTTP 200 with an { errors: [...] } body, so status is not enough.
      if (data && Array.isArray(data.errors) && data.errors.length > 0) {
        throw new Error(data.errors.join(', '));
      }
      return data;
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        const wait = attempt * 2500;
        console.warn(`  retry ${attempt}/${attempts - 1} in ${wait / 1000}s -- ${err.message}`);
        await sleep(wait);
      }
    }
  }

  throw new Error(`${url} failed after ${attempts} attempts: ${lastError.message}`);
}

/**
 * Resolving the numeric id once and caching it matters: name lookups go through gametools' own
 * Battlelog search, the slowest and flakiest link in the chain.
 */
async function resolvePersonaId(existing) {
  if (PERSONA_ID) {
    console.log(`Persona id ${PERSONA_ID} (from flag/env).`);
    return PERSONA_ID;
  }

  const cached = existing?.profile?.personaId;
  if (cached) {
    console.log(`Persona id ${cached} (cached from the previous sync).`);
    return cached;
  }

  console.log(`Resolving "${BF4_USER}" via Battlelog...`);
  try {
    const res = await fetch(`${BATTLELOG_USER}/${encodeURIComponent(BF4_USER)}/`, {
      headers: { 'User-Agent': UA },
    });
    const html = await res.text();
    const match = html.match(/"personaId":"?(\d+)/);
    if (match) {
      console.log(`Persona id ${match[1]} (scraped from Battlelog).`);
      return match[1];
    }
    if (html.includes('only sharing this with friends')) {
      throw new Error(
        `Battlelog profile for "${BF4_USER}" is friends-only, so it exposes no persona id. ` +
          'Set the profile to public at https://battlelog.battlefield.com/bf4/settings/ and re-run.',
      );
    }
  } catch (err) {
    if (err.message.includes('friends-only')) throw err;
    console.warn(`  Battlelog scrape failed (${err.message}), falling back to gametools.`);
  }

  const byName = await fetchJson(
    `${API_BASE}/stats/?name=${encodeURIComponent(BF4_USER)}&platform=${PLATFORM}&format_values=true`,
  );
  if (!byName.id) throw new Error(`gametools returned no persona id for "${BF4_USER}"`);
  console.log(`Persona id ${byName.id} (resolved by gametools).`);
  return String(byName.id);
}

/**
 * Icons are named after the CDN basename, which is already unique per asset. A handful of assets
 * 404 on the CDN (MPX, QSZ-92, LAV-25, ...), so the path is only emitted once the file is actually
 * on disk -- the page then falls back to a text tile instead of a broken image.
 */
function iconPath(kind, url, light = false) {
  if (!url) return null;
  const file = `${basename(new URL(url).pathname).replace(/\.png$/i, '')}${light ? '-light' : ''}.png`;
  return existsSync(join(PUBLIC_DIR, kind, file)) ? `/battlefield4/${kind}/${file}` : null;
}

function deriveWeapons(raw) {
  const used = (raw ?? []).filter((w) => toNumber(w.kills) > 0);

  const totals = new Map();
  const best = new Map();
  for (const weapon of used) {
    const kills = toNumber(weapon.kills);
    totals.set(weapon.type, (totals.get(weapon.type) ?? 0) + kills);
    best.set(weapon.type, Math.max(best.get(weapon.type) ?? 0, kills));
  }

  const unknown = [...totals.keys()].filter((type) => !WEAPON_CATEGORIES.includes(type));
  if (unknown.length > 0) {
    console.warn(`Warning: unrecognised weapon categories: ${unknown.join(', ')}`);
  }

  const weapons = used
    .map((weapon) => {
      const kills = toNumber(weapon.kills);
      return {
        name: weapon.weaponName,
        slug: slugify(weapon.weaponName),
        category: weapon.type,
        iconUrl: iconPath('weapons', weapon.image),
        iconUrlLight: iconPath('weapons', weapon.altImage, true),
        kills,
        killsPerMinute: toNumber(weapon.killsPerMinute),
        accuracy: toNumber(weapon.accuracy),
        headshots: toNumber(weapon.headshots),
        // Share of the best weapon in the same category, so a sidearm bar is not dwarfed by a rifle.
        barPct: Math.max(2, Math.round((kills / (best.get(weapon.type) || 1)) * 100)),
      };
    })
    .sort((a, b) => b.kills - a.kills);

  const categories = [...WEAPON_CATEGORIES, ...unknown]
    .filter((type) => totals.has(type))
    .map((type) => ({
      name: type,
      label: CATEGORY_LABELS[type] ?? type,
      kills: totals.get(type),
      count: weapons.filter((w) => w.category === type).length,
    }));

  return { weapons, categories };
}

function vehicleFamily(type) {
  const key = String(type ?? '').trim();
  const mapped = VEHICLE_FAMILIES[key];
  if (mapped) return mapped;

  console.warn(`Warning: unmapped vehicle type "${key}", guessing from keywords.`);
  if (/helicopter|jet|venom|ka-60/i.test(key)) return 'Air';
  if (/boat|craft/i.test(key)) return 'Sea';
  if (/stationary|equiment|equipment/i.test(key)) return 'Emplacements';
  return 'Land';
}

function deriveVehicles(raw) {
  const used = (raw ?? []).filter((v) => toNumber(v.kills) > 0);

  const mapped = used.map((vehicle) => ({
    name: vehicle.vehicleName,
    slug: slugify(vehicle.vehicleName),
    type: String(vehicle.type ?? '').trim(),
    family: vehicleFamily(vehicle.type),
    iconUrl: iconPath('vehicles', vehicle.image),
    iconUrlLight: iconPath('vehicles', vehicle.altImage, true),
    kills: toNumber(vehicle.kills),
    killsPerMinute: toNumber(vehicle.killsPerMinute),
    destroyed: toNumber(vehicle.destroyed),
    secondsIn: toNumber(vehicle.timeIn),
  }));

  const best = new Map();
  for (const vehicle of mapped) {
    best.set(vehicle.family, Math.max(best.get(vehicle.family) ?? 0, vehicle.kills));
  }

  const vehicles = mapped
    .map((vehicle) => ({
      ...vehicle,
      barPct: Math.max(2, Math.round((vehicle.kills / (best.get(vehicle.family) || 1)) * 100)),
    }))
    .sort((a, b) => b.kills - a.kills);

  const families = VEHICLE_FAMILY_ORDER.filter((family) =>
    vehicles.some((v) => v.family === family),
  ).map((family) => {
    const members = vehicles.filter((v) => v.family === family);
    return {
      name: family,
      kills: members.reduce((sum, v) => sum + v.kills, 0),
      destroyed: members.reduce((sum, v) => sum + v.destroyed, 0),
      secondsIn: members.reduce((sum, v) => sum + v.secondsIn, 0),
      count: members.length,
    };
  });

  return { vehicles, families };
}

function deriveClasses(raw) {
  const classes = (raw ?? []).map((kit) => ({
    name: kit.className,
    slug: slugify(kit.className),
    iconUrl: iconPath('classes', kit.image),
    iconUrlLight: iconPath('classes', kit.altImage, true),
    score: toNumber(kit.score),
    secondsPlayed: toNumber(kit.secondsPlayed),
    serviceStars: toNumber(kit.serviceStarAmount),
    serviceStarProgress: toNumber(kit.serviceStarProgressAmount),
  }));

  const total = classes.reduce((sum, kit) => sum + kit.score, 0);
  return classes
    .map((kit) => ({ ...kit, sharePct: total > 0 ? Math.round((kit.score / total) * 100) : 0 }))
    .sort((a, b) => b.score - a.score);
}

function deriveGamemodes(raw) {
  const byName = new Map((raw ?? []).map((mode) => [mode.gamemodeName, toNumber(mode.score)]));
  const seen = new Set();

  const modes = GAMEMODE_GROUPS.map(({ label, keys }) => {
    const present = keys.filter((key) => byName.has(key));
    present.forEach((key) => seen.add(key));
    const scores = present.map((key) => byName.get(key));
    const score = scores.length > 0 ? Math.max(...scores) : 0;

    // Aliases are only safe to collapse while they agree; a real difference means the grouping has
    // gone stale and a genuine score would be thrown away.
    if (new Set(scores).size > 1) {
      console.warn(
        `Warning: ${label} aliases disagree (${present
          .map((key) => `${key}=${byName.get(key)}`)
          .join(', ')}), keeping the highest.`,
      );
    }

    return { name: label, slug: slugify(label), score };
  }).filter((mode) => mode.score > 0);

  const missed = [...byName.keys()].filter((key) => !seen.has(key) && byName.get(key) > 0);
  if (missed.length > 0) {
    console.warn(`Warning: ungrouped gamemodes ignored: ${missed.join(', ')}`);
  }

  const total = modes.reduce((sum, mode) => sum + mode.score, 0);
  return modes
    .map((mode) => ({ ...mode, sharePct: total > 0 ? Math.round((mode.score / total) * 100) : 0 }))
    .sort((a, b) => b.score - a.score);
}

function deriveProgress(raw) {
  return (raw ?? []).map((entry) => {
    const current = toNumber(entry.current);
    const total = toNumber(entry.total);
    return {
      name: entry.progressName,
      slug: slugify(entry.progressName),
      current,
      total,
      pct: total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0,
      complete: total > 0 && current >= total,
    };
  });
}

/**
 * Assets the CDN stores under a name the API never asks for. The BF4 set holds exactly 173 files
 * for exactly 173 weapons, and MPX_lineart.png against "M,_lineart.png" is the only unmatched pair
 * on either side -- the file is the MPX line art saved under a mangled name.
 */
const ICON_ALIASES = {
  'MPX_lineart.png': 'M,_lineart.png',
};

/**
 * The API builds icon URLs from the equipment name but the CDN stores them with the hyphens
 * stripped, and the two only disagree for hyphenated names -- "aek-971" resolves because it is
 * filed as aek971_lineart.png, while "LAV-25" 404s because the asset is LAV25_lineart.png. Trying
 * the de-hyphenated spelling, then a known alias, recovers those without touching the names that
 * already work. The local filename stays the one the API asked for either way.
 */
function iconSources(url) {
  const file = basename(new URL(url).pathname);
  const swap = (name) => url.replace(/[^/]+$/, encodeURIComponent(name));

  return [...new Set([url, swap(file.replace(/-/g, '')), ...(ICON_ALIASES[file] ? [swap(ICON_ALIASES[file])] : [])])];
}

async function downloadIcon(url, target) {
  if (existsSync(target) && !FORCE) return false;

  for (const source of iconSources(url)) {
    // A genuine 404 is not worth retrying, but the CDN also throws the occasional 503 under load --
    // retrying only those keeps real gaps distinguishable.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const res = await fetch(source, { headers: { 'User-Agent': UA } });
      if (res.ok) {
        writeFileSync(target, Buffer.from(await res.arrayBuffer()));
        await sleep(120);
        return true;
      }
      if (res.status < 500) break;
      if (attempt === 2) console.warn(`  icon failed (HTTP ${res.status}): ${source}`);
      else await sleep(1500);
    }
  }

  console.warn(`  icon unavailable on the CDN: ${basename(new URL(url).pathname)}`);
  return false;
}

async function downloadIcons(all, rank) {
  const groups = [
    ['weapons', all.weapons ?? []],
    ['vehicles', all.vehicles ?? []],
    ['classes', all.classes ?? []],
  ];

  let downloaded = 0;
  let skipped = 0;

  for (const [kind, entries] of groups) {
    const dir = join(PUBLIC_DIR, kind);
    mkdirSync(dir, { recursive: true });

    for (const entry of entries) {
      // Unused equipment never reaches the page, so its icons are not worth committing.
      if (kind !== 'classes' && toNumber(entry.kills) <= 0) continue;

      for (const [source, light] of [
        [entry.image, false],
        [entry.altImage, true],
      ]) {
        if (!source) continue;
        const file = basename(new URL(source).pathname).replace(/\.png$/i, '');
        const target = join(dir, `${file}${light ? '-light' : ''}.png`);
        if (await downloadIcon(source, target)) downloaded += 1;
        else skipped += 1;
      }
    }
    console.log(`  ${kind}: done`);
  }

  if (rank) {
    const dir = join(PUBLIC_DIR, 'ranks');
    mkdirSync(dir, { recursive: true });
    if (await downloadIcon(`${RANK_IMAGE_BASE}/${rank}.png`, join(dir, `${rank}.png`))) {
      downloaded += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(`Icons: ${downloaded} downloaded, ${skipped} already present or unavailable.`);
}

/**
 * Battlelog serves platoon emblems over plain http, which a browser would block as mixed content
 * on the deployed site. Committing the file sidesteps that and the runtime dependency at once.
 */
async function downloadPlatoonEmblem(platoon) {
  if (!platoon?.emblem) return null;

  mkdirSync(PUBLIC_DIR, { recursive: true });
  const target = join(PUBLIC_DIR, 'platoon.png');
  const secure = platoon.emblem.replace(/^http:/, 'https:');
  if ((await downloadIcon(secure, target)) || existsSync(target)) return '/battlefield4/platoon.png';

  console.warn('Warning: platoon emblem could not be downloaded, dropping the platoon block.');
  return null;
}

/** Numbers that disagree surface as warnings rather than shipping a wrong service record. */
function assertSanity(profile, weapons, vehicles, progress) {
  const computedKd = profile.deaths > 0 ? profile.kills / profile.deaths : 0;
  if (Math.abs(computedKd - profile.killDeath) > 0.05) {
    console.warn(
      `Warning: kills/deaths is ${computedKd.toFixed(2)} but the API reports ${profile.killDeath} ` +
        '-- the merge of /all/ and /stats/ may be mixing two personas.',
    );
  }

  // Weapon and vehicle kills legitimately overlap -- a kill from a tank's coaxial gun is counted
  // under both -- so only weapons alone exceeding the total, or a large combined overshoot, is a
  // real signal. On the reference account weapons were 88% of the total and the pair 100.3%.
  const weaponKills = weapons.reduce((sum, w) => sum + w.kills, 0);
  const attributed = weaponKills + vehicles.reduce((sum, v) => sum + v.kills, 0);
  if (weaponKills > profile.kills || attributed > profile.kills * 1.1) {
    console.warn(
      `Warning: weapon kills ${weaponKills.toLocaleString()} + vehicle kills ` +
        `${(attributed - weaponKills).toLocaleString()} against a total of ` +
        `${profile.kills.toLocaleString()} -- the equipment lists may be double-counting.`,
    );
  }

  const overflowed = progress.filter((entry) => entry.total > 0 && entry.current > entry.total);
  if (overflowed.length > 0) {
    console.warn(
      `Warning: progress over 100%: ${overflowed
        .map((e) => `${e.name} ${e.current}/${e.total}`)
        .join(', ')}`,
    );
  }
}

function readExisting() {
  if (!existsSync(OUTPUT_PATH)) return {};
  try {
    return JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'));
  } catch {
    console.warn('Warning: existing battlefield4.json is unreadable, starting fresh.');
    return {};
  }
}

async function main() {
  const existing = readExisting();
  const personaId = await resolvePersonaId(existing);
  const query = `playerid=${encodeURIComponent(personaId)}&platform=${PLATFORM}&format_values=true`;

  console.log('Fetching Battlefield 4 stats...');
  // /all/ carries the equipment lists but zeroes the rank progress and omits roundsPlayed;
  // /stats/ has those and little else. Both are needed.
  const [all, stats] = await Promise.all([
    fetchJson(`${API_BASE}/all/?${query}`),
    fetchJson(`${API_BASE}/stats/?${query}`),
  ]);

  const rank = toNumber(all.rank ?? stats.rank);

  // Icons first: iconPath() only emits a URL for a file that exists, so the download has to have
  // happened before anything is derived.
  if (WANT_ICONS) {
    console.log('Downloading icons...');
    await downloadIcons(all, rank);
  }
  const platoonEmblem = await downloadPlatoonEmblem(all.platoon);

  const { weapons, categories } = deriveWeapons(all.weapons);
  const { vehicles, families } = deriveVehicles(all.vehicles);
  const classes = deriveClasses(all.classes);
  const gamemodes = deriveGamemodes(all.gamemodes);
  const progress = deriveProgress(all.progress);

  const profile = {
    personaId: String(personaId),
    userName: all.userName ?? stats.userName ?? BF4_USER,
    platform: PLATFORM,
    rank,
    rankName: all.rankName ?? stats.rankName ?? '',
    rankImageUrl: existsSync(join(PUBLIC_DIR, 'ranks', `${rank}.png`))
      ? `/battlefield4/ranks/${rank}.png`
      : null,
    skill: toNumber(all.skill ?? stats.skill),
    scorePerMinute: toNumber(stats.scorePerMinute ?? all.scorePerMinute),
    killsPerMinute: toNumber(all.killsPerMinute),
    killDeath: toNumber(all.killDeath),
    winPercent: toNumber(all.winPercent),
    quitPercent: toNumber(all.quits),
    accuracy: toNumber(all.accuracy),
    headshotPercent: toNumber(all.headshots),
    secondsPlayed: toNumber(all.secondsPlayed),
    timePlayed: all.timePlayed ?? '',
    kills: toNumber(all.kills),
    deaths: toNumber(all.deaths),
    wins: toNumber(all.wins),
    losses: toNumber(all.loses),
    roundsPlayed: toNumber(stats.roundsPlayed),
    bestClass: all.bestClass ?? '',
    longestHeadShot: toNumber(all.longestHeadShot),
    highestKillStreak: toNumber(all.highestKillStreak),
    headShots: toNumber(all.headShots),
    killAssists: toNumber(all.killAssists ?? stats.killAssists),
    revives: toNumber(all.revives),
    heals: toNumber(all.heals),
    repairs: toNumber(all.repairs),
    resupplies: toNumber(all.resupplies),
    avengerKills: toNumber(all.avengerKills),
    saviorKills: toNumber(all.saviorKills),
    dogtagsTaken: toNumber(stats.dogtagsTaken),
    awardScore: toNumber(stats.awardScore),
    bonusScore: toNumber(stats.bonusScore),
    squadScore: toNumber(stats.squadScore),
  };

  console.log(
    `Soldier: ${profile.userName} -- rank ${profile.rank} (${profile.rankName}), ` +
      `${profile.kills.toLocaleString()} kills, ${profile.killDeath} K/D, ${profile.timePlayed}`,
  );
  console.log(
    `Equipment: ${weapons.length} weapons across ${categories.length} categories, ` +
      `${vehicles.length} vehicles across ${families.length} families.`,
  );
  assertSanity(profile, weapons, vehicles, progress);

  // type is "User" for a soldier's own custom emblem and names the platoon otherwise, which is the
  // only way to tell the two apart -- the tag comes back empty either way.
  const platoon =
    all.platoon && (all.platoon.tag || platoonEmblem)
      ? {
          tag: all.platoon.tag ?? '',
          type: all.platoon.type ?? '',
          emblem: platoonEmblem,
          url: all.platoon.url ?? null,
        }
      : null;

  const output = {
    fetchedAt: new Date().toISOString(),
    profile,
    weaponCategories: categories,
    weapons,
    vehicleFamilies: families,
    vehicles,
    classes,
    gamemodes,
    progress,
    platoon,
  };

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(`Failed: ${err.message}`);
  process.exit(1);
});
