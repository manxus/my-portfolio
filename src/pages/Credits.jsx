import { useRef, useLayoutEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import creditsData from '../data/credits.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import styles from './Credits.module.css';

const CREDITS = creditsData.credits;

export default function Credits() {
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const [finished, setFinished] = useState(false);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    let offset = viewport.clientHeight + 40;
    content.style.transform = `translateY(${offset}px)`;
    let frame;

    const step = () => {
      offset -= 0.4;
      content.style.transform = `translateY(${offset}px)`;

      if (offset + content.scrollHeight <= 0) {
        setFinished(true);
        return;
      }
      frame = requestAnimationFrame(step);
    };

    const timeout = setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, 1200);

    return () => {
      clearTimeout(timeout);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.viewport} ref={viewportRef}>
        <div ref={contentRef} style={{ transform: 'translateY(100vh)' }}>
          <EditableSection collection="credits" dataKey="credits">
            <div>
              {CREDITS.map((section, i) => (
                <div key={i} className={styles.section}>
                  {section.heading && (
                    <h3 className={styles.heading}>
                      {section.heading}
                      <EditableItemControls index={i} />
                    </h3>
                  )}
                  {section.items.map((item, j) => (
                    <p key={j} className={styles.item}>
                      {item}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </EditableSection>
        </div>
      </div>

      <AnimatePresence>
        {finished && (
          <motion.div
            className={styles.thankYou}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
          >
            Thank you for playing
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
