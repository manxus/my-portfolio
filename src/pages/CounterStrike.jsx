import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import counterstrikeData from '../data/counterstrike.json';
import styles from './CounterStrike.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

/**
 * Rows appended to a list whose entrance already finished inherit the hidden variant and never
 * play, so the expander has to remount the list rather than grow it. Remounting means the full list
 * also re-staggers, so the expanded view drops the stagger and lands at once.
 */
const listVariants = (staggerChildren) => ({
  hidden: {},
  show: { transition: { staggerChildren } },
});

/** Below this an equipment row drops its trailing stats onto a second line. */
const COMPACT_ROW_WIDTH = 560;
/** The objectives and last-match panels only sit side by side once both stay readable. */
const SIDE_BY_SIDE_WIDTH = 720;
/** Below this the service-record grid drops from four columns to two. */
const WIDE_GRID_WIDTH = 620;

/** How many rows a stat list shows before the expander. */
const VISIBLE_ROWS = 12;

/** Map modes in the order the game groups them, used for the map filter chips. */
const MAP_MODE_ORDER = ['Defusal', 'Hostage', 'Arms Race'];

// The page renders inside two shells with very different content widths (the desktop split-view
// reserves 420px for the menu), so a window media query would be wrong in both directions.
function useContainerLayout(ref) {
  const [layout, setLayout] = useState({ isCompact: false, isSideBySide: false, statColumns: 2 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const update = () => {
      const width = el.offsetWidth;
      setLayout({
        isCompact: width < COMPACT_ROW_WIDTH,
        isSideBySide: width >= SIDE_BY_SIDE_WIDTH,
        statColumns: width >= WIDE_GRID_WIDTH ? 4 : 2,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return layout;
}

function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
}

function formatScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/**
 * The record grid mixes counts with totals four orders of magnitude larger -- 979 knife kills next
 * to 289,908,620 dollars earned. Grouping digits keeps the counts exact and readable, but the big
 * totals would blow the cell width, so those alone fall back to the abbreviated form.
 */
function formatStat(value) {
  return Number(value) >= 1_000_000 ? formatScore(value) : formatNumber(value);
}

function formatPct(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : '0%';
}

/** 8003131 -> "92d 14h". Hours alone stop meaning anything at four figures. */
function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return '0h';

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;

  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/**
 * Weapon renders and map collection icons both come from Steam as single full-colour assets, so
 * unlike the Battlefield line art there is no per-theme variant to swap. Six of the maps were never
 * published by the mirror and the script nulls those, leaving the initials to stand in.
 */
function GameIcon({ name, iconUrl }) {
  if (!iconUrl) {
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
      <img src={iconUrl} alt="" className={styles.icon} loading="lazy" />
    </span>
  );
}

function Stat({ value, label, title }) {
  return (
    <div className={styles.stat} title={title}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function Dossier({ profile, summary, fetchedAt }) {
  const [artFailed, setArtFailed] = useState(false);
  const synced = fetchedAt ? new Date(fetchedAt).toISOString().slice(0, 10) : '';
  const showArt = profile.capsuleUrl && !artFailed;

  return (
    <div className={styles.dossier}>
      {showArt && (
        <div className={styles.capsule}>
          <img
            src={profile.capsuleUrl}
            alt="Counter-Strike 2 library art"
            className={styles.capsuleImage}
            onError={() => setArtFailed(true)}
          />
        </div>
      )}

      <div className={styles.dossierBody}>
        <div className={styles.identity}>
          <h2 className={styles.playerName}>{profile.personaName}</h2>
          {profile.avatarUrl && (
            <img src={profile.avatarUrl} alt="" className={styles.avatar} loading="lazy" />
          )}
        </div>
        <p className={styles.subtitle}>
          Counter-Strike 2
          <span className={styles.platform}> · CAREER RECORD</span>
        </p>

        <div className={styles.statRow}>
          <Stat
            value={summary.killDeath.toFixed(2)}
            label="K/D"
            title={`${formatNumber(summary.kills)} kills / ${formatNumber(summary.deaths)} deaths`}
          />
          <Stat value={formatPct(summary.headshotPct)} label="HEADSHOTS" />
          <Stat value={formatPct(summary.accuracy)} label="ACCURACY" />
          <Stat value={summary.adr.toFixed(0)} label="ADR" title="Average damage per round" />
          <Stat
            value={formatPct(summary.roundWinPct)}
            label="ROUND WIN"
            title={`${formatNumber(summary.roundsPlayed)} rounds played`}
          />
          <Stat value={formatScore(summary.mvps)} label="MVPS" />
          <Stat
            value={formatDuration(summary.secondsPlayed)}
            label="IN MATCH"
            // The two figures measure different things and the gap is wide enough to look like an
            // error, so the tooltip says which is which rather than leaving the reader to guess.
            title={
              summary.libraryHours > 0
                ? `${formatNumber(summary.hoursPlayed)}h in rounds, against ` +
                  `${formatNumber(summary.libraryHours)}h with the game open`
                : undefined
            }
          />
        </div>

        {synced && <p className={styles.syncedAt}>SYNCED {synced}</p>}
      </div>
    </div>
  );
}

function ServiceRecord({ entries, columns }) {
  return (
    <div className={styles.recordGrid} data-columns={columns}>
      {entries.map((entry) => (
        <div key={entry.key} className={styles.recordCell}>
          <span className={styles.recordValue} title={formatNumber(entry.value)}>
            {formatStat(entry.value)}
          </span>
          <span className={styles.recordLabel}>{entry.label}</span>
        </div>
      ))}
    </div>
  );
}

function FilterChips({ options, active, onSelect, allLabel, allCount }) {
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
          {option.name} <span className={styles.chipCount}>{option.count}</span>
        </button>
      ))}
    </div>
  );
}

function WeaponRow({ weapon, isCompact }) {
  return (
    <motion.li
      variants={fadeUp}
      className={`${styles.equipRow}${isCompact ? ` ${styles.equipRowCompact}` : ''}`}
    >
      <GameIcon name={weapon.name} iconUrl={weapon.iconUrl} />

      <div className={styles.equipMain}>
        <div className={styles.equipHeader}>
          <span className={styles.equipName}>{weapon.name}</span>
          <span className={styles.equipValue}>{formatNumber(weapon.kills)}</span>
        </div>
        <span className={styles.barTrack} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${weapon.barPct}%` }} />
        </span>
      </div>

      <dl className={styles.equipStats}>
        <div>
          <dt>ACC</dt>
          <dd>{formatPct(weapon.accuracy, 0)}</dd>
        </div>
        <div>
          {/* Share of fired rounds that killed: the AWP's 36% against the AK's 7% says more about
              how the two play than either kill count does. */}
          <dt>K/S</dt>
          <dd>{formatPct(weapon.killsPerShot, 1)}</dd>
        </div>
        <div>
          <dt>SHOTS</dt>
          <dd>{formatScore(weapon.shots)}</dd>
        </div>
      </dl>
    </motion.li>
  );
}

function MapRow({ map, isCompact }) {
  // Win rates across a career sit in a narrow band -- 40% to 58% here -- so a bar drawn to win rate
  // would read as flat across every map. The bar carries how much the map was played instead, and
  // the fill turns over at an even split so the two facts stay legible in one row.
  const winning = map.winPct >= 50;

  return (
    <motion.li
      variants={fadeUp}
      className={`${styles.equipRow}${isCompact ? ` ${styles.equipRowCompact}` : ''}`}
    >
      <GameIcon name={map.name} iconUrl={map.iconUrl} />

      <div className={styles.equipMain}>
        <div className={styles.equipHeader}>
          <span className={styles.equipName}>{map.name}</span>
          <span className={styles.equipValue}>{formatNumber(map.rounds)}</span>
        </div>
        <span
          className={styles.barTrack}
          aria-hidden="true"
          title={`${formatNumber(map.rounds)} rounds played`}
        >
          <span
            className={`${styles.barFill}${winning ? ` ${styles.barFillDone}` : ''}`}
            style={{ width: `${map.barPct}%` }}
          />
        </span>
      </div>

      <dl className={styles.equipStats}>
        <div>
          <dt>WIN</dt>
          <dd className={winning ? styles.statUp : undefined}>{formatPct(map.winPct, 1)}</dd>
        </div>
        {/* Exact, not abbreviated: these are the two halves of the win rate shown beside them, and
            rounding turns Train's 1,457 and 1,407 into an identical-looking "1K / 1K". */}
        <div>
          <dt>WON</dt>
          <dd>{formatNumber(map.wins)}</dd>
        </div>
        <div>
          <dt>LOST</dt>
          <dd>{formatNumber(map.rounds - map.wins)}</dd>
        </div>
      </dl>
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

/** Shared shell for the weapon and map lists: filter chips, a capped list, and an expander. */
function StatSection({ items, filters, filterKey, allLabel, renderRow }) {
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
function TallyPanel({ rows, columns }) {
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

export default function CounterStrike() {
  const containerRef = useRef(null);
  const { isCompact, isSideBySide, statColumns } = useContainerLayout(containerRef);

  const {
    profile,
    summary,
    record,
    weapons,
    weaponCategories,
    maps,
    mapCoverage,
    objectives,
    fetchedAt,
  } = counterstrikeData;

  // Derived here rather than in the sync script: the map list already carries the mode on every
  // row, so the chip counts are a view concern and not another field to keep in step.
  const mapModes = useMemo(() => {
    const counts = maps.reduce((acc, map) => ({ ...acc, [map.mode]: (acc[map.mode] ?? 0) + 1 }), {});
    return MAP_MODE_ORDER.filter((name) => counts[name]).map((name) => ({
      name,
      count: counts[name],
    }));
  }, [maps]);

  const objectiveRows = objectives.map((entry) => ({
    key: entry.key,
    label: entry.label,
    value: formatStat(entry.value),
    title: formatNumber(entry.value),
  }));

  return (
    <motion.div
      ref={containerRef}
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <motion.section variants={fadeUp}>
        <Dossier profile={profile} summary={summary} fetchedAt={fetchedAt} />
      </motion.section>

      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> SERVICE RECORD
        </h2>
        <ServiceRecord entries={record} columns={statColumns} />
      </motion.section>

      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> WEAPONS
        </h2>
        <StatSection
          items={weapons}
          filters={weaponCategories}
          filterKey="category"
          allLabel="ALL"
          renderRow={(weapon) => (
            <WeaponRow key={weapon.slug} weapon={weapon} isCompact={isCompact} />
          )}
        />
      </motion.section>

      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> MAPS
        </h2>
        <p className={styles.sectionNote}>
          Bars show rounds played; the fill turns green above an even win rate.
        </p>
        {/* Without this the list reads as a complete map history. Valve stopped adding per-map
            counters after the CS:GO launch pool, so the maps below are the only ones that exist in
            the stat schema at all -- the coverage figure is derived, not asserted, so it stays true
            as the numbers move. */}
        <p className={styles.sectionWarning}>
          Valve never added per-map counters beyond the original Counter-Strike: Global Offensive
          pool, so Mirage, Overpass, Cache, Anubis and Ancient are not tracked at all. These{' '}
          {maps.length} maps account for {formatNumber(mapCoverage.trackedRounds)} of{' '}
          {formatNumber(mapCoverage.totalRounds)} rounds &mdash;{' '}
          {formatPct(mapCoverage.coveragePct, 0)} of the career. The remaining{' '}
          {formatNumber(mapCoverage.untrackedRounds)} rounds were played on maps Steam does not
          report.
        </p>
        <StatSection
          items={maps}
          filters={mapModes}
          filterKey="mode"
          allLabel="ALL"
          renderRow={(map) => <MapRow key={map.slug} map={map} isCompact={isCompact} />}
        />
      </motion.section>

      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> OBJECTIVES
        </h2>
        <TallyPanel rows={objectiveRows} columns={isSideBySide ? 2 : 1} />
      </motion.section>

      <motion.p variants={fadeUp} className={styles.attribution}>
        Counter-Strike is a trademark of Valve Corporation. Weapon renders and map collection art
        &copy; Valve, used under fair use. Stats read from the Steam Web API and cached at build
        time; the counters are cumulative and carry over from Counter-Strike: Global Offensive.
        Weapon names and categories from the community-maintained CSGO-API.
      </motion.p>
    </motion.div>
  );
}
