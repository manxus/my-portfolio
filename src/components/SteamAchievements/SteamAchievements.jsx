import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import AchievementCard from './AchievementCard';
import SteamGameCover from '../SteamGameCover/SteamGameCover';
import { buildAchievementData } from './achievementShared';
import styles from './SteamAchievements.module.css';

const SUB_TABS = [
  { id: 'showcase', label: 'SHOWCASE' },
  { id: 'browse', label: 'BROWSE' },
];

const BROWSE_SORTS = [
  { key: 'rarity', label: 'Rarity' },
  { key: 'recent', label: 'Unlock Date' },
  { key: 'locked', label: 'Locked First' },
  { key: 'name', label: 'Alphabetical' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
};

function PerfectGameBanner({ game }) {
  return (
    <>
      <SteamGameCover
        fill
        variant="banner"
        appId={game.appId}
        title={game.name}
        headerUrl={game.headerUrl}
        libraryHeaderUrl={game.libraryHeaderUrl}
        iconUrl={game.iconUrl}
        alt={game.name}
        rootClassName={styles.coverRoot}
        imageClassName={styles.coverImg}
      />
      <div className={styles.coverOverlay}>
        <span className={styles.coverName}>{game.name}</span>
        <span className={styles.coverCount}>
          {game.achievements.total}/{game.achievements.total}
        </span>
      </div>
    </>
  );
}

export default function SteamAchievements({ games }) {
  const [subTab, setSubTab] = useState('showcase');
  const [browseAppId, setBrowseAppId] = useState(null);
  const [browseSort, setBrowseSort] = useState('rarity');
  const [browseSearch, setBrowseSearch] = useState('');

  const { gamesWithItems, unlockedAch, perfectGames } = useMemo(
    () => buildAchievementData(games),
    [games],
  );

  const rarestUnlocked = useMemo(
    () =>
      unlockedAch
        .filter((a) => a.globalPct != null)
        .sort((a, b) => a.globalPct - b.globalPct),
    [unlockedAch],
  );

  const recentUnlocked = useMemo(
    () =>
      unlockedAch
        .filter((a) => a.unlockTime > 0)
        .sort((a, b) => b.unlockTime - a.unlockTime),
    [unlockedAch],
  );

  // ---- Browse tab derived data ----
  const browseGameList = useMemo(() => {
    const q = browseSearch.trim().toLowerCase();
    return [...gamesWithItems]
      .filter((g) => (q ? g.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [gamesWithItems, browseSearch]);

  const activeBrowseId =
    browseAppId != null && gamesWithItems.some((g) => g.appId === browseAppId)
      ? browseAppId
      : browseGameList[0]?.appId ?? null;

  const activeBrowseGame = useMemo(
    () => gamesWithItems.find((g) => g.appId === activeBrowseId) || null,
    [gamesWithItems, activeBrowseId],
  );

  const browseItems = useMemo(() => {
    if (!activeBrowseGame) return [];
    const items = activeBrowseGame.achievements.items.map((i) => ({
      ...i,
      gameName: null,
    }));
    const byRarity = (a, b) => {
      const av = a.globalPct == null ? Infinity : a.globalPct;
      const bv = b.globalPct == null ? Infinity : b.globalPct;
      return av - bv;
    };
    switch (browseSort) {
      case 'recent':
        return items.sort((a, b) => (b.unlockTime || 0) - (a.unlockTime || 0));
      case 'locked':
        return items.sort((a, b) => Number(a.unlocked) - Number(b.unlocked));
      case 'name':
        return items.sort((a, b) => a.name.localeCompare(b.name));
      case 'rarity':
      default:
        return items.sort(byRarity);
    }
  }, [activeBrowseGame, browseSort]);

  if (gamesWithItems.length === 0) {
    return (
      <p className={styles.empty}>
        No achievement detail loaded yet — run{' '}
        <code className={styles.code}>node scripts/fetch-steam-data.js</code>{' '}
        to pull per-achievement data from your Steam profile.
      </p>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.subTabBar}>
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.subTabBtn} ${subTab === t.id ? styles.subTabActive : ''}`}
            onClick={() => setSubTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'showcase' && (
        <motion.div
          key="showcase"
          className={styles.stack}
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <h2 className={styles.blockTitle}>RAREST UNLOCKS</h2>
              <p className={styles.blockHint}>
                Lowest global unlock rate among all owners
              </p>
            </div>
            <div className={styles.achGrid}>
              {rarestUnlocked.slice(0, 18).map((a) => (
                <motion.div key={`${a.appId}-${a.apiName}`} variants={fadeUp}>
                  <AchievementCard ach={a} />
                </motion.div>
              ))}
            </div>
          </section>

          <section className={styles.block}>
            <div className={styles.blockHead}>
              <h2 className={styles.blockTitle}>RECENT UNLOCKS</h2>
              <p className={styles.blockHint}>Most recently earned achievements</p>
            </div>
            <div className={styles.achGrid}>
              {recentUnlocked.slice(0, 18).map((a) => (
                <motion.div key={`${a.appId}-${a.apiName}`} variants={fadeUp}>
                  <AchievementCard ach={a} />
                </motion.div>
              ))}
            </div>
          </section>

          {perfectGames.length > 0 && (
            <section className={styles.block}>
              <div className={styles.blockHead}>
                <h2 className={styles.blockTitle}>
                  PERFECT GAMES · {perfectGames.length}
                </h2>
                <p className={styles.blockHint}>100% of tracked achievements</p>
              </div>
              <div className={styles.coverStrip}>
                {perfectGames.slice(0, 24).map((g) => (
                  <motion.div
                    key={g.appId}
                    variants={fadeUp}
                    className={styles.coverItem}
                    title={`${g.name} — ${g.achievements.total}/${g.achievements.total}`}
                  >
                    <PerfectGameBanner game={g} />
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </motion.div>
      )}

      {subTab === 'browse' && (
        <motion.div
          key="browse"
          className={styles.browse}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <aside className={styles.browseSidebar}>
            <input
              type="text"
              className={styles.browseSearch}
              placeholder="SEARCH GAMES"
              value={browseSearch}
              onChange={(e) => setBrowseSearch(e.target.value)}
            />
            <div className={styles.browseList}>
              {browseGameList.map((g) => (
                <button
                  key={g.appId}
                  type="button"
                  className={`${styles.browseListItem} ${g.appId === activeBrowseId ? styles.browseListActive : ''}`}
                  onClick={() => setBrowseAppId(g.appId)}
                >
                  <span className={styles.browseListName}>{g.name}</span>
                  <span className={styles.browseListCount}>
                    {g.achievements.unlocked}/{g.achievements.total}
                  </span>
                </button>
              ))}
              {browseGameList.length === 0 && (
                <p className={styles.browseNoResults}>No games match.</p>
              )}
            </div>
          </aside>

          <div className={styles.browseMain}>
            {activeBrowseGame && (
              <>
                <div className={styles.browseHeader}>
                  <div>
                    <h2 className={styles.browseTitle}>{activeBrowseGame.name}</h2>
                    <p className={styles.browseSub}>
                      {activeBrowseGame.achievements.unlocked} /{' '}
                      {activeBrowseGame.achievements.total} unlocked
                    </p>
                  </div>
                  <div className={styles.sortGroup}>
                    {BROWSE_SORTS.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        className={`${styles.sortBtn} ${browseSort === s.key ? styles.sortActive : ''}`}
                        onClick={() => setBrowseSort(s.key)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.achGrid}>
                  {browseItems.map((a) => (
                    <AchievementCard key={a.apiName} ach={a} />
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
