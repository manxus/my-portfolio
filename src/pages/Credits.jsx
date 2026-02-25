import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
  {
    heading: '',
    items: ['THANK YOU FOR PLAYING'],
  },
];

export default function Credits() {
  const scrollRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;

    const el = scrollRef.current;
    let frame;
    let start;

    const step = (timestamp) => {
      if (!start) start = timestamp;
      el.scrollTop += 0.5;
      if (el.scrollTop >= el.scrollHeight - el.clientHeight) {
        setAutoScroll(false);
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
  }, [autoScroll]);

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div
        className={styles.scrollArea}
        ref={scrollRef}
        onWheel={() => setAutoScroll(false)}
        onTouchStart={() => setAutoScroll(false)}
      >
        <div className={styles.spacer} />
        {CREDITS.map((section, i) => (
          <div key={i} className={styles.section}>
            {section.heading && (
              <h3 className={styles.heading}>{section.heading}</h3>
            )}
            {section.items.map((item, j) => (
              <p
                key={j}
                className={
                  !section.heading ? styles.finalText : styles.item
                }
              >
                {item}
              </p>
            ))}
          </div>
        ))}
        <div className={styles.spacer} />
      </div>
    </motion.div>
  );
}
