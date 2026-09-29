import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import steamData from '../data/steam-library.json';
import steamOverridesData from '../data/steam-overrides.json';
import { useAdminStore } from '../stores/adminStore';

const { gameOverrides } = steamOverridesData;
import SteamTabs from '../components/SteamTabs/SteamTabs';
import { TABS } from '../components/SteamTabs/tabs';
import SteamFilters from '../components/SteamFilters/SteamFilters';
import SteamOverview from '../components/SteamOverview/SteamOverview';
import SteamReviews from '../components/SteamReviews/SteamReviews';
import SteamTierList from '../components/SteamTierList/SteamTierList';
import SteamWishlist from '../components/SteamWishlist/SteamWishlist';
import SteamMilestones from '../components/SteamMilestones/SteamMilestones';
import SteamHallOfPain from '../components/SteamHallOfPain/SteamHallOfPain';
import SteamAchievements from '../components/SteamAchievements/SteamAchievements';
import { trackSteamAchievementsTab } from '../hooks/useVisitorTracking';
import { achievementIconUrl, completionPct } from '../utils/steamAchievements';
import SteamGameCard from '../components/SteamGameCard/SteamGameCard';
import styles from './SteamLibrary.module.css';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// Steam stores achievement icons as a file stem (see achievementIconUrl);
// expand them once here so every tab below can keep reading item.iconUrl.
function withIconUrls(game) {
  const items = game.achievements?.items;
  if (!items) return game;
  return {
    ...game,
    achievements: {
      ...game.achievements,
      items: items.map((item) =>
        item.iconUrl ? item : { ...item, iconUrl: achievementIconUrl(game.appId, item) },
      ),
    },
  };
}

function mergeOverrides(games) {
  return games.map((raw) => {
    const g = withIconUrls(raw);
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

const TAB_IDS = new Set(TABS.map((t) => t.id));

const SORT_OPTIONS = [
  { key: 'hours', label: 'Hours Played' },
  { key: 'name', label: 'Alphabetical' },
  { key: 'achievements', label: 'Achievement %' },
];

/** Params left at these values are dropped, so the bare page URL stays clean. */
const DEFAULTS = { tab: 'overview', q: '', sort: 'hours', page: '1' };

function sortGames(list, sortBy) {
  const sorted = [...list];
  switch (sortBy) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'achievements': {
      // Games tracking nothing sort below 0%, not alongside it.
      const pct = (g) => completionPct(g) ?? -1;
      return sorted.sort((a, b) => pct(b) - pct(a));
    }
    case 'hours':
    default:
      return sorted.sort((a, b) => (b.playtimeHours || 0) - (a.playtimeHours || 0));
  }
}

export default function SteamLibrary() {
  const isAdmin = useAdminStore((s) => s.isAuthenticated);
  const [params, setParams] = useSearchParams();

  const { profile, wishlist } = steamData;
  const games = useMemo(() => mergeOverrides(steamData.games), []);

  // Everything below is read from the URL, and anything off-list falls back to
  // its default, so a hand-edited or stale link can't wedge the page.
  const pick = (key, valid) => {
    const v = params.get(key);
    return v != null && valid(v) ? v : DEFAULTS[key];
  };
  const activeTab = pick('tab', (v) => TAB_IDS.has(v));
  const search = params.get('q') ?? '';
  const sortBy = pick('sort', (v) => SORT_OPTIONS.some((o) => o.key === v));
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);

  // Search, sort and page changes replace the history entry, or every keystroke
  // in the search box would be its own back step. Tab switches (below) push.
  const updateParams = useCallback(
    (patch) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            const str = value == null ? '' : String(value);
            if (str === '' || str === DEFAULTS[key]) next.delete(key);
            else next.set(key, str);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const handleSearchChange = useCallback(
    (value) => updateParams({ q: value, page: null }),
    [updateParams],
  );

  const handleSortChange = useCallback(
    (key) => updateParams({ sort: key, page: null }),
    [updateParams],
  );

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

  // Library filters only mean something on the Library tab, so a tab switch
  // starts clean rather than carrying ?q= onto the Overview. It pushes, so
  // back/forward walks between tabs.
  const handleTabChange = useCallback(
    (tab) => {
      if (tab === activeTab) return;
      if (tab === 'achievements') trackSteamAchievementsTab();
      setParams(tab === DEFAULTS.tab ? {} : { tab });
    },
    [activeTab, setParams],
  );

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

              <div className={styles.grid}>
                {pagedGames.map((game) => (
                  <SteamGameCard key={game.appId} game={game} />
                ))}
              </div>

              {filteredGames.length === 0 && (
                <p className={styles.noResults}>No games match your search.</p>
              )}

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={safePage <= 1}
                    onClick={() => updateParams({ page: safePage - 1 })}
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
                    onClick={() => updateParams({ page: safePage + 1 })}
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
          <SteamMilestones games={games} wishlist={wishlist || []} />
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
