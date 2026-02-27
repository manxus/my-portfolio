import { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import styles from './PatchModal.module.css';

const TAG_LABELS = {
  added: 'ADDED',
  fixed: 'FIXED',
  changed: 'CHANGED',
  removed: 'REMOVED',
};

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function PatchModal({ patch, onClose }) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!patch) return null;

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>v{patch.version}</h2>
            <p className={styles.date}>{formatDate(patch.date)}</p>
          </div>
          <button className={styles.closeButton} onClick={onClose} title="Close (ESC)">
            &#10005;
          </button>
        </header>

        <div className={styles.divider} />

        <div className={styles.entryList}>
          {patch.entries.map((entry, i) => (
            <div key={i} className={styles.entry}>
              <span className={`${styles.entryTag} ${styles[`tag_${entry.type}`] || ''}`}>
                [{TAG_LABELS[entry.type]}]
              </span>
              <span className={styles.entryText}>{entry.text}</span>
            </div>
          ))}
        </div>

        <div className={styles.escHint}>ESC to close</div>
      </motion.div>
    </motion.div>
  );
}
