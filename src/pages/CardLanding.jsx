import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import resumeData from '../data/resume.json';
import EditableSection from '../admin/EditableSection';
import CommsPanel from '../components/CommsPanel/CommsPanel';
import styles from './CardLanding.module.css';

const { personalInfo } = resumeData;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function CardLanding() {
  const navigate = useNavigate();

  return (
    <motion.div
      className={styles.wrap}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUp} className={styles.contactCol}>
        <EditableSection collection="resume" dataKey="personalInfo" singleton>
          <div className={styles.card}>
            <h2 className={styles.name}>{personalInfo.name}</h2>
            <p className={styles.role}>{personalInfo.title}</p>
            <p className={styles.location}>{personalInfo.location}</p>
          </div>
        </EditableSection>
      </motion.div>

      <motion.div variants={fadeUp} className={styles.contactCol}>
        <CommsPanel contactCard className={styles.commsOnCard} />
      </motion.div>

      <motion.div variants={fadeUp} className={styles.contactCol}>
        <button
          type="button"
          className={styles.fullSiteBtn}
          onClick={() => navigate('/')}
        >
          PORTFOLIO
        </button>
      </motion.div>
    </motion.div>
  );
}
