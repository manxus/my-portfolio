import { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisitorStore } from '../../stores/visitorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSound } from '../../hooks/useSound';
import styles from './UnlockToast.module.css';

export default function UnlockToast() {
  const pendingUnlock = useVisitorStore((s) => s.pendingUnlock);
  const clearPendingUnlock = useVisitorStore((s) => s.clearPendingUnlock);
  const setDrawerOpen = useVisitorStore((s) => s.setDrawerOpen);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const { play } = useSound();
  const timerRef = useRef(null);

  useEffect(() => {
    if (!pendingUnlock) return;

    play('unlock');

    timerRef.current = setTimeout(() => {
      clearPendingUnlock();
    }, 2800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pendingUnlock, clearPendingUnlock, play]);

  const handleDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    clearPendingUnlock();
  }, [clearPendingUnlock]);

  const handleView = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    clearPendingUnlock();
    setDrawerOpen(true);
  }, [clearPendingUnlock, setDrawerOpen]);

  return (
    <AnimatePresence>
      {pendingUnlock && (
        <motion.div
          className={styles.toast}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          initial={reduceMotion ? false : { opacity: 0, y: 16, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 8, x: '-50%' }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
        >
          <span className={styles.badge} aria-hidden="true">
            &#9670;
          </span>
          <div className={styles.content}>
            <p className={styles.label}>Achievement unlocked</p>
            <p className={styles.title}>{pendingUnlock.title}</p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.viewButton}
              onClick={handleView}
            >
              View
            </button>
            <button
              type="button"
              className={styles.dismiss}
              onClick={handleDismiss}
              aria-label="Dismiss notification"
            >
              &#10005;
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
