/**
 * Seed Steam series groupings from Wikidata, so the Achievements tab can show
 * franchise-level 100% rollups ("METRO 3/3 PERFECTED").
 *
 * Usage:
 *   node scripts/seed-steam-collections.js --dry       # report only
 *   node scripts/seed-steam-collections.js             # merge new proposals in
 *   node scripts/seed-steam-collections.js --force     # regenerate from scratch
 *   node scripts/seed-steam-collections.js --suggest   # list what Wikidata missed
 *   node scripts/seed-steam-collections.js --refetch   # bypass the Wikidata cache
 *
 * Outputs:
 *   src/data/steam-collections.json
 *
 * No API key: the Wikidata Query Service is open, it only asks for a
 * descriptive User-Agent.
 *
 * This replaced a title-prefix heuristic, which could not work. Leading words
 * do not distinguish a franchise from a coincidence -- it grouped Far Cry with
 * FAR: Lone Sails, Max Payne with Max Manos, and My Friend Pedro with My Friend
 * Peppa Pig. Wikidata's "part of the series" (P179) is an actual fact about the
 * games, so it gets those right.
 *
 * Wikidata's own gap is that the statement often sits on a different item than
 * the Steam id. Metro is the worked example, and every step below exists
 * because of a case like it:
 *
 *   Metro 2033 Redux              steam id, no series, `based on` Metro 2033
 *   Metro: Last Light Redux       steam id, no series, no link at all
 *   Metro Exodus Enhanced Edition no Wikidata item whatsoever
 *   Metro Exodus                  steam id AND series -- but two of them
 *
 * So: traverse `based on` to reach the series (step 2), match the leftovers by
 * name against the series' own membership list (step 3), and break ties toward
 * the series that already holds owned games (step 3 again).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const LIBRARY_PATH = resolve(process.cwd(), 'src/data/steam-library.json');
const DATA_PATH = resolve(process.cwd(), 'src/data/steam-collections.json');
const CACHE_DIR = resolve(process.cwd(), 'scripts/.wikidata-cache');

const SPARQL_URL = 'https://query.wikidata.org/sparql';
/** WDQS rejects generic agents; identify the project and a contact. */
const USER_AGENT =
  'build-verified-portfolio/1.0 (https://github.com/Manxus; steam collection seeding)';

const dryRun = process.argv.includes('--dry');
const force = process.argv.includes('--force');
const suggest = process.argv.includes('--suggest');
const refetch = process.argv.includes('--refetch');

/** Wikidata: "video game series". */
const VIDEO_GAME_SERIES = 'wd:Q7058673';

/**
 * Re-release and SKU noise. Stripped before any title comparison, which is what
 * lets "Metro 2033 Redux" match the series member "Metro 2033".
 */
const EDITION_WORDS =
  /\b(redux|remastered|remaster|enhanced|definitive|complete|goty|game of the year|deluxe|ultimate|anniversary|edition|hd|classic|multiplayer|playtest|demo|beta|vr|collection|bundle)\b/gi;

/** Suffixes Wikidata puts on series labels that read badly as a heading. */
const LABEL_SUFFIX = /\s*(\(series\)|film series|video game series|series)$/i;

function normalizeTitle(name) {
  return String(name)
    .replace(/[™®©Ⓡ]/g, ' ')
    .replace(/\(\d{4}\)/g, ' ')
    .replace(EDITION_WORDS, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tidySeriesName(label) {
  const trimmed = String(label).replace(LABEL_SUFFIX, '').trim();
  return trimmed || String(label).trim();
}

function isPerfected(game) {
  const ach = game.achievements;
  return Boolean(ach && ach.total > 0 && ach.unlocked === ach.total);
}

function isTracked(game) {
  return Boolean(game.achievements?.total);
}

function unlockedCount(game) {
  return game.achievements?.unlocked ?? 0;
}

// ---------------------------------------------------------------- SPARQL

/**
 * Query WDQS, caching the raw response. The queries are slow (tens of seconds)
 * and the answers change on a scale of months, so a cache makes re-runs and
 * tuning instant. `--refetch` goes back to the network; `--force` does not,
 * since discarding local curation is unrelated to the upstream data being stale.
 */
async function sparql(name, query) {
  const cachePath = resolve(CACHE_DIR, `${name}.json`);
  if (!refetch && existsSync(cachePath)) {
    console.log(`  ${name}: cached`);
    return JSON.parse(await readFile(cachePath, 'utf8'));
  }

  // POST, not GET: the membership query carries hundreds of QIDs and a GET
  // URL that long comes back 414.
  const res = await fetch(SPARQL_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({ query }),
  });
  if (!res.ok) throw new Error(`WDQS ${res.status} for ${name}`);

  const json = await res.json();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cachePath, JSON.stringify(json), 'utf8');
  console.log(`  ${name}: ${json.results.bindings.length} rows`);
  return json;
}

/**
 * Every series that any owned game can be tied to.
 *
 * The four branches are four ways Wikidata connects a Steam id to a series:
 * directly, through the game a re-release is `based on`, through a whole the
 * game is `part of`, and through a series that lists the game as a part.
 */
const CANDIDATE_QUERY = `
SELECT DISTINCT ?series ?appid WHERE {
  { ?g wdt:P1733 ?appid ; wdt:P179 ?series . }
  UNION { ?g wdt:P1733 ?appid ; wdt:P144 ?b . ?b wdt:P179 ?series . }
  UNION { ?g wdt:P1733 ?appid ; wdt:P361 ?b . ?b wdt:P179 ?series . }
  UNION { ?series wdt:P527 ?g . ?g wdt:P1733 ?appid . ?series wdt:P31/wdt:P279* ${VIDEO_GAME_SERIES} . }
}`;

/**
 * Full membership of the candidate series, by name.
 *
 * The names are the point: they are how an owned game with no Wikidata item of
 * its own (Metro Exodus Enhanced Edition) still gets placed.
 *
 * The `mul` label fallback is load-bearing. Without it, series whose label is
 * only set on the multilingual entry come back as bare Q-ids -- Call of Duty,
 * Portal, Just Cause and Worms all did.
 */
function membershipQuery(qids) {
  const values = qids.map((q) => `wd:${q}`).join(' ');
  return `
SELECT DISTINCT ?seriesLabel ?memberLabel ?appid WHERE {
  VALUES ?series { ${values} }
  { ?member wdt:P179 ?series . }
  UNION { ?series wdt:P527 ?member . }
  UNION { ?m0 wdt:P179 ?series . ?member wdt:P144 ?m0 . }
  OPTIONAL { ?member wdt:P1733 ?appid . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,en-gb,mul". }
}`;
}

// ---------------------------------------------------------------- grouping

/**
 * Assign owned games to series.
 *
 * Steam ids win outright. Titles are only consulted for what is left over, and
 * only on an exact normalized match against a name Wikidata already filed under
 * that series -- so this can recognise an edition of a placed game, but can
 * never invent membership the way prefix matching did.
 */
function placeGames(games, rows) {
  const seriesByAppId = new Map();
  const seriesByTitle = new Map();

  for (const row of rows) {
    const series = tidySeriesName(row.seriesLabel.value);
    if (row.appid) seriesByAppId.set(row.appid.value, series);

    const title = normalizeTitle(row.memberLabel.value);
    if (!title) continue;
    if (!seriesByTitle.has(title)) seriesByTitle.set(title, new Set());
    seriesByTitle.get(title).add(series);
  }

  const buckets = new Map();
  const placed = new Map();
  const add = (series, game) => {
    if (!buckets.has(series)) buckets.set(series, new Map());
    buckets.get(series).set(game.appId, game);
    placed.set(game.appId, series);
  };

  for (const game of games) {
    const series = seriesByAppId.get(String(game.appId));
    if (series) add(series, game);
  }

  // Series that already hold an owned game, used to break ties below.
  const populated = new Set(buckets.keys());
  let byTitle = 0;

  for (const game of games) {
    if (placed.has(game.appId)) continue;
    const candidates = seriesByTitle.get(normalizeTitle(game.name));
    if (!candidates) continue;

    // Metro Exodus is filed under both "Metro" and "Metro 2033 universe".
    // Dropping ambiguous names loses the game; preferring the series the Steam
    // ids already populated picks the one actually on screen.
    const list = [...candidates];
    const pick =
      list.find((s) => populated.has(s)) ??
      [...list].sort((a, b) => a.length - b.length)[0];
    add(pick, game);
    byTitle += 1;
  }

  return { buckets, byAppId: placed.size - byTitle, byTitle };
}

/**
 * Split a series' members into the ones that count and the duplicate SKUs that
 * do not. Two entries are the same game when their noise-stripped titles match,
 * and the copy is only dropped when it has nothing unlocked -- the library
 * holds Metro Exodus (0/68) beside Metro Exodus Enhanced Edition (68/68), and
 * counting both would report Metro as 3/5 when the honest answer is 3/3.
 *
 * The zero-progress guard matters because stripping edition words is lossy:
 * "Call of Duty: Modern Warfare Remastered" and the "Modern Warfare" reboot
 * collapse onto one key, and without the guard the reboot would be hidden.
 */
function splitDuplicates(members) {
  const byTitle = new Map();
  for (const game of members) {
    const key = normalizeTitle(game.name);
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(game);
  }

  const keep = [];
  const ignore = [];
  for (const copies of byTitle.values()) {
    if (copies.length === 1) {
      keep.push(copies[0]);
      continue;
    }
    const ranked = [...copies].sort(
      (a, b) => unlockedCount(b) - unlockedCount(a) || a.appId - b.appId,
    );
    keep.push(ranked[0]);
    for (const dupe of ranked.slice(1)) {
      if (unlockedCount(dupe) === 0) ignore.push(dupe);
      else keep.push(dupe);
    }
  }
  return { keep, ignore };
}

function buildProposals(buckets) {
  const proposals = [];

  for (const [name, members] of buckets) {
    const { keep, ignore } = splitDuplicates([...members.values()]);
    if (keep.length < 2) continue;
    // An achievement showcase: a series with no 100% anywhere is not the point.
    const perfected = keep.filter(isPerfected);
    if (perfected.length === 0) continue;

    proposals.push({
      name,
      // Perfected first: the order is the display order, and the first game is
      // the one a collection card stands front and centre.
      appIds: [...keep]
        .sort(
          (a, b) =>
            Number(isPerfected(b)) - Number(isPerfected(a)) ||
            a.name.localeCompare(b.name),
        )
        .map((g) => g.appId),
      ignoreAppIds: [...ignore].sort((a, b) => a.appId - b.appId).map((g) => g.appId),
      note: '',
      _perfected: perfected.length,
      _tracked: keep.filter(isTracked).length,
      _members: keep,
      _ignored: ignore,
    });
  }

  proposals.sort(
    (a, b) =>
      b._perfected - a._perfected ||
      b.appIds.length - a.appIds.length ||
      a.name.localeCompare(b.name),
  );
  return proposals;
}

function report(proposals) {
  for (const p of proposals) {
    const complete = p._tracked >= 2 && p._perfected === p._tracked ? ' COMPLETE' : '';
    console.log(`${p.name.toUpperCase()} [${p._perfected}/${p._tracked}]${complete}`);
    for (const g of p._members) {
      const ach = g.achievements;
      const counts = ach?.total ? `${ach.unlocked}/${ach.total}` : 'no achievements';
      console.log(`    ${isPerfected(g) ? '*' : ' '} ${g.name} (${g.appId}) ${counts}`);
    }
    for (const g of p._ignored) {
      console.log(`    - ignored: ${g.name} (${g.appId})`);
    }
  }
}

/**
 * Title-prefix candidates Wikidata did not place -- printed, never written.
 *
 * Wikidata is thin on small indie series, so real groups (Bright Memory, Emily
 * is Away, Access Denied) go missing. This is the shortlist to add by hand; it
 * is advisory precisely because the same technique is what produced the junk
 * this script replaced.
 */
function reportSuggestions(games, placed) {
  const stop = new Set([
    'the', 'a', 'an', 'my', 'we', 'it', 'of', 'is', 'super', 'little', 'one',
    'two', 'no', 'new', 'all', 'and', 'i', 'you', 'this', 'that', 'big', 'in',
    'on', 'at', 'to', 'for', 'first', 'last', 'good', 'bad',
  ]);
  const buckets = new Map();

  for (const game of games) {
    if (placed.has(game.appId)) continue;
    const tokens = normalizeTitle(game.name).split(' ').filter(Boolean);
    for (let n = 1; n <= Math.min(3, tokens.length); n++) {
      const key = tokens.slice(0, n).join(' ');
      if (n === 1 && stop.has(key)) continue;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(game);
    }
  }

  const candidates = [...buckets.entries()]
    .filter(([, v]) => v.length >= 2 && v.some(isPerfected))
    .sort((a, b) => b[0].split(' ').length - a[0].split(' ').length);

  const claimed = new Set();
  const out = [];
  for (const [key, members] of candidates) {
    const fresh = members.filter((g) => !claimed.has(g.appId));
    if (fresh.length < 2 || !fresh.some(isPerfected)) continue;
    for (const g of fresh) claimed.add(g.appId);
    out.push([key, fresh]);
  }
  out.sort((a, b) => b[1].filter(isPerfected).length - a[1].filter(isPerfected).length);

  console.log(`\n=== ${out.length} title-prefix candidates Wikidata did not place ===`);
  console.log('Advisory only -- nothing below is written. Add the real ones by hand.\n');
  for (const [key, members] of out) {
    console.log(
      `${key.toUpperCase()} [${members.filter(isPerfected).length}/${members.length}]  ` +
        members.map((g) => `${g.name} (${g.appId})`).join(' | '),
    );
  }
}

// ---------------------------------------------------------------- main

async function main() {
  const library = JSON.parse(await readFile(LIBRARY_PATH, 'utf8'));
  const games = library.games || [];

  let existing = [];
  if (!force && existsSync(DATA_PATH)) {
    const current = JSON.parse(await readFile(DATA_PATH, 'utf8'));
    existing = current.collections || [];
  }

  // Anything already curated is authoritative: its games are off the table.
  const spokenFor = new Set();
  for (const c of existing) {
    for (const id of c.appIds || []) spokenFor.add(id);
    for (const id of c.ignoreAppIds || []) spokenFor.add(id);
  }
  const available = games.filter((g) => !spokenFor.has(g.appId));

  console.log('Querying Wikidata...');
  const candidates = await sparql('candidates', CANDIDATE_QUERY);
  const owned = new Set(available.map((g) => String(g.appId)));
  const qids = [
    ...new Set(
      candidates.results.bindings
        .filter((r) => owned.has(r.appid.value))
        .map((r) => r.series.value.split('/').pop()),
    ),
  ];
  console.log(`  ${qids.length} candidate series`);

  if (qids.length === 0) {
    console.log('No series found. Nothing to do.');
    return;
  }

  const membership = await sparql('membership', membershipQuery(qids));

  const { buckets, byAppId, byTitle } = placeGames(
    available,
    membership.results.bindings,
  );
  const proposals = buildProposals(buckets);
  const complete = proposals.filter(
    (p) => p._tracked >= 2 && p._perfected === p._tracked,
  ).length;

  console.log(
    `\n${games.length} games, ${existing.length} curated collections.\n` +
      `Placed ${byAppId + byTitle} games (${byAppId} by Steam id, ${byTitle} by title) ` +
      `into ${proposals.length} series, ${complete} of them complete.\n`,
  );
  report(proposals);

  if (suggest) {
    const placed = new Set();
    for (const p of proposals) {
      for (const id of p.appIds) placed.add(id);
      for (const id of p.ignoreAppIds) placed.add(id);
    }
    reportSuggestions(available, placed);
  }

  if (dryRun) {
    console.log('\n--dry: nothing written.');
    return;
  }

  const clean = proposals.map(({ name, appIds, ignoreAppIds, note }) => ({
    name,
    appIds,
    ignoreAppIds,
    note,
  }));
  const data = { collections: [...existing, ...clean] };
  await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${data.collections.length} collections to ${DATA_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
