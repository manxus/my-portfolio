import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import styles from './EditableSection.module.css';

const ADMIN_PORTAL = () => document.getElementById('admin-portal') ?? document.body;

/**
 * Replaces window.confirm for destructive admin actions. Chrome lets a user tick
 * "prevent this page from creating additional dialogs" after a couple of native
 * prompts, after which confirm() silently returns false and the action looks dead.
 */
export default function ConfirmDialog({
  message,
  error = '',
  busy = false,
  confirmLabel = 'DELETE',
  onConfirm,
  onCancel,
}) {
  return createPortal(
    <motion.div
      className={styles.confirmBackdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className={styles.confirmBox}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <p className={styles.confirmMsg}>{message}</p>
        {error && <p className={styles.confirmError}>{error}</p>}
        <div className={styles.confirmActions}>
          <button type="button" className={styles.confirmCancel} onClick={onCancel}>
            CANCEL
          </button>
          <button
            type="button"
            className={styles.confirmDelete}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? 'WORKING...' : confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    ADMIN_PORTAL(),
  );
}
