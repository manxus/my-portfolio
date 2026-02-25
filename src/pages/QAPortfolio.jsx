import { motion } from 'framer-motion';
import { education, experience, playtests, certificates, skills } from '../data/qaPortfolio';
import styles from './QAPortfolio.module.css';

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
        <div className={styles.timeline}>
          {experience.map((job, i) => (
            <div key={i} className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>{job.title}</h3>
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
      </motion.section>

      {/* --- Education --- */}
      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> EDUCATION
        </h2>
        {education.map((edu, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>{edu.degree}</h3>
              <span className={styles.cardPeriod}>{edu.period}</span>
            </div>
            <p className={styles.cardCompany}>{edu.institution}</p>
            <p className={styles.cardDesc}>{edu.description}</p>
          </div>
        ))}
      </motion.section>

      {/* --- Playtests --- */}
      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> PLAYTEST PARTICIPATIONS
        </h2>
        <div className={styles.playtestGrid}>
          {playtests.map((pt, i) => (
            <div key={i} className={styles.playtestCard}>
              <span className={styles.playtestType}>{pt.type}</span>
              <h4 className={styles.playtestTitle}>{pt.title}</h4>
              <p className={styles.playtestMeta}>
                {pt.studio} &middot; {pt.year}
              </p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* --- Certificates --- */}
      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> CERTIFICATES
        </h2>
        <div className={styles.certGrid}>
          {certificates.map((cert, i) => (
            <div key={i} className={styles.certCard}>
              <h4 className={styles.certName}>{cert.name}</h4>
              <p className={styles.certMeta}>
                {cert.issuer} &middot; {cert.year}
              </p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* --- Skills & Tools --- */}
      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> SKILLS &amp; TOOLS
        </h2>
        <div className={styles.skillsGrid}>
          {skills.map((group, i) => (
            <div key={i} className={styles.skillGroup}>
              <h4 className={styles.skillCategory}>{group.category}</h4>
              <div className={styles.skillTags}>
                {group.items.map((item, j) => (
                  <span key={j} className={styles.skillTag}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}
