/**
 * One-off migration: reconstruct the achievement-change feed from git history.
 *
 * steam-library.json has been committed nightly since 2026-03-25, so every
 * schema change the nightly sync would have caught from here on has already
 * happened in the repo -- it was simply never recorded. Walking those commits
 * forward through the same diff the nightly path uses ships the feed populated
 * instead of empty for the first few weeks.
 *
 * Usage:
 *   node scripts/backfill-steam-changes.js          # last 90 days (retention window)
 *   node scripts/backfill-steam-changes.js --all    # every commit, back to the first
 *   node scripts/backfill-steam-changes.js --dry    # report only, write nothing
 *
 * Outputs:
 *   src/data/steam-changes.json
 *   src/data/steam-achievement-baselines.json
 *
 * The default window matches RETENTION_DAYS on purpose: each commit means
 * parsing a 22MB blob, and anything older than the window would be pruned by
 * mergeEvents the moment it was written. --all is there for a one-time look at
 * the full range.
 *
 * The earliest commit is a hand-made six-game seed. It needs no special case --
 * the four thousand games that appear in the next commit have no baseline yet,
 * and diffTotals skips anything it has not seen before.
 */

import { execSync } from 'child_process';
import {
  RETENTION_DAYS,
  cutoffDate,
  diffTotals,
  extractTotals,
  formatEvent,
  mergeEvents,
  updateBaselines,
  writeBaselines,
  writeChanges,
} from './steam-changes.js';

const LIBRARY_FILE = 'src/data/steam-library.json';
// The library blob is ~22MB, well past execSync's 1MB default.
const MAX_BUFFER = 200 * 1024 * 1024;

const DRY = process.argv.includes('--dry');
const ALL = process.argv.includes('--all');

function git(command) {
  return execSync(command, { maxBuffer: MAX_BUFFER, encoding: 'utf-8' });
}

/** Every commit that touched the library file, oldest first. */
function libraryCommits() {
  const log = git(
    `git log --reverse --format="%H %ad" --date=short -- ${LIBRARY_FILE}`,
  ).trim();
  if (!log) return [];
  return log.split('\n').map((line) => {
    const [sha, date] = line.trim().split(' ');
    return { sha, date };
  });
}

function main() {
  const commits = libraryCommits();
  if (commits.length === 0) {
    console.error(`No commits found for ${LIBRARY_FILE}.`);
    process.exit(1);
  }

  // Baselines have to exist before the window opens, or its first commit would
  // have nothing to diff against and would report the whole library as new. That
  // needs exactly one commit of run-up, not the whole history -- each one costs a
  // 22MB parse.
  const cutoff = ALL ? null : cutoffDate(RETENTION_DAYS);
  const firstInWindow = cutoff ? commits.findIndex((c) => c.date >= cutoff) : 0;
  const walk = cutoff
    ? commits.slice(firstInWindow < 0 ? commits.length - 1 : Math.max(0, firstInWindow - 1))
    : commits;
  const reported = walk.filter((c) => !cutoff || c.date >= cutoff);
  console.log(
    `${commits.length} commit(s) of ${LIBRARY_FILE}; reading ${walk.length}, ` +
      `reporting changes from ${reported[0]?.date ?? 'n/a'} onward.`,
  );

  let baselines = {};
  const events = [];
  let skipped = 0;

  walk.forEach((commit, i) => {
    let library;
    try {
      library = JSON.parse(git(`git show ${commit.sha}:${LIBRARY_FILE}`));
    } catch (err) {
      // A blob that will not parse is a bad commit, not a reason to abandon the
      // walk -- skipping it just means its baselines carry over to the next one.
      skipped += 1;
      console.error(`  ${commit.date} ${commit.sha.slice(0, 7)} SKIPPED — ${err.message}`);
      return;
    }

    const totals = extractTotals(library);
    if (!cutoff || commit.date >= cutoff) {
      events.push(...diffTotals(baselines, totals, commit.date));
    }
    baselines = updateBaselines(baselines, totals);

    if ((i + 1) % 25 === 0) console.log(`  ...${i + 1}/${walk.length} commits`);
  });

  // Rebuild rather than append: git is the authority for every sync in the
  // window, so recomputing replaces whatever is on disk. That is what lets a
  // change to the rules in diffTotals take effect on the existing feed instead
  // of leaving events that the current rules would never have emitted.
  const merged = mergeEvents([], events);
  if (events.length === 0) {
    console.log('Nothing moved — no game gained achievements in the window.');
  } else {
    console.log(`\n${events.length} change(s) across ${reported.length} sync(s):`);
    events.forEach((e) => console.log(`  ${formatEvent(e)}`));
    console.log(`\n${merged.length} event(s) after merge, retention and cap.`);
  }
  if (skipped > 0) console.log(`${skipped} commit(s) could not be read and were skipped.`);

  if (DRY) {
    console.log('\n--dry: nothing written.');
    return;
  }

  writeChanges(merged);
  // The final commit's totals are the baseline the next nightly run diffs from.
  writeBaselines(baselines);
  console.log('\nWrote src/data/steam-changes.json and src/data/steam-achievement-baselines.json');
}

main();
