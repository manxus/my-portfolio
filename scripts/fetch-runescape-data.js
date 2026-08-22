/**
 * Build-time script to fetch RuneScape 3 profile data (skills, quests, adventurer's log).
 *
 * Usage:
 *   node scripts/fetch-runescape-data.js                # normal sync
 *   node scripts/fetch-runescape-data.js --icons        # one-time: download the 29 wiki skill icons
 *   node scripts/fetch-runescape-data.js --no-avatar    # skip the Jagex character render
 *   node scripts/fetch-runescape-data.js --no-wiki      # skip RuneScape Wiki quest enrichment
 *   node scripts/fetch-runescape-data.js --force        # re-download icons that already exist
 *   node scripts/fetch-runescape-data.js --user=Zezima  # override the account
 *
 * Env:
 *   RS_USER  RuneScape display name (default: Manxus)
 *
 * Outputs:
 *   src/data/runescape.json
 *   public/runescape/icons/<slug>.png   (--icons only, committed once)
 *   public/runescape/character.png      (only when Jagex has a real render cached)
 *
 * Cache: scripts/.runescape-cache/quests-wiki.json (gitignored) -- quest metadata is static, so
 *        only titles absent from the cache are refetched. --force refetches everything.
 *
 * The official hiscores 404 for accounts outside the ranked population, so RuneMetrics is the
 * source of truth. It has no CORS headers and sits behind Cloudflare, hence the build-time
 * snapshot: the page reads committed JSON and keeps working when Jagex does not.
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../src/data/runescape.json');
const PUBLIC_DIR = resolve(__dirname, '../public/runescape');
const ICONS_DIR = join(PUBLIC_DIR, 'icons');
const CACHE_DIR = resolve(__dirname, '.runescape-cache');
const WIKI_CACHE_PATH = join(CACHE_DIR, 'quests-wiki.json');

const PROFILE_API = 'https://apps.runescape.com/runemetrics/profile/profile';
const QUESTS_API = 'https://apps.runescape.com/runemetrics/quests';
const AVATAR_BASE = 'https://secure.runescape.com/m=avatar-rs';
const WIKI_IMAGES = 'https://runescape.wiki/images';
const WIKI_API = 'https://runescape.wiki/api.php';
const WIKI_ARTICLE = 'https://runescape.wiki/w';

/** MediaWiki caps anonymous multi-title queries at 50, so 363 quests is 8 requests. */
const WIKI_BATCH_SIZE = 50;
const WIKI_BATCH_DELAY_MS = 300;

// Jagex and the wiki both sit behind Cloudflare and 403 generic fetchers.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ICONS_ONLY = process.argv.includes('--icons');
const NO_AVATAR = process.argv.includes('--no-avatar');
const NO_WIKI = process.argv.includes('--no-wiki');
const FORCE = process.argv.includes('--force');
const USER_FLAG = process.argv.find((a) => a.startsWith('--user='));
const RS_USER = (USER_FLAG ? USER_FLAG.slice('--user='.length) : process.env.RS_USER) || 'Manxus';

/**
 * Index === the id RuneMetrics uses in skillvalues[]. Caps above 99 are the RS3 elite skills;
 * Mining and Smithing were raised to 120 by the 2019 rework, which is easy to miss.
 */
const SKILLS = [
  { id: 0, name: 'Attack', maxLevel: 99, combat: true },
  { id: 1, name: 'Defence', maxLevel: 99, combat: true },
  { id: 2, name: 'Strength', maxLevel: 99, combat: true },
  { id: 3, name: 'Constitution', maxLevel: 99, combat: true },
  { id: 4, name: 'Ranged', maxLevel: 99, combat: true },
  { id: 5, name: 'Prayer', maxLevel: 99, combat: true },
  { id: 6, name: 'Magic', maxLevel: 99, combat: true },
  { id: 7, name: 'Cooking', maxLevel: 99 },
  { id: 8, name: 'Woodcutting', maxLevel: 99 },
  { id: 9, name: 'Fletching', maxLevel: 99 },
  { id: 10, name: 'Fishing', maxLevel: 99 },
  { id: 11, name: 'Firemaking', maxLevel: 99 },
  { id: 12, name: 'Crafting', maxLevel: 99 },
  { id: 13, name: 'Smithing', maxLevel: 120 },
  { id: 14, name: 'Mining', maxLevel: 120 },
  { id: 15, name: 'Herblore', maxLevel: 120 },
  { id: 16, name: 'Agility', maxLevel: 99 },
  { id: 17, name: 'Thieving', maxLevel: 99 },
  { id: 18, name: 'Slayer', maxLevel: 120 },
  { id: 19, name: 'Farming', maxLevel: 120 },
  { id: 20, name: 'Runecrafting', maxLevel: 99 },
  { id: 21, name: 'Hunter', maxLevel: 99 },
  { id: 22, name: 'Construction', maxLevel: 99 },
  { id: 23, name: 'Summoning', maxLevel: 99 },
  { id: 24, name: 'Dungeoneering', maxLevel: 120 },
  { id: 25, name: 'Divination', maxLevel: 99 },
  { id: 26, name: 'Invention', maxLevel: 150, elite: true },
  { id: 27, name: 'Archaeology', maxLevel: 120 },
  { id: 28, name: 'Necromancy', maxLevel: 120 },
];

const QUEST_DIFFICULTIES = [
  { key: 0, label: 'Novice' },
  { key: 1, label: 'Intermediate' },
  { key: 2, label: 'Experienced' },
  { key: 3, label: 'Master' },
  { key: 4, label: 'Grandmaster' },
  { key: 250, label: 'Special' },
];

const slugOf = (name) => name.toLowerCase();

/** Standard RuneScape XP curve. Elite skills (Invention) use a different one and are excluded. */
function buildXpTable(maxLevel = 126) {
  const table = [0, 0];
  let points = 0;
  for (let n = 1; n < maxLevel; n += 1) {
    points += Math.floor(n + 300 * Math.pow(2, n / 7));
    table[n + 1] = Math.floor(points / 4);
  }
  return table;
}

const XP_TABLE = buildXpTable();

function levelForXp(xp) {
  let level = 1;
  for (let n = 2; n < XP_TABLE.length; n += 1) {
    if (XP_TABLE[n] > xp) break;
    level = n;
  }
  return level;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`${url} failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  // RuneMetrics reports failures as HTTP 200 with an error body, so status is not enough.
  if (data && typeof data.error === 'string') {
    throw new Error(`RuneMetrics returned ${data.error} for "${RS_USER}"`);
  }
  return data;
}

async function fetchProfile(user) {
  return fetchJson(`${PROFILE_API}?user=${encodeURIComponent(user)}&activities=20`);
}

async function fetchQuests(user) {
  return fetchJson(`${QUESTS_API}?user=${encodeURIComponent(user)}`);
}

/**
 * Jagex serves a generic silhouette for accounts with no cached render, and returns 200 for every
 * username -- real or not. The only reliable tell is the final URL after redirects.
 */
async function fetchAvatar(user, filename, variant) {
  const res = await fetch(`${AVATAR_BASE}/${encodeURIComponent(user)}/${variant}`, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
  });
  if (!res.ok) return null;
  if (res.url.includes('default_')) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength < 1500) return null;

  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(join(PUBLIC_DIR, filename), buffer);
  return `/runescape/${filename}`;
}

/** Membership markers for the quest log. Wiki filenames differ from the `<Name>-icon.png` pattern. */
const EXTRA_ICONS = [
  { slug: 'members', file: 'P2P_icon.png' },
  { slug: 'free-to-play', file: 'F2P_icon.png' },
];

async function downloadIcons() {
  mkdirSync(ICONS_DIR, { recursive: true });
  let downloaded = 0;
  let skipped = 0;

  const wanted = [
    ...SKILLS.map((skill) => ({
      slug: slugOf(skill.name),
      file: `${skill.name}-icon.png`,
      label: skill.name,
    })),
    ...EXTRA_ICONS.map((icon) => ({ ...icon, label: icon.slug })),
  ];

  for (const icon of wanted) {
    const target = join(ICONS_DIR, `${icon.slug}.png`);
    if (existsSync(target) && !FORCE) {
      skipped += 1;
      continue;
    }

    const url = `${WIKI_IMAGES}/${icon.file}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) {
      throw new Error(`Icon download failed for ${icon.label} (HTTP ${res.status}) -- ${url}`);
    }
    writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    downloaded += 1;
    console.log(`  ${icon.label.padEnd(14)} ok`);
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`Icons: ${downloaded} downloaded, ${skipped} already present (${wanted.length} total).`);
}

function deriveSkills(skillvalues) {
  // The API sorts skillvalues by XP descending, not by id.
  const byId = new Map((skillvalues ?? []).map((s) => [s.id, s]));

  return SKILLS.map((meta) => {
    const raw = byId.get(meta.id);
    // skillvalues[].xp is in tenths of XP; profile.totalxp is whole XP.
    const xp = raw ? Math.round(raw.xp / 10) : 0;
    const level = raw?.level ?? 1;
    const virtualLevel = meta.elite ? level : Math.max(level, levelForXp(xp));
    const nextXp = meta.elite ? null : XP_TABLE[virtualLevel + 1] ?? null;
    const currentXp = meta.elite ? null : XP_TABLE[virtualLevel] ?? 0;

    return {
      id: meta.id,
      name: meta.name,
      slug: slugOf(meta.name),
      iconUrl: `/runescape/icons/${slugOf(meta.name)}.png`,
      level,
      virtualLevel,
      maxLevel: meta.maxLevel,
      isMaxed: level >= meta.maxLevel,
      combat: meta.combat === true,
      xp,
      xpToNext: nextXp === null ? null : Math.max(0, nextXp - xp),
      progressPct:
        nextXp === null || nextXp <= currentXp
          ? null
          : Math.max(0, Math.min(100, Math.round(((xp - currentXp) / (nextXp - currentXp)) * 100))),
    };
  });
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Wiki release dates look like "[[15 May]] [[2007]]". Returns ISO date or null. */
function parseWikiDate(raw) {
  const plain = String(raw ?? '').replace(/\[\[|\]\]/g, ' ').replace(/\s+/g, ' ').trim();
  const match = plain.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!match) return null;
  const month = MONTHS.indexOf(match[2].toLowerCase());
  if (month < 0) return null;
  const day = Number(match[1]);
  const year = Number(match[3]);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The wiki uses Yes/yes/No/no inconsistently across templates. */
function wikiBool(raw) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return null;
}

/** "none" is the wiki's null for series and combat level. */
function wikiOptional(raw) {
  const value = String(raw ?? '').trim();
  return !value || value.toLowerCase() === 'none' ? null : value;
}

function titleCase(raw) {
  const value = wikiOptional(raw);
  if (!value) return null;
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

function wikiUrlFor(title) {
  return `${WIKI_ARTICLE}/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;
}

/**
 * Quest, Miniquest and Subquest infoboxes share one field shape, so a single parser covers
 * all three. Returns a flat key/value map of the first matching infobox.
 */
function parseInfobox(wikitext) {
  const match = String(wikitext ?? '').match(/\{\{Infobox (?:Quest|Miniquest|Subquest)([\s\S]*?)\n\}\}/i);
  if (!match) return null;

  const fields = {};
  for (const line of match[1].split(/\n\|/).slice(1)) {
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key && value) fields[key] = value;
  }
  return fields;
}

function shapeWikiQuest(fields, wikiTitle) {
  const seriesIndex = Number(fields.series_nth);
  const questNumber = Number(fields.number);

  return {
    wikiTitle,
    wikiUrl: wikiUrlFor(wikiTitle),
    series: wikiOptional(fields.main_series),
    seriesIndex: Number.isFinite(seriesIndex) ? seriesIndex : null,
    area: wikiOptional(fields.area),
    combat: wikiOptional(fields.combat),
    recommended: wikiBool(fields.recommended),
    age: titleCase(fields.age),
    releaseDate: parseWikiDate(fields.release),
    releaseRaw: String(fields.release ?? '').replace(/\[\[|\]\]/g, '').trim() || null,
    questNumber: Number.isFinite(questNumber) ? questNumber : null,
    difficultyLabel: wikiOptional(fields.difficulty),
  };
}

function readWikiCache() {
  if (FORCE || !existsSync(WIKI_CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(WIKI_CACHE_PATH, 'utf8'));
  } catch {
    console.warn('Warning: wiki quest cache is unreadable, refetching.');
    return {};
  }
}

function writeWikiCache(cache) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(WIKI_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}

/**
 * Enriches quest titles with RuneScape Wiki infobox metadata, keyed by the ORIGINAL RuneMetrics
 * title. The response's `normalized` and `redirects` arrays have to be replayed to map a requested
 * title onto the page that actually answered — 10 of the 363 quests only resolve via a redirect.
 */
async function fetchQuestWiki(titles) {
  const cache = readWikiCache();
  const pending = titles.filter((t) => !(t in cache));

  if (pending.length === 0) {
    console.log(`Quest wiki: ${titles.length} titles served from cache.`);
    return cache;
  }

  for (let i = 0; i < pending.length; i += WIKI_BATCH_SIZE) {
    const chunk = pending.slice(i, i + WIKI_BATCH_SIZE);
    const url =
      `${WIKI_API}?action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1` +
      `&format=json&formatversion=2&titles=${encodeURIComponent(chunk.join('|'))}`;

    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Wiki query failed (HTTP ${res.status})`);
    const data = await res.json();
    const query = data.query ?? {};

    const normalized = new Map((query.normalized ?? []).map((n) => [n.from, n.to]));
    const redirects = new Map((query.redirects ?? []).map((r) => [r.from, r.to]));
    const pages = new Map((query.pages ?? []).filter((p) => !p.missing).map((p) => [p.title, p]));

    for (const title of chunk) {
      let resolved = normalized.get(title) ?? title;
      resolved = redirects.get(resolved) ?? resolved;
      const page = pages.get(resolved);
      const fields = page ? parseInfobox(page.revisions?.[0]?.slots?.main?.content) : null;
      // null is a real cached answer: this title has no parseable infobox, do not retry it.
      cache[title] = fields ? shapeWikiQuest(fields, resolved) : null;
    }

    await new Promise((r) => setTimeout(r, WIKI_BATCH_DELAY_MS));
  }

  writeWikiCache(cache);
  return cache;
}

function deriveQuests(payload, wikiByTitle = {}) {
  const quests = Array.isArray(payload?.quests) ? payload.quests : [];
  const isDone = (q) => q.status === 'COMPLETED';

  const byDifficulty = QUEST_DIFFICULTIES.map(({ key, label }) => {
    const bucket = quests.filter((q) => q.difficulty === key);
    return { label, completed: bucket.filter(isDone).length, total: bucket.length };
  }).filter((entry) => entry.total > 0);

  // Anything with an unrecognised difficulty still has to reach the totals.
  const knownKeys = new Set(QUEST_DIFFICULTIES.map((d) => d.key));
  const unknown = quests.filter((q) => !knownKeys.has(q.difficulty));
  if (unknown.length > 0) {
    console.warn(`Warning: ${unknown.length} quest(s) with an unrecognised difficulty code.`);
    byDifficulty.push({
      label: 'Other',
      completed: unknown.filter(isDone).length,
      total: unknown.length,
    });
  }

  const difficultyLabels = new Map(QUEST_DIFFICULTIES.map((d) => [d.key, d.label]));

  const items = quests.map((q) => {
    const wiki = wikiByTitle[q.title] ?? null;
    return {
      title: q.title,
      status: q.status,
      difficulty: q.difficulty,
      // The wiki label and the RuneMetrics code agree; the wiki also names code 250 as "Special".
      difficultyLabel: difficultyLabels.get(q.difficulty) ?? wiki?.difficultyLabel ?? 'Other',
      members: q.members === true,
      questPoints: q.questPoints ?? 0,
      eligible: q.userEligible === true,
      series: wiki?.series ?? null,
      seriesIndex: wiki?.seriesIndex ?? null,
      area: wiki?.area ?? null,
      combat: wiki?.combat ?? null,
      releaseDate: wiki?.releaseDate ?? null,
      wikiUrl: wiki?.wikiUrl ?? wikiUrlFor(q.title),
    };
  });

  return {
    points: quests.filter(isDone).reduce((sum, q) => sum + (q.questPoints ?? 0), 0),
    pointsTotal: quests.reduce((sum, q) => sum + (q.questPoints ?? 0), 0),
    completed: quests.filter(isDone).length,
    started: quests.filter((q) => q.status === 'STARTED').length,
    notStarted: quests.filter((q) => q.status === 'NOT_STARTED').length,
    total: quests.length,
    byDifficulty,
    items,
  };
}

/** Both units traps surface here as warnings rather than shipping numbers that are off by 10x. */
function assertSanity(profile, skills) {
  const summed = skills.reduce((sum, s) => sum + s.xp, 0);
  if (Math.abs(summed - profile.totalxp) > 5000) {
    console.warn(
      `Warning: skill XP sums to ${summed.toLocaleString()} but totalxp is ` +
        `${Number(profile.totalxp).toLocaleString()} -- the tenths-of-XP assumption may no longer hold.`,
    );
  }

  const standard = skills.filter((s) => s.maxLevel !== 150);
  const mismatches = standard.filter((s) => Math.min(s.virtualLevel, s.maxLevel) !== s.level);
  if (mismatches.length > 0) {
    console.warn(
      `Warning: XP table disagrees with the reported level for ${mismatches
        .map((s) => `${s.name} (${s.level} vs ${Math.min(s.virtualLevel, s.maxLevel)})`)
        .join(', ')}`,
    );
  } else {
    console.log(`Level table check: ${standard.length}/${standard.length} standard skills agree.`);
  }
}

function readExisting() {
  if (!existsSync(OUTPUT_PATH)) return {};
  try {
    return JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'));
  } catch {
    console.warn('Warning: existing runescape.json is unreadable, starting fresh.');
    return {};
  }
}

async function main() {
  if (ICONS_ONLY) {
    console.log('Downloading RS3 wiki skill icons...');
    await downloadIcons();
    return;
  }

  console.log(`Fetching RuneMetrics data for "${RS_USER}"...`);
  const [profile, questPayload] = await Promise.all([fetchProfile(RS_USER), fetchQuests(RS_USER)]);

  const skills = deriveSkills(profile.skillvalues);

  let wikiByTitle = {};
  if (!NO_WIKI) {
    const titles = (questPayload?.quests ?? []).map((q) => q.title);
    try {
      wikiByTitle = await fetchQuestWiki(titles);
      const enriched = titles.filter((t) => wikiByTitle[t]).length;
      const missing = titles.filter((t) => !wikiByTitle[t]);
      console.log(
        `Quest wiki: ${enriched}/${titles.length} enriched` +
          (missing.length ? ` (no infobox: ${missing.join(', ')})` : ''),
      );
    } catch (err) {
      // Enrichment is a bonus; never let the wiki block a sync.
      console.warn(`Warning: wiki enrichment failed (${err.message}) -- continuing without it.`);
      wikiByTitle = {};
    }
  }

  const quests = deriveQuests(questPayload, wikiByTitle);

  console.log(
    `Profile: ${profile.name} -- combat ${profile.combatlevel}, total level ` +
      `${Number(profile.totalskill).toLocaleString()}, total XP ${Number(profile.totalxp).toLocaleString()}`,
  );
  assertSanity(profile, skills);
  console.log(
    `Quests: ${quests.points}/${quests.pointsTotal} quest points from ${quests.completed}/${quests.total} complete`,
  );

  let avatarUrl = null;
  let bustUrl = null;
  if (!NO_AVATAR) {
    avatarUrl = await fetchAvatar(RS_USER, 'character.png', 'full.png');
    bustUrl = await fetchAvatar(RS_USER, 'character-bust.png', 'chat.png');
    if (avatarUrl) {
      console.log('Character: saved the Jagex render.');
    } else {
      console.log(
        'Character: Jagex returned the default silhouette -- log into RuneScape once and re-run, ' +
          'or set character.imageUrl to an uploaded screenshot.',
      );
    }
  }

  const existing = readExisting();
  const existingCharacter = existing.character ?? {};

  const output = {
    fetchedAt: new Date().toISOString(),
    // Hand-owned block: the admin editor writes here and the sync must not clobber it.
    character: {
      displayName: existingCharacter.displayName ?? profile.name,
      tagline: existingCharacter.tagline ?? '',
      note: existingCharacter.note ?? '',
      imageUrl: existingCharacter.imageUrl ?? '',
      avatarUrl: avatarUrl ?? existingCharacter.avatarUrl ?? null,
      bustUrl: bustUrl ?? existingCharacter.bustUrl ?? null,
    },
    profile: {
      name: profile.name,
      combatLevel: profile.combatlevel ?? 3,
      totalLevel: profile.totalskill ?? 0,
      totalXp: profile.totalxp ?? 0,
      rank: profile.rank ?? null,
      combatXp: {
        melee: profile.melee ?? 0,
        ranged: profile.ranged ?? 0,
        magic: profile.magic ?? 0,
      },
    },
    skills,
    quests,
    activities: (profile.activities ?? []).map((a) => ({
      date: a.date,
      text: a.text,
      details: a.details,
    })),
  };

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(`Failed: ${err.message}`);
  process.exit(1);
});
