import { motion } from 'framer-motion';
import { changelog } from '../data/changelog';
import styles from './PatchNotes.module.css';

const KNOWN_ISSUES = [
  'Cake delivery system remains offline — investigation ongoing',
  'Exit button currently leads to recursive existential prompts',
  'Occasional phantom hover states in the Twitch dimension',
];

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

export default function PatchNotes() {
  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <section className={styles.knownIssues}>
        <h3 className={styles.sectionHeading}>&#9888; Known Issues</h3>
        {KNOWN_ISSUES.map((issue, i) => (
          <p key={i} className={styles.issue}>
            &bull; {issue}
          </p>
        ))}
      </section>

      <div className={styles.divider} />

      <div className={styles.versions}>
        {changelog.map((version, vi) => (
          <article key={version.version} className={styles.versionBlock}>
            <header className={styles.versionHeader}>
              <h3 className={styles.versionTag}>v{version.version}</h3>
              <span className={styles.versionDate}>
                {formatDate(version.date)}
              </span>
              {vi === 0 && (
                <span className={styles.latestBadge}>LATEST</span>
              )}
            </header>

            <div className={styles.entryList}>
              {version.entries.map((entry, i) => (
                <div key={i} className={styles.entry}>
                  <span
                    className={`${styles.entryTag} ${styles[`tag_${entry.type}`] || ''}`}
                  >
                    [{TAG_LABELS[entry.type]}]
                  </span>
                  <span className={styles.entryText}>{entry.text}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </motion.div>
  );
}
