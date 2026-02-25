import { motion } from 'framer-motion';
import { references } from '../data/references';
import styles from './References.module.css';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function References() {
  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <motion.p variants={fadeUp} className={styles.intro}>
        Professional references available upon request. Testimonials from
        colleagues and managers I have worked with.
      </motion.p>

      <div className={styles.grid}>
        {references.map((ref, i) => (
          <motion.div key={i} variants={fadeUp} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.initials}>
                {ref.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div>
                <h4 className={styles.refName}>{ref.name}</h4>
                <p className={styles.refTitle}>{ref.title}</p>
                <p className={styles.refCompany}>
                  {ref.company} &middot; {ref.relationship}
                </p>
              </div>
            </div>

            {ref.quote && <p className={styles.quote}>{ref.quote}</p>}

            <div className={styles.availability}>
              <span
                className={`${styles.dot} ${ref.available ? styles.dotAvailable : styles.dotUnavailable}`}
              />
              <span>
                {ref.available
                  ? 'Available for contact'
                  : 'Contact upon request'}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
