import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminStore } from '../stores/adminStore';
import styles from './AdminToolbar.module.css';

export default function AdminToolbar() {
  const logout = useAdminStore((s) => s.logout);
  const [minimized, setMinimized] = useState(false);

  return (
    <motion.div
      className={styles.toolbar}
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
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
