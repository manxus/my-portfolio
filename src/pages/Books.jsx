import { motion } from 'framer-motion';
import defaultBooksData from '../data/books.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import styles from './Books.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

function coverSrc(item) {
  const url = typeof item.coverUrl === 'string' ? item.coverUrl.trim() : '';
  return url;
}

function resolveReadUrl(url) {
  const href = typeof url === 'string' ? url.trim() : '';
  if (!href) return '';
  if (href.startsWith('/')) return href;
  return /^https?:\/\//i.test(href) ? href : `https://${href}`;
}

function openReadUrl(url) {
  const resolved = resolveReadUrl(url);
  if (!resolved) return;
  if (resolved.startsWith('/')) {
    window.location.assign(resolved);
    return;
  }
  window.open(resolved, '_blank', 'noopener,noreferrer');
}

function hasRead(item) {
  return item.read === true;
}

function isFavorite(item) {
  return item.featured === true;
}

function sortShelfBooks(books) {
  return books
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aRank = isFavorite(a.item) ? 0 : 1;
      const bRank = isFavorite(b.item) ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

function BookCover({ item }) {
  const cover = coverSrc(item);
  if (cover) {
    return (
      <img
        src={cover}
        alt={item.title}
        className={styles.image}
        loading="lazy"
      />
    );
  }
  return <div className={styles.coverPlaceholder} aria-hidden />;
}

function BookCard({ item, index }) {
  const hasLink = Boolean(resolveReadUrl(item.readUrl));
  const author = typeof item.author === 'string' ? item.author.trim() : '';

  return (
    <motion.div
      role={hasLink ? 'link' : undefined}
      tabIndex={hasLink ? 0 : undefined}
      variants={fadeUp}
      className={`${styles.card}${hasLink ? ` ${styles.cardClickable}` : ''}`}
      onClick={() => hasLink && openReadUrl(item.readUrl)}
      onKeyDown={(e) => {
        if (!hasLink) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openReadUrl(item.readUrl);
        }
      }}
    >
      <div className={styles.imageWrap}>
        <BookCover item={item} />
        {isFavorite(item) && (
          <span className={styles.favoriteBadge} aria-label="Favorite">
            ★
          </span>
        )}
        {hasRead(item) && (
          <div className={styles.overlay}>
            <span className={styles.readBadge}>READ</span>
          </div>
        )}
      </div>
      <div className={styles.cardInfo}>
        <div className={styles.cardTitleRow}>
          <h4 className={styles.cardTitle}>{item.title}</h4>
          {index >= 0 && <EditableItemControls index={index} />}
        </div>
        {author && <p className={styles.cardAuthor}>{author}</p>}
        {item.description && (
          <p className={styles.cardDesc}>{item.description}</p>
        )}
      </div>
    </motion.div>
  );
}

export default function Books() {
  const books = defaultBooksData.books ?? [];
  const shelfBooks = sortShelfBooks(books);

  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <EditableSection collection="books" dataKey="books">
        <div className={styles.catalogWrap}>
          {books.length === 0 ? (
            <p className={styles.emptyCatalog}>No books logged yet.</p>
          ) : (
            <motion.section variants={fadeUp} className={styles.catalogSection}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>&gt;</span> SHELF
              </h2>
              <motion.div className={styles.grid} variants={stagger}>
                {shelfBooks.map((item) => (
                  <BookCard
                    key={item.id}
                    item={item}
                    index={books.findIndex((entry) => entry.id === item.id)}
                  />
                ))}
              </motion.div>
            </motion.section>
          )}
        </div>
      </EditableSection>
    </motion.div>
  );
}
