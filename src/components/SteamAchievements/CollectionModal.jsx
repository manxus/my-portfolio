import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { setAdminEditorOpen } from '../../admin/editorLock';
import { isPerfected } from '../../utils/steamAchievements';
import { fmtDate, perfectedAt } from './achievementShared';
import GameBanner from './GameBanner';
import shared from './SteamAchievements.module.css';
import styles from './CollectionModal.module.css';

const TITLE_ID = 'steam-collection-title';

/**
 * One series from the Collections grid: every game in it with its completion.
 * Same shell as DayDetailModal and ReviewModal, so every popup on the Steam
 * page closes and traps focus the same way.
 */
export default function CollectionModal({ row, onClose }) {
  const closeRef = useRef(null);
  const panelRef = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // PageShell binds Escape to "back to the main menu" and only stands down
  // while this body flag is set; see DayDetailModal.
  useEffect(() => {
    setAdminEditorOpen(true);
    return () => setAdminEditorOpen(false);
  }, []);

  // Keeps Tab inside the dialog, so focus never reaches <body> and re-arms
  // the page's keyboard navigation.
  useEffect(() => {
    const focusable = panelRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];

    const trapFocus = (e) => {
      if (e.key !== 'Tab' || !first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', trapFocus);
    return () => window.removeEventListener('keydown', trapFocus);
  }, [row?.index]);

  if (!row) return null;

  const summary = row.invalid
    ? `Only you can see this — ${row.invalid}. Edit it or delete it.`
    : `${row.perfected} of ${row.tracked} perfected · ${row.totalAchievements} achievements`;

  return createPortal(
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          title="Close (ESC)"
          aria-label="Close series details"
        >
          &#10005;
        </button>

        <header
          className={`${styles.header} ${row.complete ? styles.headerComplete : ''}`}
        >
          <h2 id={TITLE_ID} className={styles.title}>
            {row.name.toUpperCase()}
          </h2>
          <p className={styles.sub}>
            {summary}
            {row.note ? ` · ${row.note}` : ''}
          </p>
        </header>

        <div className={styles.body}>
          <div className={shared.coverStrip}>
            {row.games.map((game) => {
              const perfect = isPerfected(game);
              const ach = game.achievements;
              const count = ach?.total ? `${ach.unlocked}/${ach.total}` : 'NO ACH';
              const doneOn = perfect ? fmtDate(perfectedAt(game)) : null;
              return (
                <div
                  key={game.appId}
                  className={`${shared.coverItem} ${perfect ? styles.itemPerfect : ''}`}
                  title={`${game.name} — ${count}${doneOn ? ` — perfected ${doneOn}` : ''}`}
                >
                  <GameBanner game={game} count={count} dim={!perfect} />
                </div>
              );
            })}
          </div>
        </div>

        <footer className={styles.footer}>
          <span className={styles.escHint}>ESC to close</span>
        </footer>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
