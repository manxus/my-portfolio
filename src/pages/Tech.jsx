import { motion } from 'framer-motion';
import techData from '../data/tech.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import styles from './Tech.module.css';

const { techCategories } = techData;

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
      <EditableSection collection="tech" dataKey="techCategories">
        <div>
          {techCategories.map((cat, ci) => (
            <motion.section key={cat.id} variants={fadeUp} className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>&gt;</span> {cat.title}
                <EditableItemControls index={ci} />
              </h2>
              <div className={styles.itemList}>
                {cat.items.map((item, i) => (
                  <div key={i} className={styles.item}>
                    <h4 className={styles.itemName}>{item.name}</h4>
                    <div className={styles.tags}>
                      {item.tags.map((tag) => (
                        <span key={tag} className={styles.tag}>{tag}</span>
                      ))}
                    </div>
                    {item.proficiency && (
                      <span className={styles.proficiency}>{item.proficiency}</span>
                    )}
                    {item.specs && <p className={styles.specs}>{item.specs}</p>}
                  </div>
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      </EditableSection>
    </motion.div>
  );
}
