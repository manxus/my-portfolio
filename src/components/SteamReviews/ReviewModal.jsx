import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import SteamGameCover from '../SteamGameCover/SteamGameCover';
import { setAdminEditorOpen } from '../../admin/editorLock';
import styles from './ReviewModal.module.css';

const TITLE_ID = 'steam-review-title';

/**
 * Paragraph breaks, tolerating both newline conventions in the data — most
 * bodies use \n\n but six were written with \r\n\r\n, and splitting on \n\n
 * alone renders those as one unbroken wall of text.
 */
function paragraphsOf(text) {
  return String(text ?? '')
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** "2026-08-19" -> "19 August 2026", the way Steam dates a review. */
function formatPosted(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ReviewModal({ review, game, displayName, onClose }) {
  const closeRef = useRef(null);
  const panelRef = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /**
   * PageShell binds Escape to "back to the main menu" and only stands down when
   * this flag is set, so without it closing the popup would also navigate away.
   * It mutes the arrow-key menu navigation too. Named for the admin editor, but
   * it is only a body dataset flag.
   */
  useEffect(() => {
    setAdminEditorOpen(true);
    return () => setAdminEditorOpen(false);
  }, []);

  // Keeps Tab inside the dialog — focus reaching <body> would re-arm the
  // navigation the flag above suppresses.
  useEffect(() => {
    const focusable = panelRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];

    const trapFocus = (e) => {
      if (e.key !== 'Tab' || !first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', trapFocus);
    return () => window.removeEventListener('keydown', trapFocus);
  }, []);

  if (!review) return null;

  const appId = Number(review.appId);
  const recommended = Boolean(review.recommended);
  // Total playtime from the library join. Two reviewed games aren't in the
  // library at all, so this line is dropped rather than shown as "0 hrs".
  const hours = game?.playtimeHours;
  const paragraphs = paragraphsOf(review.text);

  return createPortal(
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          title="Close (ESC)"
          aria-label="Close review"
        >
          &#10005;
        </button>

        <header className={styles.header}>
          <SteamGameCover
            variant="banner"
            appId={appId}
            title={displayName}
            headerUrl={game?.headerUrl}
            libraryCapsuleUrl={game?.libraryCapsuleUrl}
            libraryHeaderUrl={game?.libraryHeaderUrl}
            iconUrl={game?.iconUrl}
            alt={displayName}
            rootClassName={styles.coverRoot}
            imageClassName={styles.coverImage}
          />

          <div className={styles.verdict}>
            <p className={styles.gameName}>{displayName}</p>
            <p
              className={`${styles.verdictLine} ${
                recommended ? styles.recommended : styles.notRecommended
              }`}
            >
              {recommended ? 'Recommended' : 'Not Recommended'}
            </p>
            {hours != null && (
              <p className={styles.hours}>{hours.toFixed(1)} hrs on record</p>
            )}
          </div>
        </header>

        <div className={styles.divider} />

        <div className={styles.body}>
          <h2 id={TITLE_ID} className={styles.reviewTitle}>
            {review.title}
          </h2>
          {paragraphs.map((p, i) => (
            <p key={i} className={styles.text}>
              {p}
            </p>
          ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.ratingRow}>
          <span className={styles.ratingValue}>{review.rating}/10</span>
          <div className={styles.ratingTrack}>
            <div
              className={styles.ratingFill}
              style={{ width: `${review.rating * 10}%` }}
            />
          </div>
        </div>

        {(review.pros?.length > 0 || review.cons?.length > 0) && (
          <div className={styles.proscons}>
            {review.pros?.length > 0 && (
              <div className={styles.column}>
                <span className={styles.columnLabel}>+ PROS</span>
                <ul className={styles.bulletList}>
                  {review.pros.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {review.cons?.length > 0 && (
              <div className={styles.column}>
                <span className={styles.columnLabel}>- CONS</span>
                <ul className={styles.bulletList}>
                  {review.cons.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <footer className={styles.footer}>
          <span className={styles.posted}>Posted {formatPosted(review.date)}</span>
          <span className={styles.escHint}>ESC to close</span>
        </footer>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
