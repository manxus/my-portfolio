import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import collectionsFile from '../../data/steam-collections.json';
import EditableSection, { EditableItemControls } from '../../admin/EditableSection';
import { useAdminStore } from '../../stores/adminStore';
import { useAdminCollection } from '../../hooks/useAdminCollection';
import { buildCollections, collectionsSummary } from '../../utils/steamCollections';
import CollectionCard from './CollectionCard';
import CollectionModal from './CollectionModal';
import shared from './SteamAchievements.module.css';
import styles from './SteamCollections.module.css';

const defaultDefs = collectionsFile.collections || [];

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
};

export default function SteamCollections({ games }) {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const isAdminUi = import.meta.env.DEV && isAuthenticated;

  const [openIndex, setOpenIndex] = useState(null);
  const [adminFile] = useAdminCollection('steam-collections', isAdminUi);

  const sourceDefs = useMemo(
    () => (adminFile ? adminFile.collections || [] : defaultDefs),
    [adminFile],
  );

  // Admins also see broken entries, which are hidden from the public page but
  // otherwise unreachable -- an entry with no name renders nothing to click.
  const rows = useMemo(
    () => buildCollections(games, sourceDefs, { includeInvalid: isAdminUi }),
    [games, sourceDefs, isAdminUi],
  );
  const summary = useMemo(() => collectionsSummary(rows), [rows]);

  const brokenCount = useMemo(() => rows.filter((r) => r.invalid).length, [rows]);

  const openRow = rows.find((r) => r.index === openIndex) || null;
  const closeModal = useCallback(() => setOpenIndex(null), []);

  return (
    <EditableSection collection="steam-collections" dataKey="collections">
      <div className={styles.container}>
        {rows.length === 0 ? (
          <p className={shared.empty}>
            No series defined yet — run{' '}
            <code className={shared.code}>
              node scripts/seed-steam-collections.js
            </code>{' '}
            to pull real franchise data from Wikidata, then curate it here.
          </p>
        ) : (
          <>
            <div className={styles.summaryBar}>
              <p className={styles.summary}>
                <strong className={styles.summaryNum}>{summary.complete}</strong>{' '}
                COMPLETE SERIES
                <span className={styles.summarySep}>·</span>
                <strong className={styles.summaryNum}>{summary.total}</strong>{' '}
                TRACKED
                <span className={styles.summarySep}>·</span>
                <strong className={styles.summaryNum}>
                  {summary.perfectedGames}
                </strong>{' '}
                GAMES PERFECTED
                {brokenCount > 0 && (
                  <>
                    <span className={styles.summarySep}>·</span>
                    <strong className={styles.summaryBroken}>{brokenCount}</strong>{' '}
                    NEED FIXING
                  </>
                )}
              </p>
            </div>

            <motion.div
              className={styles.grid}
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              {rows.map((row) => (
                <motion.div key={row.index} className={styles.gridItem} variants={fadeUp}>
                  <CollectionCard row={row} onOpen={() => setOpenIndex(row.index)}>
                    {isAdminUi && (
                      <div className={styles.cardAdmin}>
                        {/* Cards sort by completion, not file order, so moving
                            the entry in the file would change nothing here. */}
                        <EditableItemControls index={row.index} hideMove />
                      </div>
                    )}
                  </CollectionCard>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
      </div>

      <AnimatePresence>
        {openRow && (
          <CollectionModal key={openRow.index} row={openRow} onClose={closeModal} />
        )}
      </AnimatePresence>
    </EditableSection>
  );
}
