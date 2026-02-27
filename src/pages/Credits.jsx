import { useRef, useLayoutEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Credits.module.css';

const CREDITS = [
  {
    heading: 'CREATED BY',
    items: ['Your Name'],
  },
  {
    heading: 'DESIGN & DEVELOPMENT',
    items: ['Concept, UI/UX Design, and Frontend Development'],
  },
  {
    heading: 'BUILT WITH',
    items: [
      'React 19 — UI Framework',
      'Vite 7 — Build Tooling',
      'Framer Motion — Animations',
      'Zustand — State Management',
      'Web Audio API — Sound Effects',
      'CSS Modules — Styling',
    ],
  },
  {
    heading: 'DESIGN INSPIRATION',
    items: [
      'Portal 2 — Valve Corporation',
      'Stitch by Google — Prototyping Tool',
    ],
  },
  {
    heading: 'FONTS',
    items: [
      'Oswald — Vernon Adams',
      'Share Tech Mono — Carrois Apostrophe',
      'Inter — Rasmus Andersson',
    ],
  },
  {
    heading: 'SPECIAL THANKS',
    items: [
      'Friends and colleagues who provided feedback',
      'The gaming and QA community',
      'Coffee — for powering late night sessions',
    ],
  },
];

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
          {CREDITS.map((section, i) => (
            <div key={i} className={styles.section}>
              {section.heading && (
                <h3 className={styles.heading}>{section.heading}</h3>
              )}
              {section.items.map((item, j) => (
                <p key={j} className={styles.item}>
                  {item}
                </p>
              ))}
            </div>
          ))}
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
