import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Horizontal overflow state for a single-line scroll strip: which edges have
 * content hidden past them, plus a paged scroll for arrow buttons (mouse users
 * have no swipe). Attach `ref` and `onScroll` to the scrolling element.
 *
 * `contentKey` should change whenever the strip's content does. A
 * ResizeObserver only sees the strip's own box, so swapping in a longer list
 * at the same width would otherwise leave the arrows stale.
 */
export function useScrollOverflow(contentKey) {
  const ref = useRef(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  // A 1px tolerance absorbs the sub-pixel scrollLeft some browsers report at
  // the far end.
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setOverflow((cur) =>
      cur.left === left && cur.right === right ? cur : { left, right },
    );
  }, []);

  // ResizeObserver catches the strip changing width on its own (menu opening,
  // fonts loading); the window listener backs it up where it's unreliable.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  useEffect(() => {
    measure();
  }, [contentKey, measure]);

  const scrollByPage = useCallback((dir) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' });
  }, []);

  return { ref, overflow, onScroll: measure, scrollByPage };
}
