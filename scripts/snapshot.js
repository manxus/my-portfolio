/**
 * Provider-neutral snapshot writing, shared by every sync script.
 *
 * All of them end the same way: read whatever is already committed, compare it to what was just
 * fetched, and write a JSON file carrying a `fetchedAt` stamp. The only subtlety is that the stamp
 * must NOT move when nothing else did -- a fresh timestamp on every run makes the workflows'
 * `git diff --cached --quiet` check permanently false, which puts a commit (and a redeploy) in the
 * history on every scheduled run whether or not a single number changed.
 *
 * This lives apart from steam-stats.js because none of it is Steam-specific: it is file IO and a
 * JSON comparison. Keeping it there is what led fetch-cs2-data.js to grow a second copy and left
 * the non-Steam syncs (Battlefield 4, RuneScape) with none.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

/** Returns the committed snapshot, or null when there isn't a readable one yet. */
export function readExisting(outputPath) {
  if (!existsSync(outputPath)) return null;
  try {
    return JSON.parse(readFileSync(outputPath, 'utf8'));
  } catch {
    console.warn(`Warning: existing ${outputPath} is unreadable, starting fresh.`);
    return null;
  }
}

/**
 * Holds `fetchedAt` still when nothing else changed, so a scheduled sync that finds no movement
 * leaves the file byte-identical and the workflow has nothing to commit.
 *
 * An `existing` with no `fetchedAt` of its own counts as absent. Some callers read their previous
 * snapshot for other reasons and hand back `{}` rather than null when there is none; without this
 * the comparison would match on two nulls and stamp the output with `undefined`.
 */
export function withStableTimestamp(output, existing) {
  if (!existing || !existing.fetchedAt) return output;

  const sameData =
    JSON.stringify({ ...output, fetchedAt: null }) ===
    JSON.stringify({ ...existing, fetchedAt: null });

  return sameData ? { ...output, fetchedAt: existing.fetchedAt } : output;
}

/**
 * Writes the snapshot with a stable timestamp and reports whether anything actually moved.
 * Pass `existing` when the caller already read it; otherwise it is read here.
 */
export function writeSnapshot(outputPath, output, summaryLine, existing = undefined) {
  const previous = existing === undefined ? readExisting(outputPath) : existing;
  const final = withStableTimestamp(output, previous);

  writeFileSync(outputPath, `${JSON.stringify(final, null, 2)}\n`);
  if (summaryLine) console.log(summaryLine);
  if (previous?.fetchedAt && final.fetchedAt === previous.fetchedAt) {
    console.log('  Nothing moved since the last sync; the file is unchanged.');
  }
  return final;
}
