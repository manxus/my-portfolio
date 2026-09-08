import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import SteamGameCover from '../SteamGameCover/SteamGameCover';
import steamChangesData from '../../data/steam-changes.json';
import styles from './SteamChanges.module.css';

const { events } = steamChangesData;

const VISIBLE_ROWS = 4;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

/**
 * `today` / `yesterday` / `Mar 14`, computed at render time so a stale build
 * never claims something landed today when it landed last week.
 */
function relativeDay(date, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = date.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const days = Math.round((today - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** The nearest scrollable ancestor, or null when the page itself scrolls. */
function scrollParent(node) {
  for (let el = node?.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      return el;
    }
  }
  return null;
}

/**
 * Games that gained achievements since a recent sync.
 *
 * Renders nothing when the feed is empty, so a quiet week leaves the overview
 * exactly as it was rather than showing an empty shell.
 */
export default function SteamChanges({ games }) {
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef(null);
  const expanderRef = useRef(null);
  const restore = useRef(null);

  // Cover art lives on the library entry, not on the event -- the feed stores
  // only what it needs so the bundle stays small.
  const byAppId = useMemo(() => {
    const map = new Map();
    for (const game of games || []) map.set(game.appId, game);
    return map;
  }, [games]);

  useLayoutEffect(() => {
    const saved = restore.current;
    if (!saved) return;
    restore.current = null;

    if (saved.scroller) saved.scroller.scrollTop = saved.top;
    else window.scrollTo(0, saved.top);

    // Collapsing removes more height than there is scroll left, so the restore
    // clamps and strands the reader below the list; pull the button back instead.
    if (!expanded) expanderRef.current?.scrollIntoView({ block: 'nearest' });
  }, [expanded]);

  // Every hook above runs unconditionally -- this bail-out has to stay last.
  if (!events || events.length === 0) return null;

  const visible = expanded ? events : events.slice(0, VISIBLE_ROWS);
  const remaining = events.length - visible.length;

  // Expanding inserts rows above the button that was just clicked, and the
  // browser scrolls to compensate -- which reads as the list opening upwards.
  // Holding the scroll offset across the commit keeps it behaving like a
  // dropdown. Same fix as StatSection in GameStats/primitives.jsx.
  const toggleExpanded = () => {
    const scroller = scrollParent(listRef.current);
    restore.current = { scroller, top: scroller ? scroller.scrollTop : window.scrollY };
    setExpanded((value) => !value);
  };

  return (
    <section className={styles.banner}>
      <div className={styles.head}>
        <h2 className={styles.title}>LIBRARY CHANGES</h2>
      </div>

      <motion.ul
        ref={listRef}
        className={styles.list}
        variants={stagger}
        initial={expanded ? false : 'hidden'}
        animate="show"
      >
        {visible.map((event) => {
          const game = byAppId.get(event.appId);
          return (
            <motion.li
              key={`${event.appId}-${event.date}`}
              className={styles.row}
              variants={fadeUp}
            >
              <div className={styles.cover}>
                <SteamGameCover
                  appId={event.appId}
                  title={event.name}
                  headerUrl={game?.headerUrl}
                  libraryCapsuleUrl={game?.libraryCapsuleUrl}
                  libraryHeaderUrl={game?.libraryHeaderUrl}
                  iconUrl={game?.iconUrl}
                  variant="banner"
                  fill
                  alt=""
                />
              </div>
              <p className={styles.text}>
                <span className={styles.game}>{event.name}</span>{' '}
                <span className={styles.change}>
                  added {event.added} new achievement{event.added === 1 ? '' : 's'} (now{' '}
                  {event.total} total)
                </span>
              </p>
              <span className={styles.when}>{relativeDay(event.date)}</span>
            </motion.li>
          );
        })}
      </motion.ul>

      {(remaining > 0 || expanded) && (
        <button
          ref={expanderRef}
          type="button"
          className={styles.expander}
          onClick={toggleExpanded}
        >
          {expanded ? 'Show less' : `Show all ${events.length}`}
        </button>
      )}
    </section>
  );
}
