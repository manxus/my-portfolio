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

    /** Pixels per second — was ~0.4px/frame at 60Hz (~24px/s). */
    const SPEED_PX_PER_SEC = 42;
    /** Start with top of credits just below the visible credits area. */
    const GAP_BELOW_VIEWPORT = 40;

    let rafId = null;
    let timeoutId = null;
    let cancelled = false;
    let offset = 0;
    let lastTs = 0;

    const applyTransform = () => {
      content.style.transform = `translateY(${offset}px)`;
    };

    const runScroll = (now) => {
      const dt = Math.min((now - lastTs) / 1000, 0.05);
      lastTs = now;
      offset -= SPEED_PX_PER_SEC * dt;
      applyTransform();

      if (offset + content.scrollHeight <= 0) {
        setFinished(true);
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(runScroll);
    };

    /** Place text just below the visible area, then pause before scrolling. */
    const positionThenScheduleScroll = () => {
      if (cancelled) return;
      const h = viewport.clientHeight;
      if (h < 1) {
        rafId = requestAnimationFrame(positionThenScheduleScroll);
        return;
      }
      rafId = null;
      offset = h + GAP_BELOW_VIEWPORT;
      applyTransform();

      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (cancelled) return;
        lastTs = performance.now();
        rafId = requestAnimationFrame(runScroll);
      }, 1200);
    };

    rafId = requestAnimationFrame(positionThenScheduleScroll);

    return () => {
      cancelled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
      if (rafId != null) cancelAnimationFrame(rafId);
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
        <div ref={contentRef}>
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
