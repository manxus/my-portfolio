import { motion } from 'framer-motion';
import styles from './SideProjects.module.css';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function SideProjects() {
  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <motion.div className={styles.emptyState} variants={fadeUp}>
        <div className={styles.icon}>&#x1F6A7;</div>
        <h3 className={styles.heading}>UNDER CONSTRUCTION</h3>
        <p className={styles.message}>
          Side projects are being compiled. Check back soon for personal builds,
          experiments, and passion projects.
        </p>
        <div className={styles.statusBar}>
          <span className={styles.statusDot} />
          <span className={styles.statusText}>STATUS: IN DEVELOPMENT</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
