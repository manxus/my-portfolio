import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import battlefieldData from '../data/battlefield4.json';
import assignmentData from '../data/battlefield4-assignments.json';
import {
  useContainerLayout,
  formatNumber,
  formatScore,
  formatPct,
  formatDuration,
  fadeUp,
  stagger,
  GameIcon,
  Stat,
  RecordGrid,
  StatRow,
  StatSection,
} from '../components/GameStats';
import styles from './Battlefield4.module.css';

const rowStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
};

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
  ].map((entry) => ({ ...entry, key: entry.label, display: entry.value }));

  return <RecordGrid entries={entries} columns={columns} />;
}

function KitRow({ kit }) {
  return (
    <motion.li variants={fadeUp} className={styles.kitRow}>
      <GameIcon name={kit.name} iconUrl={kit.iconUrl} iconUrlLight={kit.iconUrlLight} />

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

function WeaponRow({ weapon, isCompact }) {
  return (
    <StatRow
      name={weapon.name}
      iconUrl={weapon.iconUrl}
      iconUrlLight={weapon.iconUrlLight}
      value={formatNumber(weapon.kills)}
      barPct={weapon.barPct}
      isCompact={isCompact}
      stats={[
        { label: 'KPM', value: weapon.killsPerMinute.toFixed(2) },
        { label: 'ACC', value: formatPct(weapon.accuracy, 0) },
        { label: 'HS', value: formatPct(weapon.headshots, 0) },
      ]}
    />
  );
}

function VehicleRow({ vehicle, isCompact }) {
  return (
    <StatRow
      name={vehicle.name}
      iconUrl={vehicle.iconUrl}
      iconUrlLight={vehicle.iconUrlLight}
      value={formatNumber(vehicle.kills)}
      barPct={vehicle.barPct}
      isCompact={isCompact}
      stats={[
        { label: 'KPM', value: vehicle.killsPerMinute.toFixed(2) },
        { label: 'DEST', value: formatNumber(vehicle.destroyed) },
        { label: 'TIME', value: formatDuration(vehicle.secondsIn) },
      ]}
    />
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

/**
 * Battlelog stamped a small expansion mark in the corner of every DLC assignment tile. These are
 * the game's own 17px icons, committed alongside the badges, and they carry their own colour --
 * hence no per-expansion palette here.
 */
const EXPANSIONS = {
  'China Rising': 'china-rising',
  'Second Assault': 'second-assault',
  'Naval Strike': 'naval-strike',
  "Dragon's Teeth": 'dragons-teeth',
  'Final Stand': 'final-stand',
};

function ExpansionIcon({ expansion, className, decorative = false }) {
  const slug = EXPANSIONS[expansion];
  if (!slug) return null;

  return (
    <img
      src={`/battlefield4/dlc/${slug}.png`}
      // Drawn at its native 17px, so it stays as crisp as it was in Battlelog.
      width={17}
      height={17}
      className={className}
      alt={decorative ? '' : expansion}
      title={decorative ? undefined : expansion}
    />
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

      <ExpansionIcon expansion={assignment.expansion} className={styles.tileExpansion} />

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
              {assignment.expansion && (
                <span className={styles.expansionTag}>
                  <ExpansionIcon
                    expansion={assignment.expansion}
                    className={styles.expansionTagIcon}
                    decorative
                  />
                  {assignment.expansion.toUpperCase()}
                </span>
              )}
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
          <span className={styles.sectionIcon}>&gt;</span> VEHICLES
        </h2>
        <StatSection
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
