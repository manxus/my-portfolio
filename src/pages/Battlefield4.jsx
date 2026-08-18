import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import battlefieldData from '../data/battlefield4.json';
import assignmentData from '../data/battlefield4-assignments.json';
import styles from './Battlefield4.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const rowStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
};

/**
 * Rows appended to a list whose entrance already finished inherit the hidden variant and never play,
 * so the expander has to remount the list rather than grow it. Remounting means the full list also
 * re-staggers -- at 0.02s a 100-row list would take two seconds to finish, which reads as broken --
 * so the expanded view drops the stagger and lands at once.
 */
const listVariants = (staggerChildren) => ({
  hidden: {},
  show: { transition: { staggerChildren } },
});

/** Below this an equipment row drops its trailing stats onto a second line. */
const COMPACT_ROW_WIDTH = 560;
/** The gamemode and progress panels only sit side by side once both stay readable. */
const SIDE_BY_SIDE_WIDTH = 720;
/** Below this the service-record grid drops from four columns to two. */
const WIDE_GRID_WIDTH = 620;

/** How many rows an equipment list shows before the expander. */
const VISIBLE_ROWS = 12;

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

function formatPct(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : '0%';
}

/** 2177050 -> "25d 4h". The API's own "25 days, 4:44:10" is too wide for a stat tile. */
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
 * gametools ships each icon as white and black line art. Both are committed, and CSS picks the one
 * that reads against the current theme -- at under a kilobyte each the second request is cheaper
 * than wiring the page to theme state. A few assets 404 on the CDN, so the script nulls those and
 * the initials stand in.
 */
function EquipmentIcon({ name, iconUrl, iconUrlLight }) {
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
        <img src={iconUrl} alt="" className={`${styles.icon} ${styles.iconDark}`} loading="lazy" />
      )}
      {iconUrlLight && (
        <img
          src={iconUrlLight}
          alt=""
          className={`${styles.icon} ${styles.iconLight}`}
          loading="lazy"
        />
      )}
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

/** The same field carries a platoon emblem and a soldier's own emblem; only `type` tells them apart. */
function emblemLabel(platoon, userName) {
  if (platoon.tag) return `Platoon ${platoon.tag}`;
  return platoon.type === 'User' ? `${userName}'s emblem` : 'Platoon emblem';
}

function Dossier({ profile, platoon, fetchedAt }) {
  const [rankFailed, setRankFailed] = useState(false);
  const synced = fetchedAt ? new Date(fetchedAt).toISOString().slice(0, 10) : '';
  const showRank = profile.rankImageUrl && !rankFailed;

  return (
    <div className={styles.dossier}>
      <div className={styles.rankBadge}>
        {showRank ? (
          <img
            src={profile.rankImageUrl}
            alt={`Rank ${profile.rank} insignia`}
            className={styles.rankImage}
            onError={() => setRankFailed(true)}
          />
        ) : (
          <span className={styles.rankNumber}>{profile.rank}</span>
        )}
        <span className={styles.rankCaption}>RANK {profile.rank}</span>
      </div>

      <div className={styles.dossierBody}>
        <div className={styles.identity}>
          <h2 className={styles.soldierName}>{profile.userName}</h2>
          {platoon?.emblem && (
            <img
              src={platoon.emblem}
              alt={emblemLabel(platoon, profile.userName)}
              title={emblemLabel(platoon, profile.userName)}
              className={styles.platoonEmblem}
            />
          )}
        </div>
        <p className={styles.rankName}>
          {profile.rankName}
          <span className={styles.platform}> · {profile.platform.toUpperCase()}</span>
        </p>

        <div className={styles.statRow}>
          <Stat value={profile.killDeath.toFixed(2)} label="K/D" />
          <Stat value={formatNumber(Math.round(profile.scorePerMinute))} label="SPM" />
          <Stat value={profile.killsPerMinute.toFixed(2)} label="KPM" />
          <Stat value={formatPct(profile.winPercent)} label="WIN RATE" />
          <Stat value={formatPct(profile.accuracy)} label="ACCURACY" />
          <Stat value={formatPct(profile.headshotPercent)} label="HEADSHOTS" />
          <Stat
            value={formatDuration(profile.secondsPlayed)}
            label="TIME PLAYED"
            title={profile.timePlayed}
          />
        </div>

        {synced && <p className={styles.syncedAt}>SYNCED {synced}</p>}
      </div>
    </div>
  );
}

function ServiceRecord({ profile, columns }) {
  const entries = [
    { label: 'KILLS', value: formatNumber(profile.kills) },
    { label: 'DEATHS', value: formatNumber(profile.deaths) },
    { label: 'ASSISTS', value: formatNumber(profile.killAssists) },
    { label: 'ROUNDS', value: formatNumber(profile.roundsPlayed) },
    { label: 'WINS / LOSSES', value: `${formatNumber(profile.wins)} / ${formatNumber(profile.losses)}` },
    { label: 'BEST STREAK', value: formatNumber(profile.highestKillStreak) },
    { label: 'LONGEST HEADSHOT', value: `${Math.round(profile.longestHeadShot)} m` },
    { label: 'HEADSHOTS', value: formatNumber(profile.headShots) },
    { label: 'REVIVES', value: formatNumber(profile.revives) },
    { label: 'HEALS', value: formatNumber(profile.heals) },
    { label: 'REPAIRS', value: formatNumber(profile.repairs) },
    { label: 'RESUPPLIES', value: formatNumber(profile.resupplies) },
    { label: 'AVENGER KILLS', value: formatNumber(profile.avengerKills) },
    { label: 'SAVIOR KILLS', value: formatNumber(profile.saviorKills) },
    { label: 'DOG TAGS TAKEN', value: formatNumber(profile.dogtagsTaken) },
    { label: 'SQUAD SCORE', value: formatScore(profile.squadScore) },
  ];

  return (
    <div className={styles.recordGrid} data-columns={columns}>
      {entries.map((entry) => (
        <div key={entry.label} className={styles.recordCell}>
          <span className={styles.recordValue}>{entry.value}</span>
          <span className={styles.recordLabel}>{entry.label}</span>
        </div>
      ))}
    </div>
  );
}

function KitRow({ kit }) {
  return (
    <motion.li variants={fadeUp} className={styles.kitRow}>
      <EquipmentIcon name={kit.name} iconUrl={kit.iconUrl} iconUrlLight={kit.iconUrlLight} />

      <div className={styles.kitBody}>
        <div className={styles.kitHeader}>
          <span className={styles.kitName}>{kit.name}</span>
          <span className={styles.kitStars} title={`${kit.serviceStars} service stars`}>
            ★ {kit.serviceStars}
          </span>
        </div>
        <span className={styles.barTrack} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${kit.sharePct}%` }} />
        </span>
        <div className={styles.kitMeta}>
          <span>{formatScore(kit.score)} score</span>
          <span>{formatDuration(kit.secondsPlayed)}</span>
          <span>{kit.sharePct}% of kit score</span>
        </div>
      </div>
    </motion.li>
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
          {option.label ?? option.name} <span className={styles.chipCount}>{option.count}</span>
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
      <EquipmentIcon
        name={weapon.name}
        iconUrl={weapon.iconUrl}
        iconUrlLight={weapon.iconUrlLight}
      />

      <div className={styles.equipMain}>
        <div className={styles.equipHeader}>
          <span className={styles.equipName}>{weapon.name}</span>
          <span className={styles.equipKills}>{formatNumber(weapon.kills)}</span>
        </div>
        <span className={styles.barTrack} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${weapon.barPct}%` }} />
        </span>
      </div>

      <dl className={styles.equipStats}>
        <div>
          <dt>KPM</dt>
          <dd>{weapon.killsPerMinute.toFixed(2)}</dd>
        </div>
        <div>
          <dt>ACC</dt>
          <dd>{formatPct(weapon.accuracy, 0)}</dd>
        </div>
        <div>
          <dt>HS</dt>
          <dd>{formatPct(weapon.headshots, 0)}</dd>
        </div>
      </dl>
    </motion.li>
  );
}

function VehicleRow({ vehicle, isCompact }) {
  return (
    <motion.li
      variants={fadeUp}
      className={`${styles.equipRow}${isCompact ? ` ${styles.equipRowCompact}` : ''}`}
    >
      <EquipmentIcon
        name={vehicle.name}
        iconUrl={vehicle.iconUrl}
        iconUrlLight={vehicle.iconUrlLight}
      />

      <div className={styles.equipMain}>
        <div className={styles.equipHeader}>
          <span className={styles.equipName}>{vehicle.name}</span>
          <span className={styles.equipKills}>{formatNumber(vehicle.kills)}</span>
        </div>
        <span className={styles.barTrack} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${vehicle.barPct}%` }} />
        </span>
      </div>

      <dl className={styles.equipStats}>
        <div>
          <dt>KPM</dt>
          <dd>{vehicle.killsPerMinute.toFixed(2)}</dd>
        </div>
        <div>
          <dt>DEST</dt>
          <dd>{formatNumber(vehicle.destroyed)}</dd>
        </div>
        <div>
          <dt>TIME</dt>
          <dd>{formatDuration(vehicle.secondsIn)}</dd>
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

/** Shared shell for the two equipment lists: filter chips, a capped list, and an expander. */
function EquipmentSection({ items, filters, filterKey, allLabel, renderRow }) {
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

  // Expanding inserts ~90 rows above the button that was just clicked. Left alone the browser
  // anchors on something below that insertion and scrolls down to compensate, which dumps the whole
  // new list above the viewport -- it reads as the list opening upwards. Holding the scroll offset
  // across the commit keeps everything above the list still, so the rows appear where the button
  // was and it behaves like a dropdown.
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
        // there is nothing to animate in, and skipping it means a hundred rows can never be left
        // sitting at opacity 0 if the entrance does not fire.
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

/**
 * How many tiles actually share the first row.
 *
 * Counting laid-out positions beats deriving the count from widths: gridTemplateColumns reports
 * auto-fill tracks unreliably, and width-over-tile-width arithmetic silently goes wrong whenever it
 * runs before layout settles. A stale count is not cosmetic here -- the detail panel is placed by
 * row, so being off by one drops it into the middle of a row and shoves the rest of that row down.
 * The observer re-measures on any resize, so a bad first read corrects itself.
 */
function useGridColumns(ref, tileSelector, deps) {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return undefined;

    const measure = () => {
      const tiles = [...grid.querySelectorAll(tileSelector)];
      if (tiles.length === 0) return;

      const firstTop = tiles[0].offsetTop;
      setColumns(Math.max(1, tiles.filter((tile) => tile.offsetTop === firstTop).length));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return columns;
}

function AssignmentTask({ task }) {
  // The campaign unlocks are pass/fail rather than counted, so they carry no figures to chart.
  const tracked = task.target !== null && task.pct !== null;

  return (
    <li className={styles.criteriaItem}>
      <div className={styles.criteriaLine}>
        <span>{task.text}</span>
        {tracked && (
          <span className={styles.criteriaCount}>
            {formatNumber(task.current)} / {formatNumber(task.target)}
          </span>
        )}
      </div>
      {tracked && (
        <span className={styles.criteriaTrack} aria-hidden="true">
          <span
            className={`${styles.barFill}${task.pct >= 100 ? ` ${styles.barFillDone}` : ''}`}
            style={{ width: `${task.pct}%` }}
          />
        </span>
      )}
    </li>
  );
}

/** Overall progress across an assignment's tasks, for the sliver under each tile. */
function assignmentPct(assignment) {
  if (assignment.done) return 100;

  const tracked = assignment.tasks.filter((task) => task.pct !== null);
  if (tracked.length === 0) return 0;
  return Math.round(tracked.reduce((sum, task) => sum + task.pct, 0) / tracked.length);
}

function AssignmentTile({ assignment, selected, onSelect, order }) {
  const pct = assignmentPct(assignment);

  return (
    <button
      type="button"
      style={{ order }}
      className={`${styles.assignmentTile}${selected ? ` ${styles.assignmentTileSelected}` : ''}${
        assignment.done ? ` ${styles.assignmentDone}` : ''
      }`}
      aria-pressed={selected}
      title={`${assignment.name} — ${assignment.done ? 'complete' : `${pct}%`}`}
      onClick={onSelect}
    >
      {assignment.badgeUrl ? (
        <img src={assignment.badgeUrl} alt="" className={styles.tileBadge} loading="lazy" />
      ) : (
        <span className={styles.tileBadgeFallback} aria-hidden="true">
          {assignment.name.slice(0, 2).toUpperCase()}
        </span>
      )}

      <span className={styles.srOnly}>
        {`${assignment.name}, ${assignment.group}, ${
          assignment.done ? 'complete' : `${pct}% complete`
        }`}
      </span>

      <span className={styles.tileTrack} aria-hidden="true">
        <span
          className={`${styles.barFill}${assignment.done ? ` ${styles.barFillDone}` : ''}`}
          style={{ width: `${pct}%` }}
        />
      </span>
    </button>
  );
}

function AssignmentDetail({ assignment, onClose, order }) {
  return (
    <motion.div
      className={styles.assignmentDetail}
      style={{ order, overflow: 'hidden' }}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      <div className={styles.assignmentDetailInner}>
        {assignment.badgeUrl && (
          <img src={assignment.badgeUrl} alt="" className={styles.detailBadge} />
        )}

        <div className={styles.assignmentBody}>
          <div className={styles.assignmentHeader}>
            <span className={styles.assignmentName}>{assignment.name}</span>
            <span className={styles.assignmentTags}>
              {assignment.premium && assignment.group !== 'Premium' && (
                <span className={styles.premiumTag}>PREMIUM</span>
              )}
              <span className={styles.tierTag} data-tier={assignment.group.toLowerCase()}>
                {assignment.group.toUpperCase()}
              </span>
              <span className={assignment.done ? styles.doneTag : styles.pendingTag}>
                {assignment.done ? '✔ DONE' : 'IN PROGRESS'}
              </span>
              <button type="button" className={styles.detailClose} onClick={onClose}>
                ✕<span className={styles.srOnly}>Close</span>
              </button>
            </span>
          </div>

          {assignment.unlockedBy.length > 0 && (
            <p className={styles.assignmentUnlock}>
              <span className={styles.microLabel}>REQUIRES</span>{' '}
              {assignment.unlockedBy.join(' · ')}
            </p>
          )}

          <ul className={styles.criteriaList}>
            {assignment.tasks.map((task) => (
              <AssignmentTask key={task.text} task={task} />
            ))}
          </ul>

          {assignment.reward.length > 0 && (
            <p className={styles.assignmentReward}>
              <span className={styles.microLabel}>UNLOCKS</span>{' '}
              {assignment.reward.join(' · ')}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AssignmentGroup({ group, assignments, selectedId, onSelect }) {
  const gridRef = useRef(null);
  const columns = useGridColumns(gridRef, `.${styles.assignmentTile}`, [assignments.length]);

  const selectedIndex = assignments.findIndex((a) => a.id === selectedId);
  const selected = selectedIndex >= 0 ? assignments[selectedIndex] : null;

  // Place the panel immediately after the row holding the selected tile: tiles take even orders,
  // the panel an odd one just past the end of that row.
  const detailOrder =
    selectedIndex < 0
      ? 0
      : Math.min((Math.floor(selectedIndex / columns) + 1) * columns, assignments.length) * 2 - 1;

  return (
    <div className={styles.assignmentGroup}>
      <h3 className={styles.groupHeader}>
        <span className={styles.groupName} data-tier={group.name.toLowerCase()}>
          {group.label}
        </span>
        <span className={styles.groupCount}>
          {group.done} / {group.count}
        </span>
        <span className={styles.groupTrack} aria-hidden="true">
          <span
            className={`${styles.barFill}${group.done === group.count ? ` ${styles.barFillDone}` : ''}`}
            style={{ width: `${Math.round((group.done / group.count) * 100)}%` }}
          />
        </span>
      </h3>

      <div className={styles.assignmentGrid} ref={gridRef}>
        {assignments.map((assignment, index) => (
          <AssignmentTile
            key={assignment.id}
            assignment={assignment}
            order={index * 2}
            selected={assignment.id === selectedId}
            onSelect={() => onSelect(selectedId === assignment.id ? null : assignment.id)}
          />
        ))}

        {/* Rendered plainly rather than through AnimatePresence: an exit animation that fails to
            run would strand old panels in the grid, and closing should be instant anyway. */}
        {selected && (
          <AssignmentDetail
            assignment={selected}
            order={detailOrder}
            onClose={() => onSelect(null)}
          />
        )}
      </div>
    </div>
  );
}

function AssignmentGrid({ assignments, groups }) {
  // One selection across every group, so opening a badge closes whatever else was open.
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div className={styles.assignmentGroups}>
      {groups.map((group) => (
        <AssignmentGroup
          key={group.name}
          group={group}
          assignments={assignments.filter((a) => a.group === group.name)}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      ))}
    </div>
  );
}

function BarList({ rows }) {
  return (
    <div className={styles.barPanel}>
      <ul className={styles.barList}>
      {rows.map((row) => (
        <li key={row.key} className={styles.barRow}>
          <span className={styles.barLabel}>{row.label}</span>
          <span className={styles.barTrack} aria-hidden="true">
            <span
              className={`${styles.barFill}${row.complete ? ` ${styles.barFillDone}` : ''}`}
              style={{ width: `${row.pct}%` }}
            />
          </span>
          <span className={styles.barValue}>{row.value}</span>
        </li>
      ))}
      </ul>
    </div>
  );
}

export default function Battlefield4() {
  const containerRef = useRef(null);
  const { isCompact, isSideBySide, statColumns } = useContainerLayout(containerRef);

  const {
    profile,
    weapons,
    weaponCategories,
    vehicles,
    vehicleFamilies,
    classes,
    gamemodes,
    progress,
    platoon,
    fetchedAt,
  } = battlefieldData;

  const gamemodeRows = gamemodes.map((mode) => ({
    key: mode.slug,
    label: mode.name,
    pct: mode.sharePct,
    value: formatScore(mode.score),
  }));

  const { assignments, groups: assignmentGroups } = assignmentData;

  const progressRows = progress.map((entry) => ({
    key: entry.slug,
    label: entry.name,
    pct: entry.pct,
    value: `${formatNumber(entry.current)} / ${formatNumber(entry.total)}`,
    complete: entry.complete,
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
        <Dossier profile={profile} platoon={platoon} fetchedAt={fetchedAt} />
      </motion.section>

      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> SERVICE RECORD
        </h2>
        <ServiceRecord profile={profile} columns={statColumns} />
      </motion.section>

      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> KITS
        </h2>
        <motion.ul className={styles.kitList} variants={rowStagger} initial="hidden" animate="show">
          {classes.map((kit) => (
            <KitRow key={kit.slug} kit={kit} />
          ))}
        </motion.ul>
      </motion.section>

      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> WEAPONS
        </h2>
        <EquipmentSection
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
          <span className={styles.sectionIcon}>&gt;</span> VEHICLES
        </h2>
        <EquipmentSection
          items={vehicles}
          filters={vehicleFamilies}
          filterKey="family"
          allLabel="ALL"
          renderRow={(vehicle) => (
            <VehicleRow key={vehicle.slug} vehicle={vehicle} isCompact={isCompact} />
          )}
        />
      </motion.section>

      <motion.section
        variants={fadeUp}
        className={`${styles.panelRow}${isSideBySide ? ` ${styles.panelRowSplit}` : ''}`}
      >
        <div className={styles.panelColumn}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>&gt;</span> GAMEMODES
          </h2>
          <BarList rows={gamemodeRows} />
        </div>

        <div className={styles.panelColumn}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>&gt;</span> UNLOCK PROGRESS
          </h2>
          <BarList rows={progressRows} />
        </div>
      </motion.section>

      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> ASSIGNMENTS
        </h2>
        <AssignmentGrid assignments={assignments} groups={assignmentGroups} />
      </motion.section>

      <motion.p variants={fadeUp} className={styles.attribution}>
        Battlefield 4 is a trademark of Electronic Arts Inc. Weapon, vehicle and kit art &copy;
        EA/DICE, used under fair use. Stats read from Battlelog via the community-run
        gametools.network API and cached at build time. Assignment requirements from the Battlefield
        Wiki, CC BY-SA 3.0.
      </motion.p>
    </motion.div>
  );
}
