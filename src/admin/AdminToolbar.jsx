import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminStore } from '../stores/adminStore';
import styles from './AdminToolbar.module.css';

// In production a save is a commit to GitHub that Vercel deliberately does not build (see
// ignoreCommand in vercel.json), so a batch of edits goes live in one deploy: PUBLISH. Say so
// after each save, or a save that "didn't change anything" reads as broken. Dev writes the JSON
// in place and the page re-pulls it, so it needs neither the notice nor the button.
const NOTICE_MS = 5000;

/** While a deploy runs the count only drops once it finishes, so look again until it does. */
const BUILDING_POLL_MS = 20000;

const IS_LIVE = !import.meta.env.DEV;

export default function AdminToolbar() {
  const logout = useAdminStore((s) => s.logout);
  const lastSavedAt = useAdminStore((s) => s.lastSavedAt);
  const getPublishStatus = useAdminStore((s) => s.getPublishStatus);
  const publish = useAdminStore((s) => s.publish);
  const [minimized, setMinimized] = useState(false);
  const [notice, setNotice] = useState(null);
  const [status, setStatus] = useState(null);
  const [publishing, setPublishing] = useState(false);

  const showNotice = useCallback((text) => setNotice({ text, key: Date.now() }), []);

  const refreshStatus = useCallback(() => {
    if (!IS_LIVE) return;
    getPublishStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [getPublishStatus]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus, lastSavedAt]);

  useEffect(() => {
    if (!IS_LIVE || lastSavedAt == null) return;
    showNotice('Saved — press PUBLISH when you are done');
  }, [lastSavedAt, showNotice]);

  useEffect(() => {
    if (!status?.building) return undefined;
    const timer = setTimeout(refreshStatus, BUILDING_POLL_MS);
    return () => clearTimeout(timer);
  }, [status, refreshStatus]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await publish();
      showNotice('Publishing — live in about a minute');
      setStatus((prev) => ({ ...prev, building: true }));
    } catch (err) {
      showNotice(err.message || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const pending = status?.pending;
  let publishLabel = 'PUBLISH';
  if (publishing) publishLabel = 'PUBLISHING…';
  else if (status?.building) publishLabel = 'DEPLOYING…';
  else if (pending > 0) publishLabel = `PUBLISH (${pending})`;
  else if (pending === 0) publishLabel = 'UP TO DATE';

  return (
    <motion.div
      className={styles.toolbar}
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <AnimatePresence>
        {notice && (
          <motion.span
            key={notice.key}
            className={styles.notice}
            role="status"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {notice.text}
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
            {IS_LIVE && (
              <button
                className={`${styles.btn} ${pending > 0 ? styles.btnPrimary : ''}`}
                onClick={handlePublish}
                // Publishing with nothing pending still deploys, which is harmless and the only
                // way out if the count is wrong -- so only block it while a request is in flight.
                disabled={publishing}
                title="Put every saved change on the live site in one deploy"
              >
                {publishLabel}
              </button>
            )}
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
