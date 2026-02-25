import { motion } from 'framer-motion';
import { timeline, personalInfo } from '../data/resume';
import styles from './Resume.module.css';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const TYPE_LABELS = {
  work: 'EMPLOYMENT',
  cert: 'CERTIFICATION',
  education: 'EDUCATION',
};

export default function Resume() {
  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Info header */}
      <motion.div variants={fadeUp} className={styles.header}>
        <div>
          <h2 className={styles.name}>{personalInfo.name}</h2>
          <p className={styles.role}>{personalInfo.title}</p>
          <p className={styles.location}>{personalInfo.location}</p>
        </div>
        <div className={styles.links}>
          {personalInfo.links.map((link) => (
            <a
              key={link.label}
              href={link.url}
              className={styles.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </a>
          ))}
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className={styles.downloadRow}>
        <button className={styles.downloadBtn}>
          &#8615; DOWNLOAD CV (PDF)
        </button>
      </motion.div>

      {/* Timeline */}
      <div className={styles.timeline}>
        {timeline.map((block) => (
          <motion.div key={block.year} variants={fadeUp} className={styles.yearBlock}>
            <div className={styles.yearLabel}>{block.year}</div>
            <div className={styles.entries}>
              {block.entries.map((entry, i) => (
                <div key={i} className={styles.entry}>
                  <span className={styles.entryType}>
                    {TYPE_LABELS[entry.type] || entry.type.toUpperCase()}
                  </span>
                  <h4 className={styles.entryTitle}>{entry.title}</h4>
                  <p className={styles.entryOrg}>
                    {entry.org}
                    <span className={styles.entryPeriod}>
                      {' '}
                      &middot; {entry.period}
                    </span>
                  </p>
                  <p className={styles.entryDesc}>{entry.description}</p>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
