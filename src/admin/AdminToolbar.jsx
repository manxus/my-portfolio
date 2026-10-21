import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminStore } from '../stores/adminStore';
import styles from './AdminToolbar.module.css';

// In production a save is a commit to GitHub, and the page only reflects it once
// Vercel redeploys. Say so, or a save that "didn't change anything" reads as broken.
// Dev writes the JSON in place and the page re-pulls it, so it needs no notice.
const SAVED_NOTICE_MS = 5000;

export default function AdminToolbar() {
  const logout = useAdminStore((s) => s.logout);
  const lastSavedAt = useAdminStore((s) => s.lastSavedAt);
  const [minimized, setMinimized] = useState(false);
  const [dismissedAt, setDismissedAt] = useState(null);
  const showSavedNotice = !import.meta.env.DEV && lastSavedAt != null && lastSavedAt !== dismissedAt;

  useEffect(() => {
    if (import.meta.env.DEV || lastSavedAt == null) return undefined;
    const timer = setTimeout(() => setDismissedAt(lastSavedAt), SAVED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [lastSavedAt]);

  return (
    <motion.div
      className={styles.toolbar}
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <AnimatePresence>
        {showSavedNotice && (
          <motion.span
            key={lastSavedAt}
            className={styles.notice}
            role="status"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            Saved — live in about a minute
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {minimized ? (
          <motion.button
            key="dot"
            className={styles.dot}
            onClick={() => setMinimized(false)}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            title="Expand admin toolbar"
          />
        ) : (
          <motion.div
            key="bar"
            className={styles.bar}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <span className={styles.indicator}>ADMIN MODE</span>
            <button className={styles.btn} onClick={() => setMinimized(true)}>
              &#8722;
            </button>
            <button className={styles.btn} onClick={logout}>
              LOGOUT
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
