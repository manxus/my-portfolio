import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import collectionsFile from '../../data/steam-collections.json';
import EditableSection, { EditableItemControls } from '../../admin/EditableSection';
import { useAdminStore } from '../../stores/adminStore';
import { buildCollections, collectionsSummary } from '../../utils/steamCollections';
import { isPerfected } from '../../utils/steamAchievements';
import CollectionCard from './CollectionCard';
import GameBanner from './GameBanner';
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
  const getData = useAdminStore((s) => s.getData);
  const isAdminUi = import.meta.env.DEV && isAuthenticated;

  const [openIndex, setOpenIndex] = useState(null);
  const [adminDefs, setAdminDefs] = useState(null);

  const gridRef = useRef(null);
  const [cols, setCols] = useState(1);

  const sourceDefs = isAdminUi && adminDefs ? adminDefs : defaultDefs;

  const refreshAdminDefs = useCallback(async () => {
    try {
      const data = await getData('steam-collections');
      setAdminDefs(data.collections || []);
    } catch (err) {
      console.error('Failed to load Steam collections:', err);
    }
  }, [getData]);

  useEffect(() => {
    if (!isAdminUi) {
      setAdminDefs(null);
      return;
    }
    refreshAdminDefs();
  }, [isAdminUi, refreshAdminDefs]);

  useEffect(() => {
    if (!isAdminUi) return undefined;
    const onSaved = (e) => {
      if (e.detail?.collection !== 'steam-collections') return;
      refreshAdminDefs();
    };
    window.addEventListener('admin-collection-saved', onSaved);
    return () => window.removeEventListener('admin-collection-saved', onSaved);
  }, [isAdminUi, refreshAdminDefs]);

  // Admins also see broken entries, which are hidden from the public page but
  // otherwise unreachable -- an entry with no name renders nothing to click.
  const rows = useMemo(
    () => buildCollections(games, sourceDefs, { includeInvalid: isAdminUi }),
    [games, sourceDefs, isAdminUi],
  );
  const summary = useMemo(() => collectionsSummary(rows), [rows]);

  const visible = rows;

  const brokenCount = useMemo(() => rows.filter((r) => r.invalid).length, [rows]);

  const openAt = visible.findIndex((r) => r.index === openIndex);
  const openRow = openAt >= 0 ? visible[openAt] : null;

  /**
   * Column count, measured from a card's width rather than read off
   * `grid-template-columns` -- with `auto-fill` the computed value does not
   * reliably report the tracks actually in use.
   *
   * The detail panel drops in after the end of the clicked card's row, so this
   * has to be right or the panel appears in the wrong place.
   */
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;

    const measure = () => {
      const card = grid.querySelector(`.${styles.gridItem}`);
      if (!card) return;
      const style = getComputedStyle(grid);
      const gap = parseFloat(style.columnGap || style.gap) || 0;
      const cardWidth = card.getBoundingClientRect().width;
      if (cardWidth <= 0) return;
      setCols(Math.max(1, Math.round((grid.clientWidth + gap) / (cardWidth + gap))));
    };

    measure();
    // ResizeObserver covers the sidebar collapsing and other in-page reflows;
    // the resize listener is the fallback where it does not fire.
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(grid);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [visible.length]);

  const detailPanel = openRow ? (
    <motion.section
      key={`detail-${openRow.index}`}
      className={styles.detail}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
    >
      <div className={styles.detailHead}>
        <h2 className={shared.blockTitle}>{openRow.name.toUpperCase()}</h2>
        <button
          type="button"
          className={styles.detailClose}
          onClick={() => setOpenIndex(null)}
          aria-label="Close"
        >
          &times;
        </button>
      </div>
      <p className={shared.blockHint}>
        {openRow.invalid
          ? `Only you can see this — ${openRow.invalid}. Edit it or delete it.`
          : `${openRow.perfected} of ${openRow.tracked} perfected · ${openRow.totalAchievements} achievements`}
        {openRow.note ? ` · ${openRow.note}` : ''}
      </p>

      <div className={shared.coverStrip}>
        {openRow.games.map((game) => {
          const perfect = isPerfected(game);
          const ach = game.achievements;
          const count = ach?.total ? `${ach.unlocked}/${ach.total}` : 'NO ACH';
          return (
            <div
              key={game.appId}
              className={`${shared.coverItem} ${perfect ? styles.itemPerfect : ''}`}
              title={`${game.name} — ${count}`}
            >
              <GameBanner game={game} count={count} dim={!perfect} />
            </div>
          );
        })}
      </div>
    </motion.section>
  ) : null;

  const gridChildren = visible.map((row) => (
    <motion.div key={row.index} className={styles.gridItem} variants={fadeUp}>
      <CollectionCard
        row={row}
        expanded={openIndex === row.index}
        onToggle={() => setOpenIndex((cur) => (cur === row.index ? null : row.index))}
      >
        {isAdminUi && (
          <div className={styles.cardAdmin}>
            {/* Cards sort by completion, not file order, so moving the entry
                in the file would change nothing here. */}
            <EditableItemControls index={row.index} hideMove />
          </div>
        )}
      </CollectionCard>
    </motion.div>
  ));

  if (detailPanel) {
    // End of the clicked card's row, so the panel opens directly beneath it
    // rather than after every card.
    const rowEnd = Math.min((Math.floor(openAt / cols) + 1) * cols, gridChildren.length);
    gridChildren.splice(rowEnd, 0, detailPanel);
  }

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
              ref={gridRef}
              className={styles.grid}
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              <AnimatePresence initial={false}>{gridChildren}</AnimatePresence>
            </motion.div>

          </>
        )}
      </div>
    </EditableSection>
  );
}
