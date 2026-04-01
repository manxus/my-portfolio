import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import mediaData from '../data/media.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import {
  parseYoutubeVideoId,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
} from '../utils/youtube';
import styles from './Media.module.css';

function galleryThumbnailSrc(item) {
  const thumb = typeof item.thumbnail === 'string' ? item.thumbnail.trim() : '';
  if (thumb) return thumb;
  const yt = parseYoutubeVideoId(item.videoUrl);
  if (yt) return youtubeThumbnailUrl(yt);
  return '';
}

const CATEGORIES = mediaData.categories;
const GALLERY_ITEMS = mediaData.galleryItems;

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
      <EditableSection collection="media" dataKey="galleryItems">
        <motion.div
          className={styles.grid}
          variants={stagger}
          initial="hidden"
          animate="show"
          key={filter}
        >
          {filtered.map((item) => {
            const fullIndex = GALLERY_ITEMS.findIndex((g) => g.id === item.id);
            const thumbSrc = galleryThumbnailSrc(item);
            return (
              <motion.div
                key={item.id}
                role="button"
                tabIndex={0}
                variants={fadeUp}
                className={styles.card}
                onClick={() => setLightbox(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setLightbox(item);
                  }
                }}
              >
                <div className={styles.imageWrap}>
                  {thumbSrc ? (
                    <img
                      src={thumbSrc}
                      alt={item.title}
                      className={styles.image}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.mediaPlaceholder} aria-hidden />
                  )}
                  <div className={styles.overlay}>
                    <span className={styles.overlayType}>{item.type}</span>
                  </div>
                </div>
                <div className={styles.cardInfo}>
                  <div className={styles.cardTitleRow}>
                    <h4 className={styles.cardTitle}>{item.title}</h4>
                    {fullIndex >= 0 && (
                      <EditableItemControls index={fullIndex} />
                    )}
                  </div>
                  <p className={styles.cardDesc}>{item.description}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </EditableSection>

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
              {(() => {
                const yt = parseYoutubeVideoId(lightbox.videoUrl);
                if (yt) {
                  return (
                    <div className={styles.lightboxEmbed}>
                      <iframe
                        title={lightbox.title}
                        src={youtubeEmbedUrl(yt)}
                        className={styles.lightboxIframe}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  );
                }
                const imgSrc =
                  (typeof lightbox.fullUrl === 'string' && lightbox.fullUrl.trim()) ||
                  galleryThumbnailSrc(lightbox);
                return imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={lightbox.title}
                    className={styles.lightboxImage}
                  />
                ) : (
                  <div className={styles.lightboxEmpty}>
                    Add a thumbnail, full image URL, or a supported YouTube link (video URL field).
                  </div>
                );
              })()}
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
