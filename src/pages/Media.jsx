import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Media.module.css';

const CATEGORIES = ['All', 'Photography', 'Video', 'Creative'];

const GALLERY_ITEMS = [
  {
    id: 1,
    type: 'Photography',
    title: 'Sample Photo 1',
    description: 'Replace with your actual photo and description.',
    thumbnail: 'https://placehold.co/600x400/182028/5f8f8f?text=Photo+1',
    fullUrl: null,
  },
  {
    id: 2,
    type: 'Photography',
    title: 'Sample Photo 2',
    description: 'Another placeholder — add your photography here.',
    thumbnail: 'https://placehold.co/600x400/182028/5f8f8f?text=Photo+2',
    fullUrl: null,
  },
  {
    id: 3,
    type: 'Video',
    title: 'Sample Video',
    description: 'A placeholder for your video content.',
    thumbnail: 'https://placehold.co/600x400/182028/5f8f8f?text=Video',
    videoUrl: null,
  },
  {
    id: 4,
    type: 'Photography',
    title: 'Sample Photo 3',
    description: 'Landscape or game screenshot.',
    thumbnail: 'https://placehold.co/600x400/182028/5f8f8f?text=Photo+3',
    fullUrl: null,
  },
  {
    id: 5,
    type: 'Creative',
    title: 'Creative Project',
    description: 'A creative project or artwork.',
    thumbnail: 'https://placehold.co/600x400/182028/5f8f8f?text=Creative',
    fullUrl: null,
  },
  {
    id: 6,
    type: 'Photography',
    title: 'Sample Photo 4',
    description: 'Another placeholder image.',
    thumbnail: 'https://placehold.co/600x400/182028/5f8f8f?text=Photo+4',
    fullUrl: null,
  },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function Media() {
  const [filter, setFilter] = useState('All');
  const [lightbox, setLightbox] = useState(null);

  const filtered =
    filter === 'All'
      ? GALLERY_ITEMS
      : GALLERY_ITEMS.filter((item) => item.type === filter);

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Filter tabs */}
      <div className={styles.filters}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`${styles.filterBtn} ${filter === cat ? styles.filterActive : ''}`}
            onClick={() => setFilter(cat)}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Gallery grid */}
      <motion.div
        className={styles.grid}
        variants={stagger}
        initial="hidden"
        animate="show"
        key={filter}
      >
        {filtered.map((item) => (
          <motion.button
            key={item.id}
            variants={fadeUp}
            className={styles.card}
            onClick={() => setLightbox(item)}
          >
            <div className={styles.imageWrap}>
              <img
                src={item.thumbnail}
                alt={item.title}
                className={styles.image}
                loading="lazy"
              />
              <div className={styles.overlay}>
                <span className={styles.overlayType}>{item.type}</span>
              </div>
            </div>
            <div className={styles.cardInfo}>
              <h4 className={styles.cardTitle}>{item.title}</h4>
              <p className={styles.cardDesc}>{item.description}</p>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            className={styles.lightbox}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
          >
            <motion.div
              className={styles.lightboxContent}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightbox.fullUrl || lightbox.thumbnail}
                alt={lightbox.title}
                className={styles.lightboxImage}
              />
              <div className={styles.lightboxInfo}>
                <h3>{lightbox.title}</h3>
                <p>{lightbox.description}</p>
              </div>
              <button
                className={styles.lightboxClose}
                onClick={() => setLightbox(null)}
              >
                &times;
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
