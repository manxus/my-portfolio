import { useEffect, useState, useRef } from 'react';
import { searchTitles, fetchTitleDetails } from '../utils/tmdb';
import styles from './CinemaTitlePicker.module.css';

const SEARCH_DEBOUNCE_MS = 450;

function typeLabel(mediaType) {
  return mediaType === 'tv' ? 'TV' : 'MOVIE';
}

export default function CinemaTitlePicker({ value, onChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);
  const searchWrapRef = useRef(null);

  const selected = value?.tmdbId ? value : null;

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      setSearchError('');
      return undefined;
    }

    const controller = new AbortController();
    setSearching(true);
    setSearchError('');

    const timer = setTimeout(() => {
      searchTitles(q, controller.signal)
        .then((results) => {
          setSearchResults(results);
          setSearchOpen(true);
          if (results.length === 0) {
            setSearchError('No movies or shows matched that title.');
          }
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          setSearchResults([]);
          setSearchError(err.message || 'Search failed — try again.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!searchWrapRef.current?.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleSelect = async (result) => {
    setSearchResults([]);
    setSearchOpen(false);
    setSearchQuery('');
    setLoadingDetails(true);
    setSearchError('');
    try {
      const details = await fetchTitleDetails(result.tmdbId, result.mediaType);
      onChange(details);
    } catch (err) {
      setSearchError(err.message || 'Failed to load title details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleClear = () => {
    onChange({
      tmdbId: '',
      mediaType: '',
      title: '',
      year: '',
      genres: [],
      overview: '',
      coverUrl: '',
      backdropUrl: '',
      tmdbUrl: '',
      seasons: null,
      episodes: null,
      runtime: null,
    });
  };

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Search a movie or show — picking a result fills in the title, year, poster, seasons,
        episodes, runtime, genres, and overview below. All of it stays editable by hand.
      </p>

      <div className={styles.searchWrap} ref={searchWrapRef}>
        <input
          type="search"
          className={styles.searchInput}
          value={searchQuery}
          placeholder="Search a movie or show…"
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onFocus={() => {
            if (searchResults.length > 0) setSearchOpen(true);
          }}
          autoComplete="off"
        />
        {searching && <span className={styles.searchStatus}>Searching…</span>}
        {loadingDetails && <span className={styles.searchStatus}>Loading details…</span>}
        {searchError && <span className={styles.searchError}>{searchError}</span>}

        {searchOpen && searchResults.length > 0 && (
          <ul className={styles.searchResults} role="listbox">
            {searchResults.map((result) => (
              <li key={`${result.mediaType}-${result.tmdbId}`}>
                <button
                  type="button"
                  className={styles.searchResultBtn}
                  role="option"
                  onClick={() => handleSelect(result)}
                >
                  {result.posterUrl ? (
                    <img
                      src={result.posterUrl}
                      alt=""
                      className={styles.resultThumb}
                      loading="lazy"
                    />
                  ) : (
                    <span className={styles.resultThumbEmpty} aria-hidden />
                  )}
                  <span className={styles.resultText}>
                    <span className={styles.resultTitle}>
                      {result.title}
                      {result.year && ` (${result.year})`}
                    </span>
                    <span className={styles.resultBadge}>{typeLabel(result.mediaType)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div className={styles.selected}>
          {selected.coverUrl ? (
            <img src={selected.coverUrl} alt="" className={styles.selectedThumb} />
          ) : (
            <span className={styles.selectedThumbEmpty} aria-hidden />
          )}
          <div className={styles.selectedInfo}>
            <span className={styles.selectedTitle}>
              {selected.title}
              {selected.year && ` (${selected.year})`}
            </span>
            <span className={styles.selectedMeta}>
              {typeLabel(selected.mediaType)}
              {selected.mediaType === 'tv' && selected.episodes
                ? ` · ${selected.seasons || '?'} seasons · ${selected.episodes} episodes`
                : ''}
              {selected.mediaType !== 'tv' && selected.runtime ? ` · ${selected.runtime} min` : ''}
              {` · TMDB #${selected.tmdbId}`}
            </span>
          </div>
          <button type="button" className={styles.clearBtn} onClick={handleClear}>
            CLEAR
          </button>
        </div>
      )}

      <p className={styles.attribution}>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </div>
  );
}
