/**
 * Build-time script to assemble the Battlefield 4 assignment list -- what each one requires, how
 * far it got, and whether it is done.
 *
 * Usage:
 *   node scripts/fetch-bf4-assignments.js
 *
 * Inputs:
 *   data-sources/battlefield4-assignments.xlsx   hand-tracked multiplayer progress (the spine)
 *   battlefield.fandom.com                       rewards, prerequisites, campaign assignments
 *
 * Outputs:
 *   src/data/battlefield4-assignments.json
 *
 * Two sources because neither is complete on its own. Battlelog gates every soldier endpoint
 * (missionsPopulateStats and friends redirect to /bf4/gate/) and gametools has no BF4 assignment
 * endpoint, so per-assignment completion exists nowhere public -- only the hand-kept spreadsheet
 * has it, along with per-task progress and the expansion assignments the wiki never tabulates. The
 * wiki in turn has the rewards and prerequisites the spreadsheet does not track, plus the 6
 * campaign assignments the spreadsheet omits.
 *
 * Those two halves reconcile exactly: 102 multiplayer + 6 campaign = 108, and 55 + 6 = 61, matching
 * the Assignments figure Battlelog reports in battlefield4.json. assertSanity() checks that against
 * the live API data on every run rather than trusting hardcoded totals.
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { readWorkbookRows } from './xlsx-reader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../src/data/battlefield4-assignments.json');
const WORKBOOK_PATH = resolve(__dirname, '../data-sources/battlefield4-assignments.xlsx');
const STATS_PATH = resolve(__dirname, '../src/data/battlefield4.json');
const BADGE_DIR = resolve(__dirname, '../public/battlefield4/assignments');
const WORKBOOK_REPO_PATH = 'data-sources/battlefield4-assignments.xlsx';

const WANT_BADGES = process.argv.includes('--badges');
const FORCE = process.argv.includes('--force');

const WIKI_PAGE = 'Assignment/Battlefield_4';
const WIKI_API = 'https://battlefield.fandom.com/api.php';
const WIKI_URL = `https://battlefield.fandom.com/wiki/${WIKI_PAGE}`;

// Fandom answers plain page requests with HTTP 402 for non-browser clients; the MediaWiki API
// returns the source cleanly, and the wikitext is far easier to parse than the rendered HTML.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Wiki sections holding a tier table, and the heading that ends each one. */
const WIKI_TIERS = [
  { name: 'Bronze', ends: 'Silver' },
  { name: 'Silver', ends: 'Gold' },
  { name: 'Gold', ends: 'Phantom' },
];

/** The 6 campaign unlocks, which the spreadsheet does not cover. */
const WIKI_CAMPAIGN = { name: 'Multiplayer Unlocks', ends: 'Mission Assignments' };

/**
 * Column A spells the tier name vertically down each section, so the section a row falls in gives
 * its tier. Checked against the wiki's own tier for all 50 assignments the two sources share.
 */
const SHEET_TIER_BOUNDARIES = [
  { upTo: 83, tier: 'Bronze' },
  { upTo: 148, tier: 'Silver' },
  { upTo: Infinity, tier: 'Gold' },
];

/** Groups in display order, with the expected size of each as a drift check. */
const GROUPS = [
  { name: 'Campaign', expected: 6 },
  { name: 'Bronze', expected: 40 },
  { name: 'Silver', expected: 32 },
  { name: 'Gold', expected: 21 },
  { name: 'Premium', expected: 5 },
  { name: 'Phantom', expected: 4 },
];

/**
 * The spreadsheet's Gold section ends with two runs that are their own thing in game: the five
 * Premium "Ultimate" assignments, then the four Phantom Program ones. Splitting them leaves Gold at
 * 21, which is exactly what the spreadsheet's own Gold counter reads.
 */
function regroup(assignment) {
  if (assignment.group !== 'Gold') return assignment.group;
  if (/^Phantom /i.test(assignment.name)) return 'Phantom';
  return assignment.premium ? 'Premium' : 'Gold';
}

/** Task text sits in these columns; progress reads current from the same column and target from +2. */
const TASK_COLUMNS = [
  ['E', 'G'],
  ['H', 'J'],
  ['K', 'M'],
  ['N', 'P'],
  ['Q', 'S'],
];

/** Unwrap wiki markup to plain text: file embeds go, links keep their label. */
function clean(value) {
  return String(value ?? '')
    .replace(/\[\[File:[^\]]*\]\]/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Criteria and rewards are wiki bullet lists; one string per bullet. */
function bullets(cell) {
  return String(cell ?? '')
    .split('\n')
    .filter((line) => /^\s*\*/.test(line))
    .map((line) => clean(line.replace(/^\s*\*+/, '')))
    .filter(Boolean);
}

/** Some columns hold a bullet list ("Rank 20" / "Battlefield Premium"), others a bare value. */
function lines(cell) {
  const listed = bullets(cell);
  if (listed.length > 0) return listed;

  // An empty bullet leaves the marker behind, which would ship as a reward reading "*".
  const single = clean(cell).replace(/^\**\s*/, '');
  return /[a-z0-9]/i.test(single) ? [single] : [];
}

/**
 * A dog tag reward exists only as its image, so the text has to come from the file name -- without
 * this the entire Premium tier reports no reward at all.
 */
function rewards(cell) {
  const tags = [...String(cell ?? '').matchAll(/\[\[File:([^\]|]+?)\.(?:png|jpg|jpeg)/gi)]
    .map((match) => clean(match[1]))
    // The page spells it "Dog Tag" everywhere except Hitman's "Dogtag", so match both and settle
    // on one spelling for display.
    .filter((name) => /dog\s?tags?/i.test(name))
    .map((name) => name.replace(/dog\s?tags?/i, 'Dog Tag'));

  return [...new Set([...tags, ...lines(cell)])];
}

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Merge key: the spreadsheet shouts its names and punctuates differently from the wiki. */
const nameKey = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Title case, since the spreadsheet stores every name in caps. */
const titleCase = (value) =>
  String(value)
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-z])/g, (_, prefix, letter) => prefix + letter.toUpperCase());

const toNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// ---------------------------------------------------------------------------- wiki

async function fetchWikitext() {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(WIKI_PAGE)}&format=json&prop=wikitext`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} failed (HTTP ${res.status})`);

  const data = await res.json();
  if (data.error) throw new Error(`MediaWiki returned ${data.error.code}: ${data.error.info}`);

  const text = data?.parse?.wikitext?.['*'];
  if (!text) throw new Error('MediaWiki response carried no wikitext');
  return text;
}

/** A row's cells each start with `|` at line start and run until the next one. */
function splitCells(row) {
  const cells = [];
  let current = null;

  for (const line of row.split('\n')) {
    if (/^\|/.test(line)) {
      if (current !== null) cells.push(current);
      current = line.slice(1);
    } else if (current !== null) {
      current += `\n${line}`;
    }
  }
  if (current !== null) cells.push(current);

  return cells;
}

/**
 * The tables on the page do not share a column layout -- the Premium one leads with Name where the
 * others lead with Image -- so columns are located by their header label. A fixed-index parser
 * reads Criteria out of the Reward column and mangles exactly those rows.
 */
function parseTable(table) {
  const rows = table.split(/^\|-\s*$/m);
  const header = splitCells(rows[0]).map((cell) => clean(cell).toLowerCase());

  const columnOf = (label) => header.indexOf(label);
  const nameCol = columnOf('name');
  const criteriaCol = columnOf('criteria');
  if (nameCol < 0 || criteriaCol < 0) return [];

  const unlockedCol = columnOf('unlocked');
  const rewardCol = columnOf('reward');

  const parsed = [];
  for (const row of rows.slice(1)) {
    const cells = splitCells(row);
    if (cells.length < header.length) continue;

    const name = clean(cells[nameCol]);
    if (!name) continue;

    const criteria = bullets(cells[criteriaCol]);
    const unlockedBy = unlockedCol >= 0 ? lines(cells[unlockedCol]) : [];

    parsed.push({
      name,
      unlockedBy: unlockedBy.filter((line) => !/^default$/i.test(line)),
      // Premium is listed as a prerequisite rather than a field of its own, and on the tier tables
      // that spell criteria out differently it can land on either side, so check both.
      premium: [...unlockedBy, ...criteria].some((line) => /battlefield premium/i.test(line)),
      criteria: criteria.length > 0 ? criteria : lines(cells[criteriaCol]),
      reward: rewardCol >= 0 ? rewards(cells[rewardCol]) : [],
    });
  }

  return parsed;
}

function parseSection(wikitext, { name, ends }) {
  const start = wikitext.indexOf(`==${name}==`);
  if (start < 0) throw new Error(`Section "${name}" is no longer on the page`);

  const stop = wikitext.indexOf(`==${ends}==`);
  return wikitext
    .slice(start, stop > start ? stop : undefined)
    .split(/^\{\|/m)
    .slice(1)
    .map((table) => table.split(/^\|\}/m)[0])
    .flatMap(parseTable);
}

// ---------------------------------------------------------------------------- spreadsheet

function sheetTier(row) {
  return SHEET_TIER_BOUNDARIES.find((boundary) => row < boundary.upTo).tier;
}

/**
 * Each assignment spans two rows: the upper carries the name, the done flag and the task text, the
 * lower carries `current / target` beneath each task.
 */
function parseWorkbook() {
  const rows = readWorkbookRows(readFileSync(WORKBOOK_PATH));
  const parsed = [];

  for (const [rowNumber, cells] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    const name = (cells.B ?? '').trim();
    if (!name || name === 'NAME') continue;

    const progress = rows.get(rowNumber + 1) ?? {};
    const tasks = [];

    for (const [textColumn, targetColumn] of TASK_COLUMNS) {
      const text = (cells[textColumn] ?? '').trim();
      if (!text) continue;

      const current = toNumber(progress[textColumn]);
      const target = toNumber(progress[targetColumn]);
      tasks.push({
        text,
        current,
        target,
        pct:
          current !== null && target > 0 ? Math.min(100, Math.round((current / target) * 100)) : null,
      });
    }

    parsed.push({
      name: titleCase(name),
      group: sheetTier(rowNumber),
      done: (cells.C ?? '').includes('✔'),
      tasks,
    });
  }

  return parsed;
}

// ---------------------------------------------------------------------------- badges

/**
 * Map every assignment name on the page to the badge its own row embeds.
 *
 * Matching badges by filename cannot work here: the wiki's file names are not reliable. The Assault
 * Veteran row embeds "Assault Expert.png" and the Expert row embeds "Assault Veteran.png" -- the
 * files are misnamed, so a name-based match hands each tier the other's badge. Names also collide
 * across the series ("Road Warrior.png" is a Battlelog mission badge, "Frostbite.png" a camo), and
 * several badges are filed by expansion slot ("Xp3as02.png") or codename ("Ghost3.png") that no
 * rule could derive. The row is the one place name and art are stated together.
 */
function parseImageMap(wikitext) {
  const map = new Map();

  for (const table of wikitext.split(/^\{\|/m).slice(1)) {
    const rows = table.split(/^\|\}/m)[0].split(/^\|-\s*$/m);
    const header = splitCells(rows[0]).map((cell) => clean(cell).toLowerCase());

    const nameCol = header.indexOf('name');
    const imageCol = header.indexOf('image');
    if (nameCol < 0 || imageCol < 0) continue;

    for (const row of rows.slice(1)) {
      const cells = splitCells(row);
      if (cells.length < header.length) continue;

      const name = clean(cells[nameCol]);
      const file = cells[imageCol].match(/\[\[File:([^\]|]+)/);
      if (name && file) map.set(nameKey(name), file[1].trim());
    }
  }

  return map;
}

/** Resolve file titles to their CDN urls, 40 at a time. */
async function resolveFileUrls(titles) {
  const urls = new Map();

  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40).map((title) => `File:${title}`);
    const url =
      `${WIKI_API}?action=query&format=json&prop=imageinfo&iiprop=url` +
      `&titles=${encodeURIComponent(batch.join('|'))}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`file lookup failed (HTTP ${res.status})`);

    const data = await res.json();
    for (const page of Object.values(data.query?.pages ?? {})) {
      if (page.imageinfo?.[0]?.url) urls.set(page.title.replace(/^File:/, ''), page.imageinfo[0].url);
    }
  }

  return urls;
}

async function resolveBadges(assignments, imageMap) {
  const chosen = new Map();
  const unmatched = [];

  for (const assignment of assignments) {
    const file = imageMap.get(nameKey(assignment.name));
    if (file) chosen.set(assignment.id, file);
    else unmatched.push(assignment.name);
  }

  if (unmatched.length > 0) {
    console.warn(`  no badge row on the page for: ${unmatched.join(', ')}`);
  }

  const urls = await resolveFileUrls([...new Set(chosen.values())]);
  const badges = new Map();
  for (const [id, file] of chosen) {
    if (urls.has(file)) badges.set(id, urls.get(file));
  }

  return badges;
}

/**
 * The wiki CDN answers with WebP whatever the Accept header says, so the file is stored with the
 * extension it actually is rather than the .png the source URL implies.
 */
async function downloadBadges(badges) {
  mkdirSync(BADGE_DIR, { recursive: true });
  let downloaded = 0;
  let skipped = 0;

  for (const [id, url] of badges) {
    const target = join(BADGE_DIR, `${id}.webp`);
    if (existsSync(target) && !FORCE) {
      skipped += 1;
      continue;
    }

    // Wide enough to stay crisp on a ~130px tile at 2x, without shipping the full-size original.
    const source = `${url.split('/revision/')[0]}/revision/latest/scale-to-width-down/320`;

    // The CDN throws the occasional 503 under load; a genuine 404 is not worth retrying.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const res = await fetch(source, { headers: { 'User-Agent': UA } });
      if (res.ok) {
        writeFileSync(target, Buffer.from(await res.arrayBuffer()));
        downloaded += 1;
        break;
      }
      if (res.status < 500 || attempt === 3) {
        console.warn(`  badge failed (HTTP ${res.status}): ${id}`);
        break;
      }
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }

    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(`Badges: ${downloaded} downloaded, ${skipped} already present.`);
}

// ---------------------------------------------------------------------------- merge

function merge(sheetAssignments, wikiTiers, wikiCampaign) {
  const wikiByName = new Map(wikiTiers.map((entry) => [nameKey(entry.name), entry]));
  const matched = new Set();

  const multiplayer = sheetAssignments.map((assignment) => {
    const key = nameKey(assignment.name);
    const wiki = wikiByName.get(key);
    if (wiki) matched.add(key);

    const merged = {
      id: slugify(assignment.name),
      // The wiki's casing is nicer than the spreadsheet's shouting, where both have the name.
      name: wiki ? wiki.name : assignment.name,
      group: assignment.group,
      done: assignment.done,
      premium: wiki?.premium ?? false,
      unlockedBy: wiki?.unlockedBy ?? [],
      reward: wiki?.reward ?? [],
      // The spreadsheet's phrasing is kept over the wiki's: only its lines carry progress figures.
      tasks: assignment.tasks,
    };

    return { ...merged, group: regroup(merged) };
  });

  const campaign = wikiCampaign.map((entry) => ({
    id: slugify(entry.name),
    name: entry.name,
    group: 'Campaign',
    // The spreadsheet tracks multiplayer only; the campaign unlocks are all complete, which is
    // what makes its 55 and Battlelog's 61 agree.
    done: true,
    premium: entry.premium,
    unlockedBy: entry.unlockedBy,
    reward: entry.reward,
    tasks: entry.criteria.map((text) => ({ text, current: null, target: null, pct: null })),
  }));

  return { assignments: [...campaign, ...multiplayer], matched };
}

// ---------------------------------------------------------------------------- checks

/** Cross-checked against the live Battlelog figures rather than constants baked in here. */
function assertSanity(assignments, matched, wikiTierCount) {
  const done = assignments.filter((a) => a.done).length;

  let reported = null;
  try {
    const stats = JSON.parse(readFileSync(STATS_PATH, 'utf8'));
    reported = stats.progress?.find((entry) => /assignment/i.test(entry.name)) ?? null;
  } catch {
    console.warn('Warning: battlefield4.json is unreadable, skipping the Battlelog cross-check.');
  }

  if (reported) {
    if (assignments.length !== reported.total) {
      console.warn(
        `Warning: assembled ${assignments.length} assignments but Battlelog counts ` +
          `${reported.total} -- a source is missing entries.`,
      );
    }
    if (done !== reported.current) {
      console.warn(
        `Warning: ${done} marked done but Battlelog reports ${reported.current} -- the spreadsheet ` +
          'may be out of date, or the campaign assumption no longer holds.',
      );
    }
  }

  if (matched.size !== wikiTierCount) {
    console.warn(
      `Warning: ${wikiTierCount - matched.size} wiki assignment(s) did not match a spreadsheet row ` +
        '-- the name-based merge has drifted.',
    );
  }

  for (const group of GROUPS) {
    const count = assignments.filter((a) => a.group === group.name).length;
    if (count !== group.expected) {
      console.warn(`Warning: ${group.name} holds ${count} assignments, expected ${group.expected}.`);
    }
  }

  const overshot = assignments.flatMap((a) =>
    a.tasks
      .filter((task) => task.current !== null && task.target !== null && task.current > task.target)
      .map((task) => `${a.name}: ${task.current}/${task.target}`),
  );
  if (overshot.length > 0) {
    console.warn(`Warning: task progress above its target -- ${overshot.join(', ')}`);
  }

  const inconsistent = assignments.filter(
    (a) => a.done && a.tasks.some((task) => task.pct !== null && task.pct < 100),
  );
  if (inconsistent.length > 0) {
    console.warn(
      `Warning: marked done with unfinished tasks -- ${inconsistent.map((a) => a.name).join(', ')}`,
    );
  }

  const taskless = assignments.filter((a) => a.tasks.length === 0);
  if (taskless.length > 0) {
    console.warn(`Warning: no tasks parsed for ${taskless.map((a) => a.name).join(', ')}`);
  }

  const leaked = assignments.filter((a) =>
    [a.name, ...a.unlockedBy, ...a.reward, ...a.tasks.map((t) => t.text)].some((value) =>
      /\[\[|\]\]|File:|'''|<\w/.test(value),
    ),
  );
  if (leaked.length > 0) {
    console.warn(`Warning: wiki markup survived in ${leaked.map((a) => a.name).join(', ')}`);
  }
}

async function main() {
  console.log('Reading the tracking spreadsheet...');
  const sheetAssignments = parseWorkbook();
  console.log(`  ${sheetAssignments.length} multiplayer assignments, ` +
    `${sheetAssignments.filter((a) => a.done).length} done.`);

  console.log(`Fetching rewards and campaign unlocks from ${WIKI_PAGE}...`);
  const wikitext = await fetchWikitext();
  const wikiTiers = WIKI_TIERS.flatMap((tier) => parseSection(wikitext, tier));
  const wikiCampaign = parseSection(wikitext, WIKI_CAMPAIGN);
  console.log(`  ${wikiTiers.length} tier entries, ${wikiCampaign.length} campaign unlocks.`);

  const { assignments, matched } = merge(sheetAssignments, wikiTiers, wikiCampaign);

  console.log('Resolving assignment badges...');
  const badges = await resolveBadges(assignments, parseImageMap(wikitext));
  console.log(`  ${badges.size}/${assignments.length} badges found on the wiki.`);
  if (WANT_BADGES) await downloadBadges(badges);

  // Only emit a path once the file is on disk, so a row without art falls back to a text tile
  // instead of a broken image.
  for (const assignment of assignments) {
    const file = `${assignment.id}.webp`;
    assignment.badgeUrl = existsSync(join(BADGE_DIR, file))
      ? `/battlefield4/assignments/${file}`
      : null;
  }

  assertSanity(assignments, matched, wikiTiers.length);

  const groups = GROUPS.map((group) => {
    const members = assignments.filter((a) => a.group === group.name);
    return {
      name: group.name,
      label: group.name.toUpperCase(),
      count: members.length,
      done: members.filter((a) => a.done).length,
    };
  });

  const done = assignments.filter((a) => a.done).length;
  console.log(
    `Assembled ${assignments.length} assignments, ${done} done ` +
      `(${groups.map((g) => `${g.name} ${g.done}/${g.count}`).join(', ')}).`,
  );

  const output = {
    fetchedAt: new Date().toISOString(),
    sources: [
      { kind: 'spreadsheet', path: WORKBOOK_REPO_PATH },
      { kind: 'wiki', page: WIKI_PAGE.replace(/_/g, ' '), url: WIKI_URL, license: 'CC BY-SA 3.0' },
    ],
    summary: { total: assignments.length, done },
    groups,
    assignments,
  };

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(`Failed: ${err.message}`);
  process.exit(1);
});
