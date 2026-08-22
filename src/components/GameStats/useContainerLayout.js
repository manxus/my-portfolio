import { useState, useEffect } from 'react';

/** Below this an equipment row drops its trailing stats onto a second line. */
export const COMPACT_ROW_WIDTH = 560;
/** Side-by-side panels only pair up once both stay readable. */
export const SIDE_BY_SIDE_WIDTH = 720;
/** Below this the service-record grid drops from four columns to two. */
export const WIDE_GRID_WIDTH = 620;

/** What the stat-list pages need: a compact row mode, paired panels, and a record-grid width. */
const defaultMeasure = (width) => ({
  isCompact: width < COMPACT_ROW_WIDTH,
  isSideBySide: width >= SIDE_BY_SIDE_WIDTH,
  statColumns: width >= WIDE_GRID_WIDTH ? 4 : 2,
});

/**
 * Container-width layout, observed rather than queried.
 *
 * The game pages render inside two shells with very different content widths (the desktop
 * split-view reserves 420px for the menu), so a window media query would be wrong in both
 * directions. `measure` maps a width to whatever that page's layout flags are -- RuneScape's tile
 * grid breaks at different widths than the stat lists do, so it passes its own.
 */
export default function useContainerLayout(ref, measure = defaultMeasure) {
  const [layout, setLayout] = useState(() => measure(0));

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const update = () => setLayout(measure(el.offsetWidth));

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
    // `measure` is expected to be a module-scope constant; taking it as a dep would resubscribe on
    // every render for any caller that inlines it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  return layout;
}
