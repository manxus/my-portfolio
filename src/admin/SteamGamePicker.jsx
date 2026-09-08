import { useMemo, useRef, useState } from 'react';
import steamLibrary from '../data/steam-library.json';
import SteamGameCover from '../components/SteamGameCover/SteamGameCover';
import styles from './SteamGamePicker.module.css';

/**
 * Search-and-click game selection for the admin editors.
 *
 * Every Steam-flavoured collection (series, tier lists, the Hall of Pain,
 * reviews) is keyed by appId, and typing those by hand means looking each one
 * up on the store first. The library JSON is already in the bundle for the
 * Steam page, so the names are right here -- search them instead.
 *
 * Raw ids still matter for the odd game that is not in the library (a delisted
 * title, something owned on another account), so the text field stays as an
 * escape hatch rather than being replaced outright.
 */

/** Enough to scroll through a big franchise; the list scrolls past that. */
const MAX_RESULTS = 50;

/**
 * Steam titles are full of trademark symbols and punctuation, and they land in
 * the middle of names: every LEGO game is "LEGO® ...", so a raw substring
 * search for "lego city" matches nothing at all. Strip them from both the index
 * and the query so typing what you see finds the game.
 */
function normalize(value) {
  return String(value)
    .replace(/[™®©Ⓡ]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const games = (steamLibrary.games || [])
  .map((g) => ({
    appId: g.appId,
    name: g.name,
    headerUrl: g.headerUrl,
    libraryCapsuleUrl: g.libraryCapsuleUrl,
    libraryHeaderUrl: g.libraryHeaderUrl,
    iconUrl: g.iconUrl,
    playtimeHours: g.playtimeHours || 0,
    hasAchievements: Boolean(g.achievements?.total),
    search: normalize(g.name),
  }))
  .sort((a, b) => b.playtimeHours - a.playtimeHours);

const byAppId = new Map(games.map((g) => [g.appId, g]));

/**
 * Every match, unsliced -- the caller decides how many to show, and needs the
 * true total to say how many are hidden.
 */
function search(query, achievementsOnly) {
  const q = normalize(query);
  if (!q) return [];
  // Numeric input is almost always someone pasting an appId.
  if (/^\d+$/.test(q)) {
    const hit = byAppId.get(Number(q));
    if (!hit) return [];
    return achievementsOnly && !hit.hasAchievements ? [] : [hit];
  }
  const starts = [];
  const contains = [];
  // The whole library is only a few thousand entries, so scanning all of it per
  // keystroke is cheaper than the bug an early exit caused: capping the scan
  // also capped the matches, hiding 19 of 27 LEGO games.
  for (const g of games) {
    if (achievementsOnly && !g.hasAchievements) continue;
    const at = g.search.indexOf(q);
    if (at === 0) starts.push(g);
    else if (at > 0) contains.push(g);
  }
  // Most-played first within each band, which `games` is already sorted by.
  return [...starts, ...contains];
}

function Row({ game, onClick, action, lead, onMoveUp, onMoveDown }) {
  return (
    <div className={`${styles.row} ${lead ? styles.rowLead : ''}`}>
      {onMoveUp && (
        <span className={styles.reorder}>
          <button
            type="button"
            className={styles.moveBtn}
            onClick={onMoveUp}
            title="Move earlier"
            aria-label={`Move ${game.name} earlier`}
          >
            &#9650;
          </button>
          <button
            type="button"
            className={styles.moveBtn}
            onClick={onMoveDown}
            title="Move later"
            aria-label={`Move ${game.name} later`}
          >
            &#9660;
          </button>
        </span>
      )}
      <button
        type="button"
        className={styles.rowMain}
        onClick={onClick}
        title={game.name}
      >
        <span className={styles.thumb}>
        <SteamGameCover
          fill
          variant="banner"
          appId={game.appId}
          title={game.name}
          headerUrl={game.headerUrl}
          libraryHeaderUrl={game.libraryHeaderUrl}
          iconUrl={game.iconUrl}
          alt=""
          rootClassName={styles.thumbRoot}
          imageClassName={styles.thumbImg}
        />
        </span>
        <span className={styles.rowName}>{game.name}</span>
        {lead && <span className={styles.leadTag}>FRONT</span>}
        <span className={styles.rowId}>{game.appId}</span>
        <span className={styles.rowAction}>{action}</span>
      </button>
    </div>
  );
}

/**
 * @param {number[]|number|null} value  appIds (array) or a single appId
 * @param {(next: number[]|number|null) => void} onChange
 * @param {boolean} single  pick exactly one game instead of a list
 * @param {boolean} achievementsOnly  hide games Steam tracks no achievements
 *   for. Opt-in, because only the collections showcase is about achievements --
 *   tier lists, the Hall of Pain and reviews all cover games regardless.
 */
export default function SteamGamePicker({
  value,
  onChange,
  single = false,
  achievementsOnly = false,
}) {
  const [query, setQuery] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const rawRef = useRef(null);

  const selected = useMemo(() => {
    if (single) return value == null || value === '' ? [] : [Number(value)];
    return Array.isArray(value) ? value : [];
  }, [value, single]);

  const matches = useMemo(() => {
    const chosen = new Set(selected);
    return search(query, achievementsOnly).filter((g) => !chosen.has(g.appId));
  }, [query, selected, achievementsOnly]);

  const results = matches.slice(0, MAX_RESULTS);

  const commit = (ids) => {
    if (single) onChange(ids.length ? ids[ids.length - 1] : null);
    else onChange(ids);
  };

  const add = (appId) => {
    if (single) {
      commit([appId]);
    } else if (!selected.includes(appId)) {
      commit([...selected, appId]);
    }
    setQuery('');
  };

  const remove = (appId) => commit(selected.filter((id) => id !== appId));

  /** A franchise can run to dozens of titles; adding them one click at a time
      is the slow part, not finding them. */
  const addAll = () => {
    const have = new Set(selected);
    commit([...selected, ...matches.map((g) => g.appId).filter((id) => !have.has(id))]);
    setQuery('');
  };

  /** Order matters downstream: the first game is the one a collection card
      shows front and centre, so it has to be rearrangeable here. */
  const move = (from, to) => {
    if (to < 0 || to >= selected.length) return;
    const next = [...selected];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  };

  return (
    <div className={styles.picker}>
      <input
        type="text"
        className={styles.search}
        value={query}
        placeholder={
          achievementsOnly
            ? 'Search games with achievements…'
            : single
              ? 'Search your library…'
              : 'Search your library to add a game…'
        }
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // Enter takes the top hit, so a quick add never needs the mouse.
          if (e.key === 'Enter') {
            e.preventDefault();
            if (results[0]) add(results[0].appId);
          }
        }}
      />

      {query.trim() && (
        <>
          {matches.length > 0 && (
            <div className={styles.resultsBar}>
              <span className={styles.resultsCount}>
                {matches.length} {matches.length === 1 ? 'match' : 'matches'}
                {matches.length > MAX_RESULTS && ` · showing first ${MAX_RESULTS}`}
              </span>
              {!single && (
                <button type="button" className={styles.addAll} onClick={addAll}>
                  + Add all {matches.length}
                </button>
              )}
            </div>
          )}
          <div className={styles.results}>
            {results.length === 0 ? (
              <p className={styles.noResults}>Nothing in your library matches that.</p>
            ) : (
              results.map((g) => (
                <Row key={g.appId} game={g} onClick={() => add(g.appId)} action="+" />
              ))
            )}
          </div>
        </>
      )}

      {selected.length > 0 && (
        <div className={styles.selected}>
          {selected.map((appId, i) => {
            const g = byAppId.get(Number(appId));
            return g ? (
              <Row
                key={appId}
                game={g}
                onClick={() => remove(appId)}
                action="&times;"
                lead={!single && i === 0}
                onMoveUp={single ? undefined : () => move(i, i - 1)}
                onMoveDown={single ? undefined : () => move(i, i + 1)}
              />
            ) : (
              <button
                key={appId}
                type="button"
                className={`${styles.row} ${styles.rowUnknown}`}
                onClick={() => remove(appId)}
                title="Not in your library — kept as-is"
              >
                <span className={styles.rowName}>Not in your library</span>
                <span className={styles.rowId}>{appId}</span>
                <span className={styles.rowAction}>&times;</span>
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className={styles.rawToggle}
        onClick={() => setShowRaw((v) => !v)}
      >
        {showRaw ? 'Hide app IDs' : 'Edit app IDs directly'}
      </button>

      {showRaw && (
        <input
          ref={rawRef}
          type="text"
          className={styles.raw}
          defaultValue={selected.join(', ')}
          placeholder="App IDs (comma separated)"
          onBlur={(e) => {
            const ids = e.target.value
              .split(/[,\s]+/)
              .map((t) => Number(t.trim()))
              .filter((n) => Number.isFinite(n) && n > 0);
            commit(ids);
          }}
        />
      )}
    </div>
  );
}
