import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAdminStore } from '../../stores/adminStore';
import { notifyAdminCollectionSaved } from '../../admin/adminEvents';
import { nextNumericId } from '../../admin/autoId';
import {
  fetchCuratedList,
  fetchDiscover,
  fetchFranchiseParts,
  fetchRecommendations,
  fetchTitleDetails,
} from '../../utils/tmdb';
import {
  buildTasteProfile,
  classicsWindow,
  filterCandidates,
  knownTmdbIds,
} from '../../utils/recommendations';
import { partialFranchises } from '../../utils/collections';
import styles from './CinemaRecommendations.module.css';

const DISMISSED_COLLECTION = 'cinema-dismissed';

/** Bump when the shape of a cached payload changes, to invalidate old ones. */
const CACHE_KEY = 'bv-cinema-recs-v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Fifteen seeds returning twenty each makes "because you liked" hundreds of
 * cards long, which is unreadable. The lists are interleaved before slicing, so
 * a cap still draws from across every seed rather than exhausting the first.
 */
const MAX_PER_SECTION = 24;

// Order is priority: the shared `seen` Set lets the first section to claim a
// title keep it, and a gap in a franchise you already watch beats a generic pick.
const SECTIONS = [
  {
    id: 'franchise',
    label: 'COMPLETE THE COLLECTION',
    blurb: 'Missing from franchises you have already started',
  },
  { id: 'new', label: 'NEW RELEASES', blurb: 'In cinemas, airing, and on the way' },
  { id: 'similar', label: 'BECAUSE YOU LIKED…', blurb: 'Built from your favourites and watch history' },
  { id: 'classics', label: 'ACCLAIMED CLASSICS', blurb: 'Highly rated, released before 2010' },
  { id: 'genres', label: 'MORE IN YOUR GENRES', blurb: 'Your most-watched genres' },
];

/** Interleave several result lists so one source can't dominate a section. */
function interleave(lists) {
  const out = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i += 1) {
    for (const list of lists) {
      if (list[i]) out.push(list[i]);
    }
  }
  return out;
}

/** Settled results only — one dead source shouldn't blank the whole section. */
async function allSettledLists(promises) {
  const settled = await Promise.allSettled(promises);
  return settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
}

async function fetchSections(profile, franchises, signal) {
  const { genres, seeds } = profile;
  const classics = classicsWindow(2010);

  const [franchiseLists, newLists, similarLists, classicLists, genreLists] = await Promise.all([
    // Each franchise is its own request, so one that won't resolve costs only
    // itself. Tagging with the franchise name lets the card say where it came from.
    allSettledLists(
      franchises.map((franchise) =>
        fetchFranchiseParts(
          { seedTmdbId: franchise.seedTmdbId, keywordId: franchise.keywordId },
          signal,
        ).then((items) => items.map((item) => ({ ...item, via: franchise.name }))),
      ),
    ),

    allSettledLists([
      fetchCuratedList('now_playing', 'movie', signal),
      fetchCuratedList('upcoming', 'movie', signal),
      fetchCuratedList('on_the_air', 'tv', signal),
    ]),

    // Tag each result with the title that produced it, so the card can say why.
    allSettledLists(
      seeds.map((seed) =>
        fetchRecommendations(seed.tmdbId, seed.mediaType, signal).then((items) =>
          items.map((item) => ({ ...item, via: seed.title })),
        ),
      ),
    ),

    allSettledLists([
      fetchDiscover(
        { mediaType: 'movie', ...classics, minVotes: 1500, minRating: 7.5, sort: 'rating' },
        signal,
      ),
      fetchDiscover(
        { mediaType: 'tv', ...classics, minVotes: 300, minRating: 8, sort: 'rating' },
        signal,
      ),
    ]),

    genres.length === 0
      ? Promise.resolve([])
      : allSettledLists([
          fetchDiscover({ mediaType: 'movie', genres, minVotes: 500, sort: 'popularity' }, signal),
          fetchDiscover({ mediaType: 'tv', genres, minVotes: 200, sort: 'popularity' }, signal),
        ]),
  ]);

  return {
    franchise: interleave(franchiseLists),
    new: interleave(newLists),
    similar: interleave(similarLists),
    classics: interleave(classicLists),
    genres: interleave(genreLists),
  };
}

function readCache(signature) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.signature !== signature) return null;
    if (Date.now() - cached.ts > CACHE_TTL_MS) return null;
    return cached.sections;
  } catch {
    return null;
  }
}

function writeCache(signature, sections) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), signature, sections }));
  } catch {
    // A full or unavailable sessionStorage just means we refetch next time.
  }
}

/**
 * Build the cinema entry for a title being added to the watchlist.
 *
 * Key order deliberately mirrors the existing entries in cinema.json so an
 * addition reads as one clean block in the diff rather than a reshuffle.
 */
function toWatchlistEntry(details, id) {
  const isTv = details.mediaType === 'tv';
  const entry = {
    title: details.title,
    mediaType: details.mediaType,
    status: 'watchlist',
    rating: '',
    featured: false,
    year: details.year || '',
    seasons: isTv ? details.seasons ?? '' : '',
    episodes: isTv ? details.episodes ?? '' : '',
    episodesSeen: isTv ? 0 : '',
    runtime: details.runtime ?? null,
    genres: details.genres || [],
    overview: details.overview || '',
    coverUrl: details.coverUrl || '',
    tmdbUrl: details.tmdbUrl || '',
    tmdbId: details.tmdbId,
    backdropUrl: details.backdropUrl || '',
    id,
  };

  if (isTv && Array.isArray(details.seasonEpisodes) && details.seasonEpisodes.length > 0) {
    entry.seasonEpisodes = details.seasonEpisodes;
  }
  if (!isTv && details.collection) {
    entry.collection = details.collection;
  }
  return entry;
}

/**
 * Same 2:3 poster treatment as the Cinema grid's EntryCover, kept local rather
 * than imported: Cinema.jsx imports this panel, so reaching back into it would
 * make the two modules circular.
 */
function Poster({ title, url }) {
  if (!url) {
    return (
      <div className={styles.coverPlaceholder}>
        <span className={styles.placeholderText}>{title}</span>
      </div>
    );
  }
  return <img src={url} alt={title} className={styles.coverImage} loading="lazy" />;
}

function RecommendationCard({ item, busy, onAdd, onDismiss }) {
  const meta = [item.year, item.voteAverage ? `★ ${item.voteAverage.toFixed(1)}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={styles.card}>
      <div className={styles.coverWrap}>
        <Poster title={item.title} url={item.posterUrl} />
        <span className={styles.typeBadge}>{item.mediaType === 'tv' ? 'TV' : 'FILM'}</span>
      </div>

      <div className={styles.caption}>
        <span className={styles.title} title={item.title}>
          {item.title}
        </span>
        <span className={styles.meta}>{meta}</span>
        {item.via && <span className={styles.via}>via {item.via}</span>}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.addBtn}
          disabled={busy}
          onClick={() => onAdd(item)}
        >
          {busy ? 'ADDING…' : '+ WATCHLIST'}
        </button>
        <button
          type="button"
          className={styles.dismissBtn}
          disabled={busy}
          title="Not interested"
          aria-label={`Not interested in ${item.title}`}
          onClick={() => onDismiss(item)}
        >
          &#10005;
        </button>
      </div>
    </div>
  );
}

export default function CinemaRecommendations({ entries }) {
  const getData = useAdminStore((s) => s.getData);
  const saveData = useAdminStore((s) => s.saveData);

  const [raw, setRaw] = useState(null);
  const [dismissed, setDismissed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const abortRef = useRef(null);

  const profile = useMemo(() => buildTasteProfile(entries), [entries]);
  const franchises = useMemo(() => partialFranchises(entries), [entries]);
  const signature = useMemo(
    () =>
      `${entries.length}|${profile.genres.join(',')}|${profile.seeds.length}|${franchises
        .map((f) => f.name)
        .join(',')}`,
    [entries.length, profile, franchises],
  );

  const load = useCallback(
    async (force) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError('');
      try {
        const cached = force ? null : readCache(signature);
        if (cached) {
          setRaw(cached);
        } else {
          const sections = await fetchSections(profile, franchises, controller.signal);
          if (controller.signal.aborted) return;
          writeCache(signature, sections);
          setRaw(sections);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message || 'Could not reach TMDB.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [profile, franchises, signature],
  );

  // The dismissed list lives in its own file so it never enters the public bundle.
  useEffect(() => {
    let cancelled = false;
    getData(DISMISSED_COLLECTION)
      .then((file) => {
        if (!cancelled) setDismissed(new Set(file.dismissed || []));
      })
      .catch(() => {
        if (!cancelled) setDismissed(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [getData]);

  useEffect(() => {
    load(false);
    return () => abortRef.current?.abort();
  }, [load]);

  const sections = useMemo(() => {
    if (!raw || !dismissed) return [];
    const known = knownTmdbIds(entries);
    // Shared across sections so a title only appears in the first one to claim it.
    const seen = new Set();
    return SECTIONS.map((section) => ({
      ...section,
      items: filterCandidates(raw[section.id] || [], known, dismissed, seen, MAX_PER_SECTION),
    }));
  }, [raw, dismissed, entries]);

  const handleAdd = useCallback(
    async (item) => {
      setBusyId(item.tmdbId);
      setError('');
      try {
        const details = await fetchTitleDetails(item.tmdbId, item.mediaType);
        const file = await getData('cinema');
        const list = file.entries || [];
        list.push(toWatchlistEntry(details, nextNumericId(list)));
        await saveData('cinema', { ...file, entries: list });
        notifyAdminCollectionSaved('cinema');
      } catch (err) {
        setError(err.message || 'Could not add that title.');
      } finally {
        setBusyId(null);
      }
    },
    [getData, saveData],
  );

  const handleDismiss = useCallback(
    async (item) => {
      setBusyId(item.tmdbId);
      setError('');
      try {
        const file = await getData(DISMISSED_COLLECTION);
        const list = file.dismissed || [];
        if (!list.includes(item.tmdbId)) list.push(item.tmdbId);
        await saveData(DISMISSED_COLLECTION, { ...file, dismissed: list });
        setDismissed(new Set(list));
      } catch (err) {
        setError(err.message || 'Could not save that.');
      } finally {
        setBusyId(null);
      }
    },
    [getData, saveData],
  );

  const total = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.toolbar}>
        <p className={styles.summary}>
          {loading
            ? 'Asking TMDB…'
            : `${total} suggestion${total === 1 ? '' : 's'} not already on your lists`}
          {profile.genres.length > 0 && !loading && (
            <span className={styles.profile}> · {profile.genres.join(' / ')}</span>
          )}
        </p>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => load(true)}
          disabled={loading}
        >
          REFRESH
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {!loading &&
        sections.map((section) => (
          <section key={section.id} className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>&gt;</span> {section.label}
              <span className={styles.sectionCount}>{section.items.length}</span>
            </h3>
            <p className={styles.sectionBlurb}>{section.blurb}</p>

            {section.items.length === 0 ? (
              <p className={styles.empty}>Nothing new here right now.</p>
            ) : (
              <div className={styles.grid}>
                {section.items.map((item) => (
                  <RecommendationCard
                    key={`${item.mediaType}-${item.tmdbId}`}
                    item={item}
                    busy={busyId === item.tmdbId}
                    onAdd={handleAdd}
                    onDismiss={handleDismiss}
                  />
                ))}
              </div>
            )}
          </section>
        ))}

      <p className={styles.attribution}>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </motion.div>
  );
}
