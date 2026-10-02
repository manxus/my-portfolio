import { useState, useMemo, useEffect, useCallback } from 'react';
import defaultTierlistFile from '../../data/steam-tierlist.json';
import EditableSection, { EditableItemControls } from '../../admin/EditableSection';
import SteamGameCover from '../SteamGameCover/SteamGameCover';
import TierBoard, { TierCategoryBar } from '../TierBoard/TierBoard';
import { useAdminStore } from '../../stores/adminStore';
import styles from '../TierBoard/TierBoard.module.css';

const defaultTierLists = defaultTierlistFile.tierLists;

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', 'F', 'unplayed'];

const tierLabelText = (tier) => (tier === 'unplayed' ? '?' : tier);

const TIER_HINTS = {
  S: 'Favorites in this category',
  A: 'Excellent',
  B: 'Solid and enjoyable',
  C: 'Mediocre',
  D: 'Weak',
  F: "Didn't enjoy",
  unplayed: 'Owned but not ranked yet',
};

const tierHint = (tier) => TIER_HINTS[tier];

export default function SteamTierList({ games }) {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const getData = useAdminStore((s) => s.getData);
  const saveData = useAdminStore((s) => s.saveData);
  const isAdminUi = import.meta.env.DEV && isAuthenticated;

  const [adminTierLists, setAdminTierLists] = useState(null);
  const [activeCategory, setActiveCategory] = useState(
    defaultTierLists[0]?.category || '',
  );

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

  const resolveGame = useCallback(
    (id) => {
      const game = gameMap[id];
      if (!game) return null;
      return {
        title: game.name,
        node: (
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
            rootClassName={styles.coverRoot}
            imageClassName={styles.gameImg}
          />
        ),
      };
    },
    [gameMap],
  );

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

  if (tierLists.length === 0) {
    return (
      <p className={styles.empty}>No tier lists yet. Check back soon.</p>
    );
  }

  return (
    <EditableSection collection="steam-tierlist" dataKey="tierLists">
      <div className={styles.container}>
        <TierCategoryBar
          categories={tierLists.map((tl) => tl.category)}
          active={activeCategory}
          onSelect={setActiveCategory}
          renderControls={(i) => <EditableItemControls index={i} />}
        />

        {activeTierList && (
          <TierBoard
            boardKey={activeCategory}
            tierOrder={TIER_ORDER}
            tiers={activeTierList.tiers}
            resolveItem={resolveGame}
            labelFor={tierLabelText}
            hintFor={tierHint}
            hiddenWhenEmpty={['unplayed']}
            dndReady={dndReady}
            onMove={persistTierMutation}
          />
        )}
      </div>
    </EditableSection>
  );
}
