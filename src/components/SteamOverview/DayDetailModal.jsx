import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import AchievementCard from '../SteamAchievements/AchievementCard';
import { setAdminEditorOpen } from '../../admin/editorLock';
import styles from './DayDetailModal.module.css';

const TITLE_ID = 'steam-day-title';

/**
 * A single day from the unlock calendar: everything unlocked that day, plus
 * any game perfected on it. Mirrors ReviewModal so both popups on this page
 * behave the same.
 */
export default function DayDetailModal({ day, items, perfected, onClose }) {
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

  /**
   * PageShell binds Escape to "back to the main menu" and only stands down when
   * this flag is set, so without it closing the popup would also navigate away.
   * It mutes the arrow-key menu navigation too. Named for the admin editor, but
   * it is only a body dataset flag.
   */
  useEffect(() => {
    setAdminEditorOpen(true);
    return () => setAdminEditorOpen(false);
  }, []);

  // Keeps Tab inside the dialog — focus reaching <body> would re-arm the
  // navigation the flag above suppresses.
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
  }, [day?.key]);

  if (!day) return null;

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
          aria-label="Close day details"
        >
          &#10005;
        </button>

        <header className={styles.header}>
          <h2 id={TITLE_ID} className={styles.date}>
            {day.label}
          </h2>
          <p className={styles.sub}>
            {day.count} achievement{day.count === 1 ? '' : 's'} unlocked
          </p>
        </header>

        {perfected && (
          <p className={styles.perfect}>
            <span className={styles.perfectStar}>&#9733;</span>
            Perfected: {perfected.join(', ')}
          </p>
        )}

        <div className={styles.body}>
          <div className={styles.achGrid}>
            {items.map((a) => (
              <AchievementCard key={`${a.appId}-${a.apiName}`} ach={a} />
            ))}
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
