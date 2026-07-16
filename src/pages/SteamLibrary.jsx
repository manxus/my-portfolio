import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import steamData from '../data/steam-library.json';
import steamOverridesData from '../data/steam-overrides.json';
import { useAdminStore } from '../stores/adminStore';

const { gameOverrides } = steamOverridesData;
import SteamTabs from '../components/SteamTabs/SteamTabs';
import SteamFilters from '../components/SteamFilters/SteamFilters';
import SteamOverview from '../components/SteamOverview/SteamOverview';
import SteamGameDetail from '../components/SteamGameDetail/SteamGameDetail';
import SteamReviews from '../components/SteamReviews/SteamReviews';
import SteamTierList from '../components/SteamTierList/SteamTierList';
import SteamWishlist from '../components/SteamWishlist/SteamWishlist';
import SteamMilestones from '../components/SteamMilestones/SteamMilestones';
import SteamHallOfPain from '../components/SteamHallOfPain/SteamHallOfPain';
import SteamAchievements from '../components/SteamAchievements/SteamAchievements';
import { trackSteamAchievementsTab } from '../hooks/useVisitorTracking';
import SteamGameCover from '../components/SteamGameCover/SteamGameCover';
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
      playerModes: ov.playerModes || g.playerModes || [],
      hardwareSupport: ov.hardwareSupport || g.hardwareSupport || [],
    };
  });
}

const GAMES_PER_PAGE = 100;

const SORT_OPTIONS = [
  { key: 'hours', label: 'Hours Played' },
  { key: 'name', label: 'Alphabetical' },
  { key: 'achievements', label: 'Achievement %' },
  { key: 'hltb100', label: 'HLTB 100% (Longest)' },
  { key: 'hltb100asc', label: 'HLTB 100% (Shortest)' },
];

function compareHltb100(a, b, ascending) {
  const ah = a.hltb?.completionistHours;
  const bh = b.hltb?.completionistHours;
  if (ah == null && bh == null) return 0;
  if (ah == null) return 1;
  if (bh == null) return -1;
  return ascending ? ah - bh : bh - ah;
}

function sortGames(list, sortBy) {
  const sorted = [...list];
  switch (sortBy) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'achievements': {
      const pct = (g) => {
        if (!g.achievements || g.achievements.total === 0) return -1;
        return g.achievements.unlocked / g.achievements.total;
      };
      return sorted.sort((a, b) => pct(b) - pct(a));
    }
    case 'hltb100':
      return sorted.sort((a, b) => compareHltb100(a, b, false));
    case 'hltb100asc':
      return sorted.sort((a, b) => compareHltb100(a, b, true));
    case 'hours':
    default:
      return sorted.sort((a, b) => (b.playtimeHours || 0) - (a.playtimeHours || 0));
  }
}

export default function SteamLibrary() {
  const isAdmin = useAdminStore((s) => s.isAuthenticated);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedGame, setSelectedGame] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('hours');
  const [page, setPage] = useState(1);

  const { profile, wishlist } = steamData;
  const games = useMemo(() => mergeOverrides(steamData.games), []);
  const wishlistCount = wishlist?.length || 0;

  const gridRef = useRef(null);
  const [cols, setCols] = useState(3);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    setPage(1);
    setSelectedGame(null);
  }, []);

  const handleSortChange = useCallback((key) => {
    setSortBy(key);
    setPage(1);
    setSelectedGame(null);
  }, []);

  const filteredGames = useMemo(() => {
    let list = games;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }
    return sortGames(list, sortBy);
  }, [games, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredGames.length / GAMES_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pagedGames = filteredGames.slice(
    (safePage - 1) * GAMES_PER_PAGE,
    safePage * GAMES_PER_PAGE,
  );

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || activeTab !== 'library') return;

    // Derive column count from card width vs grid width. Parsing
    // gridTemplateColumns was unreliable with auto-fill and left `cols`
    // stuck at the default (3) while the grid showed 6 — so the detail
    // panel inserted mid-row and left a gap beside the selected cover.
    const measure = () => {
      const card = grid.querySelector(`.${styles.gameCard}`);
      if (!card) return;
      const gap =
        parseFloat(getComputedStyle(grid).columnGap || getComputedStyle(grid).gap) ||
        0;
      const cardWidth = card.getBoundingClientRect().width;
      if (cardWidth <= 0) return;
      const count = Math.max(
        1,
        Math.round((grid.clientWidth + gap) / (cardWidth + gap)),
      );
      setCols(count);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [activeTab, pagedGames.length, safePage]);

  const selectedIndex = pagedGames.findIndex(
    (g) => g.appId === selectedGame,
  );
  const selectedGameData = selectedIndex >= 0 ? pagedGames[selectedIndex] : null;

  const detailOrder = useMemo(() => {
    if (selectedIndex < 0) return -1;
    const row = Math.floor(selectedIndex / cols);
    return Math.min((row + 1) * cols, pagedGames.length) * 2 - 1;
  }, [selectedIndex, cols, pagedGames.length]);

  const handleTabChange = useCallback((tab) => {
    if (tab === 'achievements') trackSteamAchievementsTab();
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

      {activeTab === 'overview' && (
        <motion.div
          key="overview"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <SteamOverview
            games={games}
            profile={profile}
            wishlist={wishlist || []}
          />
        </motion.div>
      )}

      {activeTab === 'library' && (
        <motion.div
          className={styles.page}
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <div className={styles.main}>
            <motion.div variants={fadeUp} className={styles.gridSection}>
              <div className={styles.filterBar}>
                <SteamFilters
                  search={search}
                  onSearchChange={handleSearchChange}
                  sortBy={sortBy}
                  onSortChange={handleSortChange}
                  sortOptions={SORT_OPTIONS}
                />
              </div>

              <div className={styles.grid} ref={gridRef}>
                {pagedGames.map((game, i) => (
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
                    <SteamGameCover
                      fill
                      variant="cover"
                      appId={game.appId}
                      title={game.name}
                      headerUrl={game.headerUrl}
                      libraryCapsuleUrl={game.libraryCapsuleUrl}
                      libraryHeaderUrl={game.libraryHeaderUrl}
                      iconUrl={game.iconUrl}
                      alt={game.name}
                      rootClassName={styles.gameCoverRoot}
                      imageClassName={styles.gameImage}
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
                <p className={styles.noResults}>No games match your search.</p>
              )}

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={safePage <= 1}
                    onClick={() => { setPage(safePage - 1); setSelectedGame(null); }}
                  >
                    &laquo; PREV
                  </button>
                  <span className={styles.pageInfo}>
                    PAGE {safePage} / {totalPages}
                    <span className={styles.pageCount}>
                      &nbsp;({filteredGames.length} games)
                    </span>
                  </span>
                  <button
                    className={styles.pageBtn}
                    disabled={safePage >= totalPages}
                    onClick={() => { setPage(safePage + 1); setSelectedGame(null); }}
                  >
                    NEXT &raquo;
                  </button>
                </div>
              )}
            </motion.div>

            {isAdmin && (
              <motion.p variants={fadeUp} className={styles.hint}>
                Run <code>node scripts/fetch-steam-data.js</code> with your Steam
                API key to populate with real data.
              </motion.p>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'achievements' && (
        <motion.div
          key="achievements"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <SteamAchievements games={games} />
        </motion.div>
      )}

      {activeTab === 'wishlist' && (
        <motion.div
          key="wishlist"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <SteamWishlist wishlist={wishlist || []} />
        </motion.div>
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

      {activeTab === 'milestones' && (
        <motion.div
          key="milestones"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <SteamMilestones games={games} wishlistCount={wishlistCount} />
        </motion.div>
      )}

      {activeTab === 'hallofpain' && (
        <motion.div
          key="hallofpain"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <SteamHallOfPain games={games} />
        </motion.div>
      )}
    </motion.div>
  );
}
