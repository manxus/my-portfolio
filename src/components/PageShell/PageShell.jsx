import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import styles from './PageShell.module.css';

export default function PageShell({ title, subtitle, children }) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate]);

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate('/')}>
          <span className={styles.backArrow}>&larr;</span>
          <span>BACK TO MENU</span>
        </button>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <div className={styles.escHint}>ESC</div>
      </header>

      <div className={styles.divider} />

      <main className={styles.content}>{children}</main>
    </motion.div>
  );
}
