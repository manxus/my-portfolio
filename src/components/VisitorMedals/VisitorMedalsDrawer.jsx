import { useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useVisitorStore, getOrderedMedals, getEffectiveMedalOrder } from '../../stores/visitorStore';
import { useAdminStore } from '../../stores/adminStore';
import styles from './VisitorMedalsDrawer.module.css';

export default function VisitorMedalsDrawer({ onClose }) {
  const unlocked = useVisitorStore((s) => s.unlocked);
  const medalOrder = useVisitorStore((s) => s.medalOrder);
  const moveMedal = useVisitorStore((s) => s.moveMedal);
  const resetMedalOrder = useVisitorStore((s) => s.resetMedalOrder);
  const resetAchievements = useVisitorStore((s) => s.resetAchievements);
  const unlockAllAchievements = useVisitorStore((s) => s.unlockAllAchievements);
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const showAdminTools = import.meta.env.DEV && isAuthenticated;
  const modalRef = useRef(null);
  const closeRef = useRef(null);
  const medals = getOrderedMedals(medalOrder);

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

  useEffect(() => {
    const focusable = modalRef.current?.querySelectorAll(
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
  }, []);

  const handleResetAchievements = () => {
    if (!window.confirm('Reset all visitor achievements and progress?')) return;
    resetAchievements();
  };

  const handleUnlockAll = () => {
    unlockAllAchievements();
  };

  const handleCopyOrder = async () => {
    const order = getEffectiveMedalOrder(medalOrder);
    const payload = JSON.stringify(order, null, 2);

    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        ref={modalRef}
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="visitor-achievements-title"
      >
        <header className={styles.header}>
          <div>
            <h2 id="visitor-achievements-title" className={styles.title}>
              Achievements
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            title="Close (ESC)"
          >
            &#10005;
          </button>
        </header>

        <div className={styles.divider} />

        <div className={styles.body}>
          <ul className={styles.medalList}>
            {medals.map((medal, index) => {
              const isUnlocked = unlocked.includes(medal.id);
              const hideDescription = !isUnlocked;
              const showAdminHint = showAdminTools && hideDescription;

              return (
                <li
                  key={medal.id}
                  className={`${styles.medal} ${isUnlocked ? styles.medalUnlocked : ''} ${showAdminHint ? styles.medalAdminLocked : ''}`}
                >
                  {showAdminTools && (
                    <div className={styles.reorderControls}>
                      <button
                        type="button"
                        className={styles.reorderButton}
                        onClick={() => moveMedal(medal.id, 'up')}
                        disabled={index === 0}
                        aria-label={`Move ${medal.title} up`}
                        title="Move up"
                      >
                        &#9650;
                      </button>
                      <button
                        type="button"
                        className={styles.reorderButton}
                        onClick={() => moveMedal(medal.id, 'down')}
                        disabled={index === medals.length - 1}
                        aria-label={`Move ${medal.title} down`}
                        title="Move down"
                      >
                        &#9660;
                      </button>
                    </div>
                  )}
                  <span className={styles.medalIcon} aria-hidden="true">
                    {isUnlocked ? '\u2713' : '\u25C7'}
                  </span>
                  <div className={styles.medalContent}>
                    <p className={styles.medalTitle}>{medal.title}</p>
                    {!hideDescription && (
                      <p className={styles.medalDesc}>{medal.description}</p>
                    )}
                    {showAdminHint && (
                      <p className={styles.medalDescAdmin}>{medal.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {showAdminTools && (
          <div className={styles.adminFooter}>
            <button
              type="button"
              className={styles.unlockAllButton}
              onClick={handleUnlockAll}
            >
              Unlock all
            </button>
            <button
              type="button"
              className={styles.resetButton}
              onClick={handleResetAchievements}
            >
              Reset achievements
            </button>
            <button
              type="button"
              className={styles.copyOrderButton}
              onClick={handleCopyOrder}
            >
              Copy order
            </button>
            <button
              type="button"
              className={styles.resetOrderButton}
              onClick={resetMedalOrder}
            >
              Reset order
            </button>
          </div>
        )}

        <div className={styles.escHint}>ESC to close</div>
      </motion.div>
    </motion.div>
  );
}
