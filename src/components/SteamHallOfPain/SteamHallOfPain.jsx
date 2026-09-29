import { useMemo } from 'react';
import { motion } from 'framer-motion';
import hallOfPainFile from '../../data/steam-hallofpain.json';
import EditableSection, { EditableItemControls } from '../../admin/EditableSection';
import SteamGameCover from '../SteamGameCover/SteamGameCover';
import { isPerfected } from '../../utils/steamAchievements';
import { useAdminStore } from '../../stores/adminStore';
import { useAdminCollection } from '../../hooks/useAdminCollection';
import styles from './SteamHallOfPain.module.css';

const defaultEntries = hallOfPainFile.entries || [];

// Order here is also the order the wings hang on the wall.
const STATUS_META = {
  conquered: {
    label: 'CONQUERED',
    subtitle: 'Beaten into submission. Gilded, lit and hung straight.',
    frameClass: 'frameConquered',
    statusClass: 'statusConquered',
  },
  brokeme: {
    label: 'BROKE ME',
    subtitle: 'I walked away. The frame cracked on the way out.',
    frameClass: 'frameBrokeme',
    statusClass: 'statusBrokeme',
  },
  bleeding: {
    label: 'STILL BLEEDING',
    subtitle: 'Mid-fight. Colour returns when they fall.',
    frameClass: 'frameBleeding',
    statusClass: 'statusBleeding',
  },
  dreading: {
    label: 'DREADING IT',
    subtitle: 'Waiting in the dark for their turn.',
    frameClass: 'frameDreading',
    statusClass: 'statusDreading',
  },
};

const WING_ORDER = Object.keys(STATUS_META);

// Deterministic per-game tilt so frames hang slightly crooked, but the same way every visit.
function tiltFor(appId, status) {
  if (status === 'conquered') return 0;
  const unit = (((appId * 2654435761) >>> 0) % 2001) / 1000 - 1; // [-1, 1]
  const max = status === 'brokeme' ? 3 : 1.2;
  return Number((unit * max).toFixed(2));
}

export default function SteamHallOfPain({ games }) {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const isAdminUi = import.meta.env.DEV && isAuthenticated;

  const [adminFile] = useAdminCollection('steam-hallofpain', isAdminUi);

  const sourceEntries = useMemo(
    () => (adminFile ? adminFile.entries || [] : defaultEntries),
    [adminFile],
  );

  const gameMap = useMemo(() => {
    const m = {};
    for (const g of games) m[g.appId] = g;
    return m;
  }, [games]);

  const wings = useMemo(() => {
    const byStatus = Object.fromEntries(WING_ORDER.map((s) => [s, []]));
    sourceEntries.forEach((entry, index) => {
      const game = gameMap[entry.appId];
      const perfected = isPerfected(game);
      // 100% achievements auto-promotes to Conquered regardless of stored status.
      const raw = perfected ? 'conquered' : entry.status;
      const status = STATUS_META[raw] ? raw : 'bleeding';
      byStatus[status].push({ entry, index, game, status, perfected });
    });
    return WING_ORDER.map((status) => ({ status, items: byStatus[status] })).filter(
      (w) => w.items.length > 0,
    );
  }, [sourceEntries, gameMap]);

  return (
    <EditableSection collection="steam-hallofpain" dataKey="entries">
      <div className={styles.container}>
        {sourceEntries.length === 0 ? (
          <p className={styles.empty}>
            No trials logged yet. The Hall of Pain awaits its first victim.
          </p>
        ) : (
          wings.map(({ status: wingStatus, items }) => {
            const wingMeta = STATUS_META[wingStatus];
            return (
              <section key={wingStatus} className={styles.wing}>
                <header className={styles.wingHeader}>
                  <h3 className={`${styles.wingTitle} ${styles[wingMeta.statusClass]}`}>
                    {wingMeta.label}
                    <span className={styles.wingCount}> · {items.length}</span>
                  </h3>
                  <span className={styles.wingRule} aria-hidden="true" />
                  <p className={styles.wingSubtitle}>{wingMeta.subtitle}</p>
                </header>

                <div className={styles.grid}>
                  {items.map(({ entry, index, game, status, perfected }, i) => {
                    const name = game?.name || `App ${entry.appId}`;
                    const meta = STATUS_META[status];
                    const conquered = status === 'conquered';
                    const ach = game?.achievements;
                    const achPct =
                      ach && ach.total ? Math.round((ach.unlocked / ach.total) * 100) : null;
                    const statusLine = conquered
                      ? perfected
                        ? 'PERFECTED · 100%'
                        : 'CONQUERED'
                      : meta.label;

                    return (
                      <motion.figure
                        key={entry.appId}
                        className={`${styles.piece} ${styles[meta.frameClass]}`}
                        style={{ '--tilt': `${tiltFor(entry.appId, status)}deg` }}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: Math.min(i, 15) * 0.04 }}
                      >
                        <span className={styles.hanger} aria-hidden="true" />
                        <div className={styles.frame}>
                          <div className={styles.mat}>
                            <div className={styles.art}>
                              <SteamGameCover
                                fill
                                variant="cover"
                                appId={entry.appId}
                                title={name}
                                headerUrl={game?.headerUrl}
                                libraryCapsuleUrl={game?.libraryCapsuleUrl}
                                libraryHeaderUrl={game?.libraryHeaderUrl}
                                iconUrl={game?.iconUrl}
                                alt={name}
                                rootClassName={styles.coverRoot}
                                imageClassName={`${styles.coverImg} ${conquered ? '' : styles.coverIncomplete}`}
                              />
                              <span className={styles.glass} aria-hidden="true" />
                              {isAdminUi && (
                                <div className={styles.adminControls}>
                                  <EditableItemControls index={index} />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <figcaption className={styles.plaque}>
                          <p className={styles.name} title={name}>
                            {name}
                          </p>
                          <p className={`${styles.statusLine} ${styles[meta.statusClass]}`}>
                            {conquered && (
                              <span
                                className={styles.trophy}
                                title={perfected ? 'Perfected — 100%' : 'Conquered'}
                                aria-hidden="true"
                              >
                                &#127942;
                              </span>
                            )}
                            {statusLine}
                          </p>
                          {achPct !== null && (
                            <div className={styles.ach}>
                              <span className={styles.achBar} aria-hidden="true">
                                <span
                                  className={styles.achFill}
                                  style={{ width: `${achPct}%` }}
                                />
                              </span>
                              <span className={styles.achLabel}>
                                {ach.unlocked}/{ach.total} ACH
                              </span>
                            </div>
                          )}
                          {entry.note && <p className={styles.note}>{entry.note}</p>}
                        </figcaption>
                      </motion.figure>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </EditableSection>
  );
}
