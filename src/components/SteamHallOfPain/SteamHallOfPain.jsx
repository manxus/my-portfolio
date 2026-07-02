import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import hallOfPainFile from '../../data/steam-hallofpain.json';
import EditableSection, { EditableItemControls } from '../../admin/EditableSection';
import SteamGameCover from '../SteamGameCover/SteamGameCover';
import { useAdminStore } from '../../stores/adminStore';
import styles from './SteamHallOfPain.module.css';

const defaultEntries = hallOfPainFile.entries || [];

const STATUS_META = {
  conquered: { label: 'CONQUERED', className: 'statusConquered' },
  brokeme: { label: 'BROKE ME', className: 'statusBrokeme' },
  bleeding: { label: 'STILL BLEEDING', className: 'statusBleeding' },
  dreading: { label: 'DREADING IT', className: 'statusDreading' },
};

function isPerfected(game) {
  const ach = game?.achievements;
  return Boolean(ach && ach.total > 0 && ach.unlocked === ach.total);
}

export default function SteamHallOfPain({ games }) {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const getData = useAdminStore((s) => s.getData);
  const isAdminUi = import.meta.env.DEV && isAuthenticated;

  const [adminEntries, setAdminEntries] = useState(null);

  const sourceEntries =
    isAdminUi && adminEntries ? adminEntries : defaultEntries;

  const refreshAdminEntries = useCallback(async () => {
    try {
      const data = await getData('steam-hallofpain');
      setAdminEntries(data.entries || []);
    } catch (err) {
      console.error('Failed to load Hall of Pain:', err);
    }
  }, [getData]);

  useEffect(() => {
    if (!isAdminUi) {
      setAdminEntries(null);
      return;
    }
    refreshAdminEntries();
  }, [isAdminUi, refreshAdminEntries]);

  useEffect(() => {
    if (!isAdminUi) return undefined;
    const onSaved = (e) => {
      if (e.detail?.collection !== 'steam-hallofpain') return;
      refreshAdminEntries();
    };
    window.addEventListener('admin-collection-saved', onSaved);
    return () => window.removeEventListener('admin-collection-saved', onSaved);
  }, [isAdminUi, refreshAdminEntries]);

  const gameMap = useMemo(() => {
    const m = {};
    for (const g of games) m[g.appId] = g;
    return m;
  }, [games]);

  const visibleEntries = useMemo(() => {
    return sourceEntries.map((entry, index) => {
      const game = gameMap[entry.appId];
      const perfected = isPerfected(game);
      // 100% achievements auto-promotes to Conquered regardless of stored status.
      const status = perfected ? 'conquered' : entry.status;
      return { entry, index, game, status, perfected };
    });
  }, [sourceEntries, gameMap]);

  return (
    <EditableSection collection="steam-hallofpain" dataKey="entries">
      <div className={styles.container}>
        {sourceEntries.length === 0 ? (
          <p className={styles.empty}>
            No trials logged yet. The Hall of Pain awaits its first victim.
          </p>
        ) : (
          <motion.div className={styles.grid}>
            {visibleEntries.map(({ entry, index, game, status, perfected }, i) => {
              const name = game?.name || `App ${entry.appId}`;
              const meta = STATUS_META[status] || STATUS_META.bleeding;
              const conquered = status === 'conquered';
              const ach = game?.achievements;
              const achLabel =
                ach && ach.total ? `${ach.unlocked}/${ach.total}` : null;

              return (
                <motion.div
                  key={entry.appId}
                  className={`${styles.card} ${conquered ? styles.cardConquered : ''}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i, 15) * 0.04 }}
                >
                  <div className={styles.cover}>
                    <SteamGameCover
                      fill
                      appId={entry.appId}
                      title={name}
                      headerUrl={game?.headerUrl}
                      iconUrl={game?.iconUrl}
                      alt={name}
                      rootClassName={styles.coverRoot}
                      imageClassName={`${styles.coverImg} ${conquered ? '' : styles.coverIncomplete}`}
                    />
                    <span className={`${styles.badge} ${styles[meta.className]}`}>
                      {meta.label}
                    </span>
                    {conquered && (
                      <span
                        className={styles.trophy}
                        title={perfected ? 'Perfected — 100%' : 'Conquered'}
                        aria-label={perfected ? 'Perfected, 100 percent' : 'Conquered'}
                      >
                        &#127942;
                      </span>
                    )}
                    {isAdminUi && (
                      <div className={styles.adminControls}>
                        <EditableItemControls index={index} />
                      </div>
                    )}
                  </div>
                  <div className={styles.info}>
                    <p className={styles.name} title={name}>
                      {name}
                    </p>
                    {conquered && (
                      <p className={styles.accomplishment}>
                        {perfected ? 'PERFECTED · 100%' : 'CONQUERED'}
                      </p>
                    )}
                    {achLabel && <p className={styles.ach}>{achLabel} ACH</p>}
                    {entry.note && <p className={styles.note}>{entry.note}</p>}
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
