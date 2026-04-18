import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import defaultTierlistFile from '../../data/steam-tierlist.json';
import EditableSection, { EditableItemControls } from '../../admin/EditableSection';
import SteamGameCover from '../SteamGameCover/SteamGameCover';
import { useAdminStore } from '../../stores/adminStore';
import styles from './SteamTierList.module.css';

const defaultTierLists = defaultTierlistFile.tierLists;

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', 'F', 'unplayed'];

const DND_PAYLOAD_TYPE = 'application/x-steam-tier-dnd';

const tierLabelText = (tier) => (tier === 'unplayed' ? '?' : tier);

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

function cloneTiers(tiers) {
  const next = {};
  for (const t of TIER_ORDER) {
    next[t] = [...(tiers[t] || [])];
  }
  return next;
}

/**
 * Remove from fromTier at fromIndex, insert into toTier before targetBeforeId
 * (or append if targetBeforeId is null). Returns null if no change.
 */
function moveAppIdToTier(tiers, fromTier, fromIndex, toTier, targetBeforeId) {
  const next = cloneTiers(tiers);
  const fromArr = next[fromTier];
  if (fromIndex < 0 || fromIndex >= fromArr.length) return null;

  const movedId = fromArr[fromIndex];
  if (targetBeforeId != null && targetBeforeId === movedId) {
    return null;
  }

  fromArr.splice(fromIndex, 1);
  const toArr = next[toTier];
  let insertAt = toArr.length;
  if (targetBeforeId != null) {
    insertAt = toArr.indexOf(targetBeforeId);
    if (insertAt === -1) insertAt = toArr.length;
  }
  toArr.splice(insertAt, 0, movedId);
  return next;
}

export default function SteamTierList({ games }) {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const getData = useAdminStore((s) => s.getData);
  const saveData = useAdminStore((s) => s.saveData);
  const isAdminUi = import.meta.env.DEV && isAuthenticated;

  const [adminTierLists, setAdminTierLists] = useState(null);
  const [activeCategory, setActiveCategory] = useState(
    defaultTierLists[0]?.category || '',
  );
  const [dragOverTier, setDragOverTier] = useState(null);

  const tierLists = isAdminUi && adminTierLists ? adminTierLists : defaultTierLists;
  const dndReady = isAdminUi && adminTierLists !== null;

  const refreshAdminTierLists = useCallback(async () => {
    try {
      const data = await getData('steam-tierlist');
      setAdminTierLists(data.tierLists);
    } catch (err) {
      console.error('Failed to load steam tier list:', err);
    }
  }, [getData]);

  useEffect(() => {
    if (!isAdminUi) {
      setAdminTierLists(null);
      return;
    }
    refreshAdminTierLists();
  }, [isAdminUi, refreshAdminTierLists]);

  useEffect(() => {
    if (!isAdminUi) return undefined;
    const onSaved = (e) => {
      if (e.detail?.collection !== 'steam-tierlist') return;
      refreshAdminTierLists();
    };
    window.addEventListener('admin-collection-saved', onSaved);
    return () => window.removeEventListener('admin-collection-saved', onSaved);
  }, [isAdminUi, refreshAdminTierLists]);

  useEffect(() => {
    const clearOver = () => setDragOverTier(null);
    document.addEventListener('dragend', clearOver);
    return () => document.removeEventListener('dragend', clearOver);
  }, []);

  useEffect(() => {
    if (tierLists.length === 0) return;
    if (!tierLists.some((t) => t.category === activeCategory)) {
      setActiveCategory(tierLists[0].category);
    }
  }, [tierLists, activeCategory]);

  const gameMap = useMemo(() => {
    const m = {};
    for (const g of games) m[g.appId] = g;
    return m;
  }, [games]);

  const activeTierList = tierLists.find((t) => t.category === activeCategory);

  const persistTierMutation = useCallback(
    async (nextTiersForActiveList) => {
      if (!activeCategory) return;

      setAdminTierLists((prev) => {
        if (!prev) return prev;
        const listIdx = prev.findIndex((t) => t.category === activeCategory);
        if (listIdx < 0) return prev;
        return prev.map((tl, i) =>
          i === listIdx ? { ...tl, tiers: nextTiersForActiveList } : tl,
        );
      });

      try {
        const fileData = await getData('steam-tierlist');
        const mergedLists = [...fileData.tierLists];
        const fileIdx = mergedLists.findIndex((t) => t.category === activeCategory);
        if (fileIdx < 0) throw new Error('Category not found in steam-tierlist');
        mergedLists[fileIdx] = {
          ...mergedLists[fileIdx],
          tiers: nextTiersForActiveList,
        };
        await saveData('steam-tierlist', { ...fileData, tierLists: mergedLists });
      } catch (err) {
        console.error('Failed to save tier list:', err);
        await refreshAdminTierLists();
      }
    },
    [activeCategory, getData, refreshAdminTierLists, saveData],
  );

  const handleDragStart = (e, fromTier, fromIndex) => {
    if (!dndReady || !activeTierList) return;
    const ids = activeTierList.tiers[fromTier] || [];
    const appId = ids[fromIndex];
    if (appId == null) return;
    e.dataTransfer.setData(
      DND_PAYLOAD_TYPE,
      JSON.stringify({ fromTier, fromIndex, appId }),
    );
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add(styles.gameThumbDragging);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove(styles.gameThumbDragging);
  };

  const handleDragOverTier = (e, tierKey) => {
    if (!dndReady) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTier(tierKey);
  };

  const handleDropOnTier = (e, toTier) => {
    if (!dndReady || !activeTierList) return;
    e.preventDefault();
    setDragOverTier(null);

    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData(DND_PAYLOAD_TYPE) || '{}');
    } catch {
      return;
    }
    const { fromTier, fromIndex } = payload;
    if (fromTier == null || fromIndex == null) return;

    const thumb = e.target.closest('[data-tier-appid]');
    const rawTarget = thumb?.getAttribute('data-tier-appid');
    const targetBeforeId =
      rawTarget != null && thumb?.closest(`.${styles.tierGames}`)?.dataset.tierKey === toTier
        ? Number(rawTarget)
        : null;

    const nextTiers = moveAppIdToTier(
      activeTierList.tiers,
      fromTier,
      fromIndex,
      toTier,
      targetBeforeId,
    );
    if (!nextTiers) return;

    persistTierMutation(nextTiers);
  };

  if (tierLists.length === 0) {
    return (
      <p className={styles.empty}>No tier lists yet. Check back soon.</p>
    );
  }

  return (
    <EditableSection collection="steam-tierlist" dataKey="tierLists">
      <div className={styles.container}>
        <div className={styles.categoryBar}>
          {tierLists.map((tl, i) => (
            <button
              key={tl.category}
              type="button"
              className={`${styles.categoryBtn} ${activeCategory === tl.category ? styles.categoryActive : ''}`}
              onClick={() => setActiveCategory(tl.category)}
            >
              {tl.category.toUpperCase()}
              <EditableItemControls index={i} />
            </button>
          ))}
        </div>

        {activeTierList && (
          <motion.div
            key={activeCategory}
            className={styles.tierGrid}
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            {TIER_ORDER.map((tier) => {
              const appIds = activeTierList.tiers[tier] || [];
              return (
                <motion.div
                  key={tier}
                  className={styles.tierRow}
                  variants={fadeUp}
                  aria-label={
                    tier === 'unplayed'
                      ? 'Unplayed — games not started yet'
                      : `Tier ${tier}`
                  }
                >
                  <div
                    className={styles.tierLabel}
                    data-tier={tier}
                    title={tier === 'unplayed' ? 'Unplayed' : undefined}
                  >
                    {tierLabelText(tier)}
                  </div>
                  <div
                    className={`${styles.tierGames} ${dragOverTier === tier ? styles.tierGamesDragOver : ''}`}
                    data-tier-key={tier}
                    onDragOver={(e) => handleDragOverTier(e, tier)}
                    onDrop={(e) => handleDropOnTier(e, tier)}
                  >
                    {appIds.length === 0 && (
                      <span className={styles.tierEmpty}>---</span>
                    )}
                    {appIds.map((id, idx) => {
                      const game = gameMap[id];
                      if (!game) return null;
                      return (
                        <div
                          key={id}
                          className={styles.gameThumb}
                          title={dndReady ? `${game.name} — drag to reorder or move tiers` : game.name}
                          draggable={dndReady}
                          data-tier-appid={id}
                          onDragStart={(e) => handleDragStart(e, tier, idx)}
                          onDragEnd={handleDragEnd}
                        >
                          <SteamGameCover
                            fill
                            textFallbackOnly
                            appId={game.appId}
                            title={game.name}
                            alt={game.name}
                            rootClassName={styles.coverRoot}
                            imageClassName={styles.gameImg}
                          />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </EditableSection>
  );
}
