import { useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import counterstrikeData from '../data/counterstrike.json';
import {
  useContainerLayout,
  formatNumber,
  formatScore,
  formatStat,
  formatPct,
  formatDuration,
  fadeUp,
  stagger,
  Dossier,
  RecordGrid,
  StatRow,
  StatSection,
  TallyPanel,
  Section,
  gameStyles,
} from '../components/GameStats';
import styles from './CounterStrike.module.css';

/** Map modes in the order the game groups them, used for the map filter chips. */
const MAP_MODE_ORDER = ['Defusal', 'Hostage', 'Arms Race'];

function WeaponRow({ weapon, isCompact }) {
  return (
    <StatRow
      name={weapon.name}
      iconUrl={weapon.iconUrl}
      value={formatNumber(weapon.kills)}
      barPct={weapon.barPct}
      isCompact={isCompact}
      stats={[
        { label: 'ACC', value: formatPct(weapon.accuracy, 0) },
        // Share of fired rounds that killed: the AWP's 36% against the AK's 7% says more about how
        // the two play than either kill count does.
        { label: 'K/S', value: formatPct(weapon.killsPerShot, 1) },
        { label: 'SHOTS', value: formatScore(weapon.shots) },
      ]}
    />
  );
}

function MapRow({ map, isCompact }) {
  // Win rates across a career sit in a narrow band -- 40% to 58% here -- so a bar drawn to win rate
  // would read as flat across every map. The bar carries how much the map was played instead, and
  // the fill turns over at an even split so the two facts stay legible in one row.
  const winning = map.winPct >= 50;

  return (
    <StatRow
      name={map.name}
      iconUrl={map.iconUrl}
      value={formatNumber(map.rounds)}
      barPct={map.barPct}
      barTitle={`${formatNumber(map.rounds)} rounds played`}
      barDone={winning}
      isCompact={isCompact}
      stats={[
        { label: 'WIN', value: formatPct(map.winPct, 1), highlight: winning },
        // Exact, not abbreviated: these are the two halves of the win rate shown beside them, and
        // rounding turns Train's 1,457 and 1,407 into an identical-looking "1K / 1K".
        { label: 'WON', value: formatNumber(map.wins) },
        { label: 'LOST', value: formatNumber(map.rounds - map.wins) },
      ]}
    />
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
        <Dossier
          capsuleUrl={profile.capsuleUrl}
          capsuleAlt="Counter-Strike 2 library art"
          name={profile.personaName}
          avatarUrl={profile.avatarUrl}
          subtitle="Counter-Strike 2"
          tag="CAREER RECORD"
          fetchedAt={fetchedAt}
          stats={[
            {
              label: 'K/D',
              value: summary.killDeath.toFixed(2),
              title: `${formatNumber(summary.kills)} kills / ${formatNumber(summary.deaths)} deaths`,
            },
            { label: 'HEADSHOTS', value: formatPct(summary.headshotPct) },
            { label: 'ACCURACY', value: formatPct(summary.accuracy) },
            { label: 'ADR', value: summary.adr.toFixed(0), title: 'Average damage per round' },
            {
              label: 'ROUND WIN',
              value: formatPct(summary.roundWinPct),
              title: `${formatNumber(summary.roundsPlayed)} rounds played`,
            },
            { label: 'MVPS', value: formatScore(summary.mvps) },
            {
              label: 'IN MATCH',
              value: formatDuration(summary.secondsPlayed),
              // The two figures measure different things and the gap is wide enough to look like an
              // error, so the tooltip says which is which rather than leaving the reader to guess.
              title:
                summary.libraryHours > 0
                  ? `${formatNumber(summary.hoursPlayed)}h in rounds, against ` +
                    `${formatNumber(summary.libraryHours)}h with the game open`
                  : undefined,
            },
          ]}
        />
      </motion.section>

      <Section title="SERVICE RECORD">
        <RecordGrid entries={record} columns={statColumns} />
      </Section>

      <Section title="WEAPONS">
        <StatSection
          items={weapons}
          filters={weaponCategories}
          filterKey="category"
          renderRow={(weapon) => (
            <WeaponRow key={weapon.slug} weapon={weapon} isCompact={isCompact} />
          )}
        />
      </Section>

      <Section title="MAPS">
        <p className={gameStyles.sectionNote}>
          Bars show rounds played; the fill turns green above an even win rate.
        </p>
        {/* Without this the list reads as a complete map history. Valve stopped adding per-map
            counters after the CS:GO launch pool, so the maps below are the only ones that exist in
            the stat schema at all -- the coverage figure is derived, not asserted, so it stays true
            as the numbers move. */}
        <p className={gameStyles.sectionWarning}>
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
          renderRow={(map) => <MapRow key={map.slug} map={map} isCompact={isCompact} />}
        />
      </Section>

      <Section title="OBJECTIVES">
        <TallyPanel rows={objectiveRows} columns={isSideBySide ? 2 : 1} />
      </Section>

      <motion.p variants={fadeUp} className={gameStyles.attribution}>
        Counter-Strike is a trademark of Valve Corporation. Weapon renders and map collection art
        &copy; Valve, used under fair use. Stats read from the Steam Web API and cached at build
        time; the counters are cumulative and carry over from Counter-Strike: Global Offensive.
        Weapon names and categories from the community-maintained CSGO-API.
      </motion.p>
    </motion.div>
  );
}
