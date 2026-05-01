import { motion } from 'framer-motion';
import qaPortfolioData from '../data/qaPortfolio.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import styles from './QAPortfolio.module.css';

const { education, experience, playtests } = qaPortfolioData;

function playtestHref(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function QAPortfolio() {
  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* --- Experience --- */}
      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> PROFESSIONAL EXPERIENCE
        </h2>
        <EditableSection collection="qaPortfolio" dataKey="experience">
          <div className={styles.timeline}>
            {experience.map((job, i) => (
              <div key={i} className={styles.timelineItem}>
                <div className={styles.timelineDot} />
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      {job.title}
                      <EditableItemControls index={i} />
                    </h3>
                    <span className={styles.cardPeriod}>{job.period}</span>
                  </div>
                  <p className={styles.cardCompany}>{job.company}</p>
                  <p className={styles.cardDesc}>{job.description}</p>
                  {job.highlights && (
                    <ul className={styles.highlights}>
                      {job.highlights.map((h, j) => (
                        <li key={j}>{h}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </EditableSection>
      </motion.section>

      {/* --- Education --- */}
      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> EDUCATION
        </h2>
        <EditableSection collection="qaPortfolio" dataKey="education">
          <div>
            {education.map((edu, i) => (
              <div key={i} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>
                    {edu.degree}
                    <EditableItemControls index={i} />
                  </h3>
                  <span className={styles.cardPeriod}>{edu.period}</span>
                </div>
                <p className={styles.cardCompany}>{edu.institution}</p>
                <p className={styles.cardDesc}>{edu.description}</p>
              </div>
            ))}
          </div>
        </EditableSection>
      </motion.section>

      {/* --- Playtests --- */}
      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> PLAYTEST PARTICIPATIONS
        </h2>
        <EditableSection collection="qaPortfolio" dataKey="playtests">
          <div className={styles.playtestGrid}>
            {playtests.map((pt, i) => {
              const storeUrl = playtestHref(pt.url);
              return (
                <div key={i} className={styles.playtestCard}>
                  <span className={styles.playtestType}>
                    {pt.type}
                    <EditableItemControls index={i} />
                  </span>
                  <h4 className={styles.playtestTitle}>
                    {storeUrl ? (
                      <a
                        href={storeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.playtestTitleLink}
                      >
                        {pt.title}
                      </a>
                    ) : (
                      pt.title
                    )}
                  </h4>
                  <p className={styles.playtestMeta}>
                    {pt.studio} &middot; {pt.year}
                  </p>
                </div>
              );
            })}
          </div>
        </EditableSection>
      </motion.section>
    </motion.div>
  );
}
