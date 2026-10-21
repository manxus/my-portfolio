import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useScrollOverflow } from '../../hooks/useScrollOverflow';
import styles from './TierBoard.module.css';

const DND_PAYLOAD_TYPE = 'application/x-tier-dnd';

// Touch drag: hold a thumb this long to pick it up. Moving further than the
// tolerance first is a scroll, and is left to the browser.
const LONG_PRESS_MS = 300;
const MOVE_TOLERANCE_PX = 8;
/** How close to the screen's top/bottom, or a strip's sides, starts auto-scrolling. */
const PAGE_EDGE_PX = 60;
const STRIP_EDGE_PX = 40;
const SCROLL_STEP_PX = 12;

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
 * Where a drop at `el` lands: the tier whose row it is over, and the index of
 * the thumb it goes in front of when it is over a thumb in that tier (null
 * appends). Shared by the mouse and touch paths so both follow one rule.
 */
function resolveDrop(el) {
  if (!el) return null;
  // Over the row's label or an edge arrow counts as that row's strip.
  const strip =
    el.closest('[data-tier-key]') ??
    el.closest(`.${styles.tierRow}`)?.querySelector('[data-tier-key]');
  if (!strip) return null;
  const thumb = el.closest('[data-tier-idx]');
  const inStrip = thumb && thumb.closest('[data-tier-key]') === strip;
  return {
    toTier: strip.dataset.tierKey,
    targetIndex: inStrip ? Number(thumb.dataset.tierIdx) : null,
    strip,
    thumb: inStrip ? thumb : null,
  };
}

function scrollParentOf(el) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return document.scrollingElement;
}

/**
 * Mobile browsers don't fire HTML5 drag events for fingers, so touch gets its
 * own path: long-press a thumb to lift it, drag a copy under the finger, and
 * let go over a tier. The listeners are native and non-passive because only
 * those can stop the page scrolling once an item is lifted.
 */
function useTouchDrag(board, enabled, { tierOrder, tiers, onMove, setDragOverTier }) {
  const latest = useRef(null);
  useEffect(() => {
    latest.current = { tierOrder, tiers, onMove };
  });

  useEffect(() => {
    if (!enabled || !board) return undefined;
    let press = null;

    const markTarget = (thumb) => {
      if (press.marked === thumb) return;
      press.marked?.classList.remove(styles.gameThumbDropBefore);
      press.marked = thumb;
      thumb?.classList.add(styles.gameThumbDropBefore);
    };

    const updateTarget = () => {
      const drop = resolveDrop(document.elementFromPoint(press.x, press.y));
      press.drop = drop;
      setDragOverTier(drop?.toTier ?? null);
      markTarget(drop?.thumb && drop.thumb !== press.thumb ? drop.thumb : null);
    };

    const placeGhost = () => {
      press.ghost.style.transform =
        `translate(${press.x - press.offsetX}px, ${press.y - press.offsetY}px) scale(1.08)`;
    };

    const autoScroll = () => {
      if (!press?.dragging) return;
      const { x, y, scroller } = press;
      let scrolled = false;
      if (y < PAGE_EDGE_PX || y > window.innerHeight - PAGE_EDGE_PX) {
        scroller.scrollTop += y < PAGE_EDGE_PX ? -SCROLL_STEP_PX : SCROLL_STEP_PX;
        scrolled = true;
      }
      const strip = press.drop?.strip;
      if (strip) {
        const rect = strip.getBoundingClientRect();
        if (x < rect.left + STRIP_EDGE_PX || x > rect.right - STRIP_EDGE_PX) {
          strip.scrollLeft += x < rect.left + STRIP_EDGE_PX ? -SCROLL_STEP_PX : SCROLL_STEP_PX;
          scrolled = true;
        }
      }
      if (scrolled) updateTarget();
      press.raf = requestAnimationFrame(autoScroll);
    };

    const pickUp = () => {
      const { thumb } = press;
      const rect = thumb.getBoundingClientRect();
      const ghost = thumb.cloneNode(true);
      ghost.classList.add(styles.dragGhost);
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      ghost.removeAttribute('data-tier-idx');
      ghost.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ghost);
      thumb.classList.add(styles.gameThumbDragging);
      Object.assign(press, {
        dragging: true,
        ghost,
        offsetX: press.x - rect.left,
        offsetY: press.y - rect.top,
        scroller: scrollParentOf(board),
      });
      placeGhost();
      updateTarget();
      navigator.vibrate?.(15);
      press.raf = requestAnimationFrame(autoScroll);
    };

    const end = () => {
      if (!press) return;
      clearTimeout(press.timer);
      cancelAnimationFrame(press.raf);
      press.ghost?.remove();
      press.thumb.classList.remove(styles.gameThumbDragging);
      press.marked?.classList.remove(styles.gameThumbDropBefore);
      if (press.dragging) setDragOverTier(null);
      press = null;
    };

    const onStart = (e) => {
      if (press || e.touches.length !== 1) {
        end();
        return;
      }
      // The Rankings edit/delete buttons sit on the thumb; a tap there is theirs.
      if (e.target.closest('button')) return;
      const thumb = e.target.closest('[data-tier-idx]');
      const strip = thumb?.closest('[data-tier-key]');
      if (!strip) return;
      const touch = e.touches[0];
      press = {
        thumb,
        fromTier: strip.dataset.tierKey,
        fromIndex: Number(thumb.dataset.tierIdx),
        x: touch.clientX,
        y: touch.clientY,
        timer: setTimeout(pickUp, LONG_PRESS_MS),
      };
    };

    const onTouchMove = (e) => {
      if (!press) return;
      const touch = e.touches[0];
      if (!press.dragging) {
        if (Math.hypot(touch.clientX - press.x, touch.clientY - press.y) > MOVE_TOLERANCE_PX) end();
        return;
      }
      e.preventDefault();
      press.x = touch.clientX;
      press.y = touch.clientY;
      placeGhost();
      updateTarget();
    };

    const onEnd = (e) => {
      if (press?.dragging) {
        // Otherwise the lift ends in a click on whatever is under the finger.
        e.preventDefault();
        const { drop, fromTier, fromIndex } = press;
        if (drop) {
          const { tierOrder: order, tiers: current, onMove: move } = latest.current;
          const next = moveItem(order, current, fromTier, fromIndex, drop.toTier, drop.targetIndex);
          if (next) move?.(next);
        }
      }
      end();
    };

    // A long press also opens the image menu (Android) or starts the
    // browser's own drag on draggable elements; neither should win.
    const suppress = (e) => {
      if (press) e.preventDefault();
    };

    board.addEventListener('touchstart', onStart, { passive: true });
    board.addEventListener('touchmove', onTouchMove, { passive: false });
    board.addEventListener('touchend', onEnd, { passive: false });
    board.addEventListener('touchcancel', end);
    board.addEventListener('contextmenu', suppress);
    board.addEventListener('dragstart', suppress, true);
    return () => {
      end();
      board.removeEventListener('touchstart', onStart);
      board.removeEventListener('touchmove', onTouchMove);
      board.removeEventListener('touchend', onEnd);
      board.removeEventListener('touchcancel', end);
      board.removeEventListener('contextmenu', suppress);
      board.removeEventListener('dragstart', suppress, true);
    };
  }, [board, enabled, setDragOverTier]);
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
  // State, not a ref: the board remounts per boardKey and the touch listeners
  // have to move to the new element.
  const [board, setBoard] = useState(null);

  useTouchDrag(board, dndReady, { tierOrder, tiers, onMove, setDragOverTier });

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

    const drop = resolveDrop(e.target);
    const targetIndex = drop?.toTier === toTier ? drop.targetIndex : null;

    const nextTiers = moveItem(tierOrder, tiers, fromTier, fromIndex, toTier, targetIndex);
    if (nextTiers) onMove?.(nextTiers);
  };

  return (
    <motion.div
      key={boardKey}
      ref={setBoard}
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
