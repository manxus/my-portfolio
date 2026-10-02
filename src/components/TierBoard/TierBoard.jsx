import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useScrollOverflow } from '../../hooks/useScrollOverflow';
import styles from './TierBoard.module.css';

const DND_PAYLOAD_TYPE = 'application/x-tier-dnd';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

function cloneTiers(tierOrder, tiers) {
  const next = { ...tiers };
  for (const t of tierOrder) {
    next[t] = [...(tiers[t] || [])];
  }
  return next;
}

/**
 * Remove from fromTier at fromIndex, insert into toTier before the item at
 * targetIndex (or append if targetIndex is null). Returns null if no change.
 */
function moveItem(tierOrder, tiers, fromTier, fromIndex, toTier, targetIndex) {
  const next = cloneTiers(tierOrder, tiers);
  const fromArr = next[fromTier];
  if (!fromArr || fromIndex < 0 || fromIndex >= fromArr.length) return null;
  if (!next[toTier]) return null;
  if (fromTier === toTier && targetIndex === fromIndex) return null;

  const targetId = targetIndex != null ? next[toTier][targetIndex] : undefined;
  const [movedId] = fromArr.splice(fromIndex, 1);
  const toArr = next[toTier];
  let insertAt = toArr.length;
  if (targetId !== undefined) {
    insertAt = toArr.indexOf(targetId);
    if (insertAt === -1) insertAt = toArr.length;
  }
  toArr.splice(insertAt, 0, movedId);
  return next;
}

/**
 * One tier's items on a single line. Every tier keeps the same height however
 * many items it holds; overflow scrolls sideways, with fades that double as
 * arrow buttons for mouse users, the same pattern as the Steam tab strip.
 */
function TierStrip({
  tier,
  entries,
  contentKey,
  dndReady,
  dragOver,
  onDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
}) {
  const { ref, overflow, onScroll, scrollByPage } = useScrollOverflow(contentKey);

  const edge = (dir, visible, label, glyph) => (
    <button
      type="button"
      className={`${styles.edge} ${dir < 0 ? styles.edgeLeft : styles.edgeRight}`}
      data-visible={visible ? 'true' : undefined}
      onClick={() => scrollByPage(dir)}
      // Thumbnails aren't focusable, so these are the only keyboard route to
      // the hidden items; hidden arrows drop out of the tab order.
      tabIndex={visible ? 0 : -1}
      aria-hidden={visible ? undefined : true}
      aria-label={label}
    >
      {glyph}
    </button>
  );

  return (
    <div className={`${styles.tierGamesWrap} ${dragOver ? styles.tierGamesDragOver : ''}`}>
      <div
        ref={ref}
        className={styles.tierGames}
        data-tier-key={tier}
        onScroll={onScroll}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {entries.length === 0 && <span className={styles.tierEmpty}>---</span>}
        {entries.map(({ id, idx, title, node }) => (
          <div
            key={id}
            className={styles.gameThumb}
            title={dndReady ? `${title} — drag to reorder or move tiers` : title}
            draggable={dndReady}
            data-tier-idx={idx}
            onDragStart={(e) => onDragStart(e, idx)}
            onDragEnd={onDragEnd}
          >
            {node}
          </div>
        ))}
      </div>
      {edge(-1, overflow.left, 'Scroll tier left', '‹')}
      {edge(1, overflow.right, 'Scroll tier right', '›')}
    </div>
  );
}

/** The row of category buttons above a board. */
export function TierCategoryBar({ categories, active, onSelect, renderControls }) {
  return (
    <div className={styles.categoryBar}>
      {categories.map((category, i) => (
        // Not a <button>: the admin controls rendered inside are buttons, and
        // a button can't contain another.
        <div
          key={category}
          role="button"
          tabIndex={0}
          aria-pressed={active === category}
          className={`${styles.categoryBtn} ${active === category ? styles.categoryActive : ''}`}
          onClick={() => onSelect(category)}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(category);
            }
          }}
        >
          {category.toUpperCase()}
          {renderControls?.(i)}
        </div>
      ))}
    </div>
  );
}

/**
 * A tier ladder: one row per tier with its label, an optional hint and a
 * sideways-scrolling strip of items. What an item looks like is the caller's
 * business; this owns the layout and drag-and-drop between tiers.
 *
 * - `tierOrder`: tier keys top to bottom; `tiers` maps each key to item ids.
 * - `resolveItem(id)` returns `{ title, node }`, or null for an id with no
 *   item behind it (skipped, but its index is kept so drags stay correct).
 * - `hiddenWhenEmpty`: tiers left out entirely when empty outside admin.
 * - `onMove(nextTiers)` runs after a drop; only wired when `dndReady`.
 */
export default function TierBoard({
  boardKey,
  tierOrder,
  tiers,
  resolveItem,
  labelFor = (tier) => tier,
  hintFor,
  hiddenWhenEmpty = [],
  aspect = 'cover',
  dndReady = false,
  onMove,
}) {
  const [dragOverTier, setDragOverTier] = useState(null);

  useEffect(() => {
    const clearOver = () => setDragOverTier(null);
    document.addEventListener('dragend', clearOver);
    return () => document.removeEventListener('dragend', clearOver);
  }, []);

  const handleDragStart = (e, fromTier, fromIndex) => {
    if (!dndReady) return;
    const id = (tiers[fromTier] || [])[fromIndex];
    if (id == null) return;
    e.dataTransfer.setData(DND_PAYLOAD_TYPE, JSON.stringify({ fromTier, fromIndex }));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add(styles.gameThumbDragging);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove(styles.gameThumbDragging);
  };

  const handleDragOverTier = (e, tierKey) => {
    if (!dndReady) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTier(tierKey);
  };

  const handleDropOnTier = (e, toTier) => {
    if (!dndReady) return;
    e.preventDefault();
    setDragOverTier(null);

    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData(DND_PAYLOAD_TYPE) || '{}');
    } catch {
      return;
    }
    const { fromTier, fromIndex } = payload;
    if (fromTier == null || fromIndex == null) return;

    const thumb = e.target.closest('[data-tier-idx]');
    const rawTarget = thumb?.getAttribute('data-tier-idx');
    const targetIndex =
      rawTarget != null && thumb?.closest(`.${styles.tierGames}`)?.dataset.tierKey === toTier
        ? Number(rawTarget)
        : null;

    const nextTiers = moveItem(tierOrder, tiers, fromTier, fromIndex, toTier, targetIndex);
    if (nextTiers) onMove?.(nextTiers);
  };

  return (
    <motion.div
      key={boardKey}
      className={styles.tierGrid}
      data-aspect={aspect}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {tierOrder.map((tier) => {
        const ids = tiers[tier] || [];
        // Keep each item's index in ids: drag-and-drop moves by that index,
        // and ids with nothing behind them would shift it.
        const entries = ids
          .map((id, idx) => {
            const item = resolveItem(id);
            return item ? { id, idx, ...item } : null;
          })
          .filter(Boolean);
        if (hiddenWhenEmpty.includes(tier) && entries.length === 0 && !dndReady) return null;
        const hint = hintFor?.(tier);
        return (
          <motion.div
            key={tier}
            className={styles.tierRow}
            data-tier={tier}
            variants={fadeUp}
            aria-label={hint || `Tier ${labelFor(tier)}`}
          >
            <div className={styles.tierLabel} data-tier={tier}>
              <span>{labelFor(tier)}</span>
              {entries.length > 0 && (
                <span className={styles.tierCount}>{entries.length}</span>
              )}
            </div>
            {hint && (
              <div className={styles.tierDesc} data-tier={tier}>
                {hint}
              </div>
            )}
            <TierStrip
              tier={tier}
              entries={entries}
              contentKey={`${boardKey}:${ids.join(',')}`}
              dndReady={dndReady}
              dragOver={dragOverTier === tier}
              onDragOver={(e) => handleDragOverTier(e, tier)}
              onDrop={(e) => handleDropOnTier(e, tier)}
              onDragStart={(e, idx) => handleDragStart(e, tier, idx)}
              onDragEnd={handleDragEnd}
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
