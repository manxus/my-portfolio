import { motion } from 'framer-motion';
import { techCategories } from '../data/tech';
import styles from './Tech.module.css';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function Tech() {
  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {techCategories.map((cat) => (
        <motion.section key={cat.id} variants={fadeUp} className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>&gt;</span> {cat.title}
          </h2>
          <div className={styles.itemList}>
            {cat.items.map((item, i) => (
              <div key={i} className={styles.item}>
                <div className={styles.itemHeader}>
                  <h4 className={styles.itemName}>{item.name}</h4>
                  <div className={styles.tags}>
                    {item.tags.map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {item.specs && (
                  <p className={styles.specs}>{item.specs}</p>
                )}
                {item.level != null && (
                  <div className={styles.barRow}>
                    <div className={styles.barTrack}>
                      <motion.div
                        className={styles.barFill}
                        initial={{ width: 0 }}
                        animate={{ width: `${item.level}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                      />
                    </div>
                    <span className={styles.barLabel}>{item.level}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.section>
      ))}
    </motion.div>
  );
}
