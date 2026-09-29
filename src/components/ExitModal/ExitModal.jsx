import { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { trackExitConfirm } from '../../hooks/useVisitorTracking';
import styles from './ExitModal.module.css';

export default function ExitModal({ onClose }) {
  const handleExit = () => {
    trackExitConfirm();
    window.open('about:blank', '_self');
    window.close();
  };

  // Enter is left to whichever button has focus (CANCEL, on open), so it can
  // never quit the page from under a focused CANCEL.
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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="exit-modal-title"
        aria-describedby="exit-modal-message"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="exit-modal-title" className={styles.title}>WARNING</h2>
        <div className={styles.divider} />
        <p id="exit-modal-message" className={styles.message}>
          Unsaved progress will be lost.
          <br />
          Are you sure you want to quit?
        </p>
        <div className={styles.buttons}>
          <button className={styles.confirm} onClick={handleExit}>
            YES, EXIT
          </button>
          <button className={styles.cancel} onClick={onClose} autoFocus>
            CANCEL
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
