import { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import styles from './ExitModal.module.css';

export default function ExitModal({ onClose }) {
  const handleExit = () => {
    window.open('about:blank', '_self');
    window.close();
  };

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') handleExit();
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
        <h2 className={styles.title}>WARNING</h2>
        <div className={styles.divider} />
        <p className={styles.message}>
          Unsaved progress will be lost.
          <br />
          Are you sure you want to quit?
        </p>
        <div className={styles.buttons}>
          <button className={styles.confirm} onClick={handleExit}>
            YES, EXIT
          </button>
          <button className={styles.cancel} onClick={onClose}>
            CANCEL
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
