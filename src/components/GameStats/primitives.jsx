import { useState, useRef, useLayoutEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { fadeUp, listVariants } from './motion';
import { formatNumber, formatStat } from './format';
import styles from './gamePage.module.css';

/** How many rows a stat list shows before the expander. */
export const VISIBLE_ROWS = 12;

/**
 * Game art arrives as a single full-colour asset for every game but Battlefield, whose line art
 * ships a per-theme pair. Passing `iconUrlLight` opts into the swap; leaving it off renders the one
 * asset. When the sync script could not resolve any art at all the initials stand in.
 */
export function GameIcon({ name, iconUrl, iconUrlLight, alt = '' }) {
  if (!iconUrl && !iconUrlLight) {
    return (
      <span className={styles.iconFallback} aria-hidden="true">
        {String(name ?? '?')
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 3)
          .toUpperCase()}
      </span>
    );
  }

  return (
    <span className={styles.iconWrap}>
      {iconUrl && (
        <img
          src={iconUrl}
          alt={alt}
          className={`${styles.icon}${iconUrlLight ? ` ${styles.iconDark}` : ''}`}
          loading="lazy"
        />
      )}
      {iconUrlLight && (
        <img
          src={iconUrlLight}
          alt={iconUrl ? '' : alt}
          className={`${styles.icon} ${styles.iconLight}`}
          loading="lazy"
        />
      )}
    </span>
  );
}

export function Stat({ value, label, title }) {
  return (
    <div className={styles.stat} title={title}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

/** The headline slab at the top of a page: capsule art, identity, and a row of summary stats. */
export function Dossier({ capsuleUrl, capsuleAlt, name, avatarUrl, subtitle, tag, stats, fetchedAt }) {
  const [artFailed, setArtFailed] = useState(false);
  const synced = fetchedAt ? new Date(fetchedAt).toISOString().slice(0, 10) : '';
  const showArt = capsuleUrl && !artFailed;

  return (
    <div className={styles.dossier}>
      {showArt && (
        <div className={styles.capsule}>
          <img
            src={capsuleUrl}
            alt={capsuleAlt}
            className={styles.capsuleImage}
            onError={() => setArtFailed(true)}
          />
        </div>
      )}

      <div className={styles.dossierBody}>
        <div className={styles.identity}>
          <h2 className={styles.playerName}>{name}</h2>
          {avatarUrl && <img src={avatarUrl} alt="" className={styles.avatar} loading="lazy" />}
        </div>
        <p className={styles.subtitle}>
          {subtitle}
          {tag && <span className={styles.platform}> · {tag}</span>}
        </p>

        <div className={styles.statRow}>
          {stats.map((stat) => (
            <Stat key={stat.label} value={stat.value} label={stat.label} title={stat.title} />
          ))}
        </div>

        {synced && <p className={styles.syncedAt}>SYNCED {synced}</p>}
      </div>
    </div>
  );
}

/**
 * A grid of raw counters, for numbers that carry no scale worth drawing a bar against.
 *
 * The 1px rules between cells are the container's own background showing through the grid gaps,
 * which means an unfilled slot in a short last row shows that wash as a solid block instead. Nine
 * entries across two columns is a real case (Satisfactory's construction grid), so the row is padded
 * out with empty cells that paint the same face as the real ones.
 */
export function RecordGrid({ entries, columns }) {
  const fillers = columns > 0 ? (columns - (entries.length % columns)) % columns : 0;

  return (
    <div className={styles.recordGrid} data-columns={columns}>
      {entries.map((entry) => (
        <div key={entry.key} className={styles.recordCell}>
          <span className={styles.recordValue} title={entry.title ?? formatNumber(entry.value)}>
            {entry.display ?? formatStat(entry.value)}
          </span>
          <span className={styles.recordLabel}>{entry.label}</span>
        </div>
      ))}
      {Array.from({ length: fillers }, (_, i) => (
        <div key={`filler-${i}`} className={styles.recordCell} aria-hidden="true" />
      ))}
    </div>
  );
}

export function FilterChips({ options, active, onSelect, allLabel, allCount }) {
  return (
    <div className={styles.chipRow} role="group" aria-label="Filter by category">
      <button
        type="button"
        className={`${styles.chip}${active === null ? ` ${styles.chipActive}` : ''}`}
        aria-pressed={active === null}
        onClick={() => onSelect(null)}
      >
        {allLabel} <span className={styles.chipCount}>{allCount}</span>
      </button>
      {options.map((option) => (
        <button
          key={option.name}
          type="button"
          className={`${styles.chip}${active === option.name ? ` ${styles.chipActive}` : ''}`}
          aria-pressed={active === option.name}
          onClick={() => onSelect(option.name)}
        >
          {option.label ?? option.name} <span className={styles.chipCount}>{option.count}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * One row of a stat list: art, a name, a headline figure, a bar, and up to three trailing figures.
 * `barPct` is precomputed by the sync scripts so the row never has to know the list's maximum.
 */
export function StatRow({
  name,
  iconUrl,
  iconUrlLight,
  value,
  barPct,
  barTitle,
  barDone,
  stats = [],
  isCompact,
  noIcon = false,
}) {
  return (
    <motion.li
      variants={fadeUp}
      className={`${styles.equipRow}${isCompact ? ` ${styles.equipRowCompact}` : ''}${
        noIcon ? ` ${styles.equipRowNoIcon}` : ''
      }`}
    >
      {/* The initials tile is a placeholder for art that should have been there -- six of
          Counter-Strike's maps were never published by the mirror. A list with no art at all is a
          different case, and a column of redundant initials ("TIE" beside "Tier 1") is worse than
          no column. */}
      {!noIcon && <GameIcon name={name} iconUrl={iconUrl} iconUrlLight={iconUrlLight} />}

      <div className={styles.equipMain}>
        <div className={styles.equipHeader}>
          <span className={styles.equipName}>{name}</span>
          <span className={styles.equipValue}>{value}</span>
        </div>
        <span className={styles.barTrack} aria-hidden="true" title={barTitle}>
          <span
            className={`${styles.barFill}${barDone ? ` ${styles.barFillDone}` : ''}`}
            style={{ width: `${barPct}%` }}
          />
        </span>
      </div>

      {stats.length > 0 && (
        <dl className={styles.equipStats} style={{ '--game-stat-columns': stats.length }}>
          {stats.map((stat) => (
            // `title` lets a single cell carry its own caveat, so a figure that needs qualifying
            // does not force a warning panel above the whole list.
            <div key={stat.label} title={stat.title}>
              <dt>{stat.label}</dt>
              <dd className={stat.highlight ? styles.statUp : undefined}>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </motion.li>
  );
}

/**
 * The page scrolls in the window on its own route but inside `.contentInline` in the desktop
 * split-view, so the element to restore has to be found rather than assumed.
 */
function scrollParent(el) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
}

/** Shared shell for every long stat list: filter chips, a capped list, and an expander. */
export function StatSection({ items, filters, filterKey, allLabel = 'ALL', renderRow }) {
  const [active, setActive] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef(null);
  const expanderRef = useRef(null);
  const restore = useRef(null);

  const filtered = useMemo(
    () => (active === null ? items : items.filter((item) => item[filterKey] === active)),
    [items, active, filterKey],
  );

  const visible = expanded ? filtered : filtered.slice(0, VISIBLE_ROWS);
  const hidden = filtered.length - visible.length;

  // Expanding inserts rows above the button that was just clicked. Left alone the browser anchors on
  // something below that insertion and scrolls down to compensate, which dumps the new list above
  // the viewport -- it reads as the list opening upwards. Holding the scroll offset across the
  // commit keeps everything above the list still, so it behaves like a dropdown.
  const toggleExpanded = () => {
    const scroller = scrollParent(listRef.current);
    restore.current = { scroller, top: scroller ? scroller.scrollTop : window.scrollY };
    setExpanded((value) => !value);
  };

  useLayoutEffect(() => {
    const saved = restore.current;
    if (!saved) return;
    restore.current = null;

    if (saved.scroller) saved.scroller.scrollTop = saved.top;
    else window.scrollTo(0, saved.top);

    // Collapsing removes more height than there is scroll left, so the restore clamps and strands
    // the reader at the foot of the page; pull the button back into view instead.
    if (!expanded) expanderRef.current?.scrollIntoView({ block: 'nearest' });
  }, [expanded]);

  return (
    <>
      {filters?.length > 0 && (
        <FilterChips
          options={filters}
          active={active}
          onSelect={(next) => {
            setActive(next);
            setExpanded(false);
          }}
          allLabel={allLabel}
          allCount={items.length}
        />
      )}

      <motion.ul
        ref={listRef}
        className={styles.equipList}
        variants={listVariants(expanded ? 0 : 0.02)}
        // The expanded list renders straight at its final state: the rows are already on screen, so
        // there is nothing to animate in, and skipping it means the rows can never be left sitting
        // at opacity 0 if the entrance does not fire.
        initial={expanded ? false : 'hidden'}
        animate="show"
        key={`${active ?? 'all'}-${expanded}`}
      >
        {visible.map(renderRow)}
      </motion.ul>

      {(hidden > 0 || expanded) && (
        <button ref={expanderRef} type="button" className={styles.expander} onClick={toggleExpanded}>
          {expanded ? 'SHOW LESS' : `SHOW ALL ${filtered.length}`}
        </button>
      )}
    </>
  );
}

/** Label/value pairs in a panel, for the counters that have no meaningful scale to draw a bar on. */
export function TallyPanel({ rows, columns }) {
  return (
    <div className={styles.panel}>
      <dl className={styles.tallyList} data-columns={columns}>
        {rows.map((row) => (
          <div key={row.key} className={styles.tallyRow}>
            <dt className={styles.tallyLabel}>{row.label}</dt>
            <dd className={styles.tallyValue} title={row.title}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The `> TITLE` heading every section on every game page uses. */
export function Section({ title, children, className }) {
  return (
    <motion.section
      variants={fadeUp}
      className={`${styles.section}${className ? ` ${className}` : ''}`}
    >
      <h2 className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>&gt;</span> {title}
      </h2>
      {children}
    </motion.section>
  );
}
