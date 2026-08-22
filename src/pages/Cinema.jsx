import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import cinemaData from '../data/cinema.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import CinemaTabs from '../components/CinemaTabs/CinemaTabs';
import SteamFilters from '../components/SteamFilters/SteamFilters';
import { useAdminStore } from '../stores/adminStore';
import {
  countWatched,
  formatEpisodeCode,
  nextEpisode,
  totalEpisodes as sumSeasons,
} from '../utils/episodes';
import { groupByCollection } from '../utils/collections';
import styles from './Cinema.module.css';

const defaultEntries = cinemaData.entries || [];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

/** SHOWS reads as a progress list: in flight first, finished next, abandoned last. */
const SHOW_GROUPS = [
  { id: 'watching', label: 'WATCHING' },
  { id: 'watched', label: 'WATCHED' },
  { id: 'dropped', label: 'DROPPED' },
];

const SORT_OPTIONS = [
  { key: 'title', label: 'Title A–Z' },
  { key: 'rating', label: 'Rating (Highest)' },
  { key: 'year', label: 'Year (Newest)' },
  { key: 'episodes', label: 'Episodes (Most)', showsOnly: true },
  { key: 'collection', label: 'Collection', moviesOnly: true },
];

const DEFAULT_SORT = 'title';

/** Offer only the sorts that mean something for what the grid actually holds. */
function sortOptionsFor(tab, watchlistType) {
  const showsPossible =
    tab !== 'movies' && !(tab === 'watchlist' && watchlistType === 'movies');
  const moviesPossible =
    tab !== 'shows' && !(tab === 'watchlist' && watchlistType === 'shows');
  return SORT_OPTIONS.filter(
    (o) => (showsPossible || !o.showsOnly) && (moviesPossible || !o.moviesOnly),
  );
}

function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function resolveExternalUrl(url) {
  const href = typeof url === 'string' ? url.trim() : '';
  if (!href) return '';
  if (href.startsWith('/')) return href;
  return /^https?:\/\//i.test(href) ? href : `https://${href}`;
}

function openExternalUrl(url) {
  const resolved = resolveExternalUrl(url);
  if (!resolved) return;
  if (resolved.startsWith('/')) {
    window.location.assign(resolved);
    return;
  }
  window.open(resolved, '_blank', 'noopener,noreferrer');
}

function isShow(entry) {
  return entry.mediaType === 'tv';
}

function isQueued(entry) {
  return entry.status === 'watchlist';
}

/**
 * Tab membership. Movies and shows cover everything already started — watched,
 * watching, dropped — and leave the not-yet-started pile to WATCHLIST, so no
 * entry shows up under two tabs. Watch status drives the SHOWS sections.
 */
const TAB_FILTERS = {
  favorites: (e) => Boolean(e.featured),
  movies: (e) => !isShow(e) && !isQueued(e),
  shows: (e) => isShow(e) && !isQueued(e),
  watchlist: isQueued,
};

/** Media-type filter offered on the WATCHLIST tab. */
const WATCHLIST_TYPES = [
  { id: 'all', label: 'ALL', match: () => true },
  { id: 'movies', label: 'MOVIES', match: (e) => !isShow(e) },
  { id: 'shows', label: 'SHOWS', match: isShow },
];

const DEFAULT_WATCHLIST_TYPE = 'all';

function matchesSearch(entry, query) {
  return !query || String(entry.title).toLowerCase().includes(query);
}

/**
 * SHOWS splits into status sections; every other tab stays one unlabelled grid.
 * Empty sections are dropped, and anything with an unrecognised status still
 * gets a home rather than vanishing from the tab.
 */
function groupForTab(tab, list, sortBy) {
  // The collection sort carries its own sectioning, on any tab that holds movies.
  if (sortBy === 'collection') return groupByCollection(list);
  if (tab !== 'shows') return [{ id: 'all', label: '', items: list }];

  const known = new Set(SHOW_GROUPS.map((g) => g.id));
  const groups = SHOW_GROUPS.map((g) => ({
    ...g,
    items: list.filter((e) => e.status === g.id),
  }));

  const rest = list.filter((e) => !known.has(e.status));
  if (rest.length > 0) groups.push({ id: 'unsorted', label: 'NO STATUS', items: rest });

  return groups.filter((g) => g.items.length > 0);
}

/**
 * Episodes actually seen. The per-episode record wins where it exists; otherwise
 * fall back to the stored total, which still covers shows that were never synced.
 */
function episodesSeen(entry) {
  if (!isShow(entry)) return 0;
  if (entry.watchedEpisodes) return countWatched(entry.watchedEpisodes);
  const seen = toCount(entry.episodesSeen);
  if (seen > 0) return seen;
  return entry.status === 'watched' ? toCount(entry.episodes) : 0;
}

/** The episode to resume on, for shows tracked episode by episode. */
function resumePoint(entry) {
  if (!isShow(entry) || !entry.watchedEpisodes) return null;
  return nextEpisode(entry.seasonEpisodes, entry.watchedEpisodes);
}

/** Episode progress for a show that has been started, or null when it doesn't apply. */
function watchProgress(entry) {
  // Prefer the per-season sum: it is the total the episode record can address.
  const total = sumSeasons(entry.seasonEpisodes) || toCount(entry.episodes);
  const seen = episodesSeen(entry);
  if (total <= 0 || seen <= 0) return null;
  return { seen, total, percent: Math.min(100, Math.round((seen / total) * 100)) };
}

function sortEntries(list, sortBy) {
  const sorted = [...list];
  switch (sortBy) {
    case 'rating':
      return sorted.sort((a, b) => toCount(b.rating) - toCount(a.rating));
    case 'year':
      return sorted.sort((a, b) => toCount(b.year) - toCount(a.year));
    case 'episodes':
      return sorted.sort((a, b) => toCount(b.episodes) - toCount(a.episodes));
    case 'collection':
      // Within a franchise, oldest first — the order you'd watch them in.
      return sorted.sort(
        (a, b) =>
          toCount(a.year) - toCount(b.year) || String(a.title).localeCompare(String(b.title)),
      );
    case 'title':
    default:
      return sorted.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  }
}

function metaLine(entry) {
  const parts = [];
  if (entry.year) parts.push(entry.year);
  if (isShow(entry)) {
    const seasons = toCount(entry.seasons);
    const eps = toCount(entry.episodes);
    if (seasons) parts.push(`${seasons} season${seasons === 1 ? '' : 's'}`);
    if (eps) parts.push(`${eps} ep${eps === 1 ? '' : 's'}`);
  } else if (toCount(entry.runtime)) {
    parts.push(`${toCount(entry.runtime)} min`);
  }
  return parts.join(' · ');
}

function EntryCover({ entry, dimmed }) {
  const url = typeof entry.coverUrl === 'string' ? entry.coverUrl.trim() : '';
  if (!url) {
    return (
      <div className={`${styles.coverPlaceholder}${dimmed ? ` ${styles.coverDimmed}` : ''}`}>
        <span className={styles.placeholderText}>{entry.title}</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={entry.title}
      className={`${styles.coverImage}${dimmed ? ` ${styles.coverDimmed}` : ''}`}
      loading="lazy"
    />
  );
}

function EntryCard({ entry, index, selected, style, onSelect }) {
  // Only the in-flight shows carry a bar; a finished or queued one has nothing
  // to report that the section heading doesn't already say.
  const progress = entry.status === 'watching' ? watchProgress(entry) : null;
  const resume = progress ? resumePoint(entry) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      style={style}
      className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <EntryCover entry={entry} dimmed={entry.status === 'dropped'} />

      {entry.featured && (
        <span className={styles.favorite} title="Favorite">
          &#9733;
        </span>
      )}
      {toCount(entry.rating) > 0 && (
        <span className={styles.ratingChip}>{toCount(entry.rating)}</span>
      )}

      <div className={styles.cardCaption}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardTitle} title={entry.title}>
            {entry.title}
          </span>
          {index >= 0 && <EditableItemControls index={index} itemId={entry.id} hideMove />}
        </div>
        <span className={styles.cardMeta}>{metaLine(entry)}</span>

        {progress && (
          <div
            className={styles.cardProgress}
            title={`${progress.seen} of ${progress.total} episodes watched${
              resume ? ` — resume at ${formatEpisodeCode(resume)}` : ''
            }`}
          >
            <div className={styles.cardProgressBar}>
              <div
                className={styles.cardProgressFill}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className={styles.cardProgressLabel}>
              {resume ? `NEXT ${formatEpisodeCode(resume)}` : `${progress.seen}/${progress.total}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function EntryDetail({ entry, onClose, style }) {
  const hasLink = Boolean(resolveExternalUrl(entry.tmdbUrl));
  const total = toCount(entry.episodes);
  const progress = watchProgress(entry);
  const resume = resumePoint(entry);

  return (
    <motion.div
      className={styles.detail}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      style={{ overflow: 'hidden', ...style }}
    >
      <div className={styles.detailInner}>
        <div className={styles.detailCover}>
          <EntryCover entry={entry} dimmed={false} />
        </div>

        <div className={styles.detailBody}>
          <div className={styles.detailTopRow}>
            <h3 className={styles.detailTitle}>
              {entry.title}
              {entry.year && <span className={styles.detailYear}> ({entry.year})</span>}
            </h3>
            <button className={styles.closeBtn} onClick={onClose} title="Close">
              &#10005;
            </button>
          </div>

          <div className={styles.detailMetrics}>
            <span className={styles.metric}>
              <span className={styles.metricValue}>{isShow(entry) ? 'SHOW' : 'MOVIE'}</span>
              <span className={styles.metricLabel}>TYPE</span>
            </span>
            {toCount(entry.rating) > 0 && (
              <span className={styles.metric}>
                <span className={styles.metricValue}>{toCount(entry.rating)}/10</span>
                <span className={styles.metricLabel}>RATING</span>
              </span>
            )}
            {isShow(entry) && toCount(entry.seasons) > 0 && (
              <span className={styles.metric}>
                <span className={styles.metricValue}>{toCount(entry.seasons)}</span>
                <span className={styles.metricLabel}>SEASONS</span>
              </span>
            )}
            {isShow(entry) && total > 0 && (
              <span className={styles.metric}>
                <span className={styles.metricValue}>{total}</span>
                <span className={styles.metricLabel}>EPISODES</span>
              </span>
            )}
            {toCount(entry.runtime) > 0 && (
              <span className={styles.metric}>
                <span className={styles.metricValue}>{toCount(entry.runtime)} min</span>
                <span className={styles.metricLabel}>{isShow(entry) ? 'PER EP' : 'RUNTIME'}</span>
              </span>
            )}
          </div>

          {progress && progress.seen < progress.total && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className={styles.progressLabel}>
                {progress.seen} / {progress.total} episodes ({progress.percent}%)
                {resume && (
                  <span className={styles.resumeAt}>
                    {' '}
                    · next up {formatEpisodeCode(resume)}
                  </span>
                )}
              </span>
            </div>
          )}

          {Array.isArray(entry.genres) && entry.genres.length > 0 && (
            <div className={styles.genres}>
              {entry.genres.map((genre) => (
                <span key={genre} className={styles.genre}>
                  {genre}
                </span>
              ))}
            </div>
          )}

          {entry.overview && <p className={styles.synopsis}>{entry.overview}</p>}

          {hasLink && (
            <button
              type="button"
              className={styles.tmdbLink}
              onClick={() => openExternalUrl(entry.tmdbUrl)}
            >
              VIEW ON TMDB &rarr;
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Column count of a grid, read from the resolved track list rather than derived
 * from card width vs container width. The computed value of grid-template-columns
 * is the *used* value — literal pixel tracks — so counting them is exact, where
 * the arithmetic version rounded badly and went stale on resize, dropping the
 * detail panel mid-row and leaving the rest of the row empty.
 */
function useGridColumns() {
  const ref = useRef(null);
  const [cols, setCols] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => {
      const tracks = getComputedStyle(el).gridTemplateColumns;
      if (!tracks || tracks === 'none') return;
      const count = tracks.split(/\s+/).filter(Boolean).length;
      if (count > 0) setCols(count);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, cols];
}

/**
 * One section's grid. The detail panel is inserted with a CSS `order` that puts
 * it at the end of the selected card's row, so it only renders in the grid that
 * actually holds the selection. Each grid measures its own columns — sections
 * are separate grids and must not share one count.
 */
function EntryGrid({ items, selectedId, adminIndexOf, onSelect, onCloseDetail }) {
  const [gridRef, cols] = useGridColumns();
  const selectedIndex = items.findIndex((e) => e.id === selectedId);
  const selectedEntry = selectedIndex >= 0 ? items[selectedIndex] : null;
  const detailOrder =
    selectedIndex < 0
      ? -1
      : Math.min((Math.floor(selectedIndex / cols) + 1) * cols, items.length) * 2 - 1;

  return (
    <div className={styles.grid} ref={gridRef}>
      {items.map((entry, i) => (
        <EntryCard
          key={entry.id}
          entry={entry}
          index={adminIndexOf(entry)}
          selected={selectedId === entry.id}
          style={{ order: i * 2 }}
          onSelect={() => onSelect(entry.id)}
        />
      ))}

      <AnimatePresence>
        {selectedEntry && (
          <EntryDetail
            key={selectedEntry.id}
            entry={selectedEntry}
            onClose={onCloseDetail}
            style={{ order: detailOrder }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatTile({ value, label }) {
  return (
    <div className={styles.statTile}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function Overview({ entries, selectedId, adminIndexOf, onSelect, onCloseDetail }) {
  const movies = entries.filter((e) => !isShow(e));
  const shows = entries.filter(isShow);
  const watched = entries.filter((e) => e.status === 'watched');
  const dropped = entries.filter((e) => e.status === 'dropped');
  const totalEpisodes = shows.reduce((sum, e) => sum + episodesSeen(e), 0);

  const rated = entries.filter((e) => toCount(e.rating) > 0);
  const avgRating =
    rated.length > 0
      ? (rated.reduce((sum, e) => sum + toCount(e.rating), 0) / rated.length).toFixed(1)
      : null;

  const topRated = [...rated].sort((a, b) => toCount(b.rating) - toCount(a.rating)).slice(0, 5);
  const favorites = sortEntries(entries.filter(TAB_FILTERS.favorites), 'title');

  return (
    <div className={styles.overview}>
      <section className={styles.overviewSection}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> RECORD
        </h2>
        <div className={styles.statGrid}>
          <StatTile value={entries.length} label="TITLES" />
          <StatTile value={movies.length} label="MOVIES" />
          <StatTile value={shows.length} label="SHOWS" />
          <StatTile value={totalEpisodes} label="EPISODES SEEN" />
          <StatTile value={watched.length} label="COMPLETED" />
          {/* A zero and a dash read as broken tiles rather than facts. */}
          {dropped.length > 0 && <StatTile value={dropped.length} label="DROPPED" />}
          {avgRating && <StatTile value={avgRating} label="AVG RATING" />}
        </div>
      </section>

      {favorites.length > 0 && (
        <section className={styles.overviewSection}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>&gt;</span> FAVORITES
            <span className={styles.groupCount}>{favorites.length}</span>
          </h2>
          <EntryGrid
            items={favorites}
            selectedId={selectedId}
            adminIndexOf={adminIndexOf}
            onSelect={onSelect}
            onCloseDetail={onCloseDetail}
          />
        </section>
      )}

      {topRated.length > 0 && (
        <section className={styles.overviewSection}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>&gt;</span> HIGHEST RATED
          </h2>
          <ul className={styles.topList}>
            {topRated.map((entry) => (
              <li key={entry.id} className={styles.topRow}>
                <span className={styles.topTitle}>{entry.title}</span>
                <span className={styles.topMeta}>{metaLine(entry)}</span>
                <span className={styles.topRating}>{toCount(entry.rating)}/10</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Cinema() {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const getData = useAdminStore((s) => s.getData);
  const isAdminUi = import.meta.env.DEV && isAuthenticated;

  const [adminEntries, setAdminEntries] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('title');
  const [watchlistType, setWatchlistType] = useState(DEFAULT_WATCHLIST_TYPE);

  const entries = isAdminUi && adminEntries ? adminEntries : defaultEntries;

  const refreshAdminEntries = useCallback(async () => {
    try {
      const data = await getData('cinema');
      setAdminEntries(data.entries || []);
    } catch (err) {
      console.error('Failed to load cinema entries:', err);
    }
  }, [getData]);

  useEffect(() => {
    // No clear on logout needed — `entries` falls back to the bundled file
    // whenever isAdminUi is false.
    if (!isAdminUi) return;
    refreshAdminEntries();
  }, [isAdminUi, refreshAdminEntries]);

  useEffect(() => {
    if (!isAdminUi) return undefined;
    const onSaved = (e) => {
      if (e.detail?.collection !== 'cinema') return;
      refreshAdminEntries();
    };
    window.addEventListener('admin-collection-saved', onSaved);
    return () => window.removeEventListener('admin-collection-saved', onSaved);
  }, [isAdminUi, refreshAdminEntries]);

  const tabs = useMemo(
    () => [
      { id: 'overview', label: 'OVERVIEW' },
      { id: 'movies', label: 'MOVIES', count: entries.filter(TAB_FILTERS.movies).length },
      { id: 'shows', label: 'SHOWS', count: entries.filter(TAB_FILTERS.shows).length },
      { id: 'watchlist', label: 'WATCHLIST', count: entries.filter(TAB_FILTERS.watchlist).length },
    ],
    [entries],
  );

  /** Watchlist entries matching the search box, before the type filter. */
  const watchlistSearched = useMemo(() => {
    if (activeTab !== 'watchlist') return [];
    const q = search.trim().toLowerCase();
    return entries.filter((e) => TAB_FILTERS.watchlist(e) && matchesSearch(e, q));
  }, [entries, activeTab, search]);

  const watchlistCounts = useMemo(
    () =>
      Object.fromEntries(
        WATCHLIST_TYPES.map((t) => [t.id, watchlistSearched.filter(t.match).length]),
      ),
    [watchlistSearched],
  );

  const visibleEntries = useMemo(() => {
    const belongsToTab = TAB_FILTERS[activeTab];
    if (!belongsToTab) return [];

    const q = search.trim().toLowerCase();
    let filtered = entries.filter((e) => belongsToTab(e) && matchesSearch(e, q));

    if (activeTab === 'watchlist') {
      const type = WATCHLIST_TYPES.find((t) => t.id === watchlistType);
      if (type) filtered = filtered.filter(type.match);
    }

    return sortEntries(filtered, sortBy);
  }, [entries, activeTab, search, sortBy, watchlistType]);

  const groups = useMemo(
    () => groupForTab(activeTab, visibleEntries, sortBy),
    [activeTab, visibleEntries, sortBy],
  );

  // Franchise sections are mostly two or three films; stacking them full-width
  // wastes most of every row, so they flow side by side instead.
  const packedGroups = sortBy === 'collection';

  const adminIndexOf = useCallback(
    (entry) => entries.findIndex((e) => e.id === entry.id),
    [entries],
  );

  const toggleSelected = useCallback((id) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const clearSelected = useCallback(() => setSelectedId(null), []);

  const sortOptions = useMemo(
    () => sortOptionsFor(activeTab, watchlistType),
    [activeTab, watchlistType],
  );

  // Leaving SHOWS sorted by episodes would strand the dropdown on an option the
  // new view no longer offers.
  const keepSortValid = (tab, type) => {
    setSortBy((prev) =>
      sortOptionsFor(tab, type).some((o) => o.key === prev) ? prev : DEFAULT_SORT,
    );
  };

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setSelectedId(null);
    setSearch('');
    setWatchlistType(DEFAULT_WATCHLIST_TYPE);
    keepSortValid(tab, DEFAULT_WATCHLIST_TYPE);
  }, []);

  const handleWatchlistTypeChange = useCallback((type) => {
    setWatchlistType(type);
    setSelectedId(null);
    keepSortValid('watchlist', type);
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    setSelectedId(null);
  }, []);

  const handleSortChange = useCallback((key) => {
    setSortBy(key);
    setSelectedId(null);
  }, []);

  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <EditableSection collection="cinema" dataKey="entries">
        <CinemaTabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

        {entries.length === 0 ? (
          <p className={styles.empty}>No movies or shows logged yet.</p>
        ) : activeTab === 'overview' ? (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Overview
              entries={entries}
              selectedId={selectedId}
              adminIndexOf={adminIndexOf}
              onSelect={toggleSelected}
              onCloseDetail={clearSelected}
            />
          </motion.div>
        ) : (
          <motion.div
            key={activeTab}
            className={styles.listSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className={styles.filterBar}>
              {activeTab === 'watchlist' && (
                <div className={styles.typeFilter} role="group" aria-label="Filter by type">
                  {WATCHLIST_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      className={`${styles.typeBtn} ${
                        watchlistType === type.id ? styles.typeBtnActive : ''
                      }`}
                      aria-pressed={watchlistType === type.id}
                      onClick={() => handleWatchlistTypeChange(type.id)}
                    >
                      {type.label}
                      <span className={styles.typeCount}>{watchlistCounts[type.id]}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.filterMain}>
                <SteamFilters
                  search={search}
                  onSearchChange={handleSearchChange}
                  sortBy={sortBy}
                  onSortChange={handleSortChange}
                  sortOptions={sortOptions}
                  placeholder="Search titles..."
                />
              </div>
            </div>

            <div className={packedGroups ? styles.groupsPacked : undefined}>
              {groups.map((group) => (
                <div
                  key={group.id}
                  className={styles.group}
                  // --span drives the section's width in the packed layout.
                  style={packedGroups ? { '--span': group.items.length } : undefined}
                >
                  {group.label && (
                    <h2 className={styles.sectionTitle}>
                      <span className={styles.sectionIcon}>&gt;</span> {group.label}
                      <span className={styles.groupCount}>{group.items.length}</span>
                    </h2>
                  )}
                  <EntryGrid
                    items={group.items}
                    selectedId={selectedId}
                    adminIndexOf={adminIndexOf}
                    onSelect={toggleSelected}
                    onCloseDetail={clearSelected}
                  />
                </div>
              ))}
            </div>

            {visibleEntries.length === 0 && (
              <p className={styles.noResults}>
                {search.trim() ? 'No titles match your search.' : 'Nothing here yet.'}
              </p>
            )}
          </motion.div>
        )}

        <p className={styles.attribution}>
          Metadata and posters from TMDB. This product uses the TMDB API but is not endorsed or
          certified by TMDB.
        </p>
      </EditableSection>
    </motion.div>
  );
}
