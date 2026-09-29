import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import SectionGlyph from './SectionGlyph';
import { setAdminEditorOpen } from '../../admin/editorLock';
import shared from './SteamMilestones.module.css';
import styles from './MilestoneModal.module.css';

const TITLE_ID = 'steam-milestone-title';

const STATE_LABEL = {
  complete: 'Unlocked',
  next: 'In progress',
  future: 'Locked',
};

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function progressLine(section, m) {
  if (m.complete) return `Cleared — you're at ${section.currentLabel} now`;
  return `${section.currentLabel} of ${m.thresholdBadge}`;
}

/**
 * What fills the story slot for this rung. Every state produces the same four
 * lines so the slot, and therefore the popup, is the same height whichever
 * rung is selected: stepping from an unlocked rung to a locked one used to add
 * or drop the whole event card.
 */
function storyFor(section, m, index) {
  if (m.event) {
    return {
      kind: 'event',
      kicker: m.eventKicker,
      label: m.event.label,
      sub: m.event.sub,
      note: m.event.note,
      image: m.event.image,
      imageKind: m.event.imageKind,
    };
  }

  if (m.complete) {
    return {
      kind: 'undated',
      kicker: 'Reached',
      label: 'No date on record',
      sub: section.dated
        ? 'Steam has no timestamp for the event that crossed this rung.'
        : 'This ladder has no dated history to look it up in.',
      note: null,
    };
  }

  const ahead = index - section.focusIndex;
  return {
    kind: 'pending',
    kicker: m.state === 'next' ? 'Up next' : 'Locked',
    label: m.toGo,
    sub:
      m.state === 'next'
        ? `${m.pctLabel} of the way there`
        : `${ahead} rung${ahead === 1 ? '' : 's'} past the one in progress`,
    note: null,
  };
}

/**
 * One rung of one ladder: what it took, when it fell and what crossed it, with
 * the whole ladder underneath to step through. Shell and keyboard handling
 * follow DayDetailModal and ReviewModal so every popup on this page behaves
 * the same.
 */
export default function MilestoneModal({ section, index, onSelect, onClose }) {
  const closeRef = useRef(null);
  const panelRef = useRef(null);
  const n = section.milestones.length;
  const m = section.milestones[index];

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  /**
   * PageShell binds Escape to "back to the main menu" and only stands down when
   * this flag is set, so without it closing the popup would also navigate away.
   * It mutes the arrow-key menu navigation too.
   */
  useEffect(() => {
    setAdminEditorOpen(true);
    return () => setAdminEditorOpen(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Re-queried on every Tab: stepping rungs swaps what is in the panel, so
      // a list captured on open would go stale. Keeps focus off <body>, which
      // would re-arm the navigation the flag above suppresses.
      if (e.key === 'Tab') {
        const focusable = panelRef.current?.querySelectorAll(FOCUSABLE);
        const first = focusable?.[0];
        const last = focusable?.[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }

      const target = {
        ArrowLeft: index - 1,
        ArrowUp: index - 1,
        ArrowRight: index + 1,
        ArrowDown: index + 1,
        Home: 0,
        End: n - 1,
      }[e.key];
      if (target === undefined) return;
      e.preventDefault();
      if (target >= 0 && target < n && target !== index) onSelect(target);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, n, onClose, onSelect]);

  // Keep the selected rung visible in the ladder list, and if focus was already
  // in that list, carry it along with the selection.
  useEffect(() => {
    const row = panelRef.current?.querySelector('[aria-current="true"]');
    if (!row) return;
    row.scrollIntoView({ block: 'nearest' });
    if (document.activeElement?.dataset.ladderRow) row.focus();
  }, [index]);

  const story = storyFor(section, m, index);

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
        className={styles.panel}
        data-section={section.sectionId}
        data-state={m.state}
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
          aria-label="Close milestone details"
        >
          &#10005;
        </button>

        <header className={styles.header} aria-live="polite">
          <p className={styles.kicker}>
            <SectionGlyph
              id={section.sectionId}
              className={styles.kickerGlyph}
              aria-hidden="true"
            />
            <span>{section.heading}</span>
            <span className={styles.step}>
              Rung {index + 1} of {n}
            </span>
          </p>
          <h2 id={TITLE_ID} className={styles.title}>
            {m.title}
          </h2>
          <div className={styles.metaRow}>
            <span className={styles.badge}>{m.thresholdBadge}</span>
            <span className={styles.stateChip}>{STATE_LABEL[m.state]}</span>
            {m.dateLabel && <span className={styles.date}>{m.dateLabel}</span>}
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.story} data-kind={story.kind}>
            <div className={styles.storyMedia} data-kind={story.imageKind ?? 'glyph'}>
              {story.image ? (
                <img
                  className={styles.storyImage}
                  src={story.image}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <SectionGlyph
                  id={section.sectionId}
                  className={styles.storyGlyph}
                  aria-hidden="true"
                />
              )}
            </div>
            {/* All four lines always render, blank ones as a non-breaking
                space, and each is clamped to one line — that is what holds
                the slot at a fixed height. */}
            <div className={styles.storyText}>
              <span className={styles.storyKicker}>{story.kicker}</span>
              <span className={styles.storyLabel} title={story.label}>
                {story.label}
              </span>
              <span
                className={styles.storySub}
                title={story.sub ?? undefined}
                aria-hidden={story.sub ? undefined : 'true'}
              >
                {story.sub ?? ' '}
              </span>
              <span
                className={styles.storyNote}
                aria-hidden={story.note ? undefined : 'true'}
              >
                {story.note ?? ' '}
              </span>
            </div>
          </div>

          <div className={styles.progress}>
            <div className={styles.meterRow}>
              <div className={shared.progressTrack} aria-hidden="true">
                <div
                  className={shared.progressFill}
                  style={{ width: `${m.pct}%` }}
                />
              </div>
              <span className={shared.pctLabel}>{m.pctLabel}</span>
            </div>
            <p className={styles.progressText}>{progressLine(section, m)}</p>
          </div>

          {section.extra && (
            <p className={styles.extra}>
              <span className={styles.extraLabel}>{section.extra.label}</span>
              <span>{section.extra.value}</span>
            </p>
          )}

          <ol className={styles.ladder} aria-label={`${section.heading} ladder`}>
            {section.milestones.map((r, i) => (
              <li key={r.key}>
                <button
                  type="button"
                  className={styles.ladderRow}
                  data-state={r.state}
                  data-ladder-row="true"
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => onSelect(i)}
                >
                  <span className={styles.ladderMark} aria-hidden="true" />
                  <span className={styles.ladderBadge}>{r.thresholdBadge}</span>
                  <span className={styles.ladderTitle}>{r.title}</span>
                  <span className={styles.ladderEnd}>
                    {r.dateLabel ?? (r.state === 'next' ? r.pctLabel : '')}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.stepButton}
            // aria-disabled rather than disabled: a disabled button drops
            // focus to <body> the moment you step onto the first rung.
            onClick={() => index > 0 && onSelect(index - 1)}
            aria-disabled={index === 0 || undefined}
          >
            &#8249; Prev
          </button>
          <span className={styles.keyHint}>&larr; &rarr; to step · ESC to close</span>
          <button
            type="button"
            className={styles.stepButton}
            onClick={() => index < n - 1 && onSelect(index + 1)}
            aria-disabled={index === n - 1 || undefined}
          >
            Next &#8250;
          </button>
        </footer>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
