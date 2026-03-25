import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import steamData from '../data/steam-library.json';
import { gameOverrides } from '../data/steam-overrides';
import { useMediaQuery } from '../hooks/useMediaQuery';
import SteamTabs from '../components/SteamTabs/SteamTabs';
import SteamFilters from '../components/SteamFilters/SteamFilters';
import SteamStats from '../components/SteamStats/SteamStats';
import SteamGameDetail from '../components/SteamGameDetail/SteamGameDetail';
import SteamReviews from '../components/SteamReviews/SteamReviews';
import SteamTierList from '../components/SteamTierList/SteamTierList';
import styles from './SteamLibrary.module.css';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function mergeOverrides(games) {
  return games.map((g) => {
    const ov = gameOverrides[g.appId];
    if (!ov) return g;
    return {
      ...g,
      genres: ov.genres || g.genres || [],
      categories: ov.categories || g.categories || [],
    };
  });
}

export default function SteamLibrary() {
  const [activeTab, setActiveTab] = useState('library');
  const [selectedGame, setSelectedGame] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState(new Set());

  const { profile } = steamData;
  const games = useMemo(() => mergeOverrides(steamData.games), []);

  const gridRef = useRef(null);
  const [cols, setCols] = useState(3);
  const isWide = useMediaQuery('(min-width: 1500px)');

  useEffect(() => {
    if (isWide) setShowStats(false);
  }, [isWide]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => {
      const columns =
        getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      setCols(columns);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [activeTab]);

  const handleFilterToggle = useCallback((tag) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const filteredGames = useMemo(() => {
    let list = games;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }
    if (activeFilters.size > 0) {
      list = list.filter((g) => {
        const tags = new Set([...(g.genres || []), ...(g.categories || [])]);
        for (const f of activeFilters) {
          if (!tags.has(f)) return false;
        }
        return true;
      });
    }
    return list;
  }, [games, search, activeFilters]);

  const selectedIndex = filteredGames.findIndex(
    (g) => g.appId === selectedGame,
  );
  const selectedGameData = selectedIndex >= 0 ? filteredGames[selectedIndex] : null;

  const detailOrder = useMemo(() => {
    if (selectedIndex < 0) return -1;
    const row = Math.floor(selectedIndex / cols);
    return Math.min((row + 1) * cols, filteredGames.length) * 2 - 1;
  }, [selectedIndex, cols, filteredGames.length]);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setSelectedGame(null);
  }, []);

  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <SteamTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === 'library' && (
        <div className={styles.page}>
          <div className={styles.main}>
            <motion.div variants={fadeUp} className={styles.gridSection}>
              <div className={styles.filterBar}>
                <SteamFilters
                  search={search}
                  onSearchChange={setSearch}
                  activeFilters={activeFilters}
                  onFilterToggle={handleFilterToggle}
                  games={games}
                />
                {!isWide && (
                  <button
                    className={styles.statsToggle}
                    onClick={() => setShowStats(true)}
                  >
                    [STATS]
                  </button>
                )}
              </div>

              <div className={styles.grid} ref={gridRef}>
                {filteredGames.map((game, i) => (
                  <button
                    key={game.appId}
                    style={{ order: i * 2 }}
                    className={`${styles.gameCard} ${selectedGame === game.appId ? styles.gameSelected : ''}`}
                    onClick={() =>
                      setSelectedGame(
                        selectedGame === game.appId ? null : game.appId,
                      )
                    }
                  >
                    <img
                      src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/library_600x900.jpg`}
                      alt={game.name}
                      className={styles.gameImage}
                      loading="lazy"
                      onError={(e) => {
                        e.target.src = game.headerUrl;
                      }}
                    />
                  </button>
                ))}

                <AnimatePresence>
                  {selectedGameData && (
                    <SteamGameDetail
                      key={selectedGame}
                      game={selectedGameData}
                      onClose={() => setSelectedGame(null)}
                      style={{ order: detailOrder }}
                    />
                  )}
                </AnimatePresence>
              </div>

              {filteredGames.length === 0 && (
                <p className={styles.noResults}>No games match your filters.</p>
              )}
            </motion.div>

            <motion.p variants={fadeUp} className={styles.hint}>
              Run <code>node scripts/fetch-steam-data.js</code> with your Steam
              API key to populate with real data.
            </motion.p>
          </div>

          {isWide && (
            <motion.aside
              className={styles.sidebar}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <SteamStats games={games} profile={profile} compact />
            </motion.aside>
          )}
        </div>
      )}

      {activeTab === 'reviews' && (
        <motion.div
          key="reviews"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <SteamReviews games={games} />
        </motion.div>
      )}

      {activeTab === 'tierlist' && (
        <motion.div
          key="tierlist"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <SteamTierList games={games} />
        </motion.div>
      )}

      <AnimatePresence>
        {!isWide && showStats && activeTab === 'library' && (
          <motion.div
            key="backdrop"
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowStats(false)}
          />
        )}
        {!isWide && showStats && activeTab === 'library' && (
          <motion.aside
            key="overlay"
            className={styles.overlay}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className={styles.overlayHeader}>
              <span className={styles.overlayTitle}>STATS OVERVIEW</span>
              <button
                className={styles.overlayClose}
                onClick={() => setShowStats(false)}
              >
                &#10005;
              </button>
            </div>
            <div className={styles.overlayContent}>
              <SteamStats games={games} profile={profile} compact />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
