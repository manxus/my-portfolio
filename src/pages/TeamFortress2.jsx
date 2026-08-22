import { useRef } from 'react';
import { motion } from 'framer-motion';
import tf2Data from '../data/teamfortress2.json';
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
  TallyPanel,
  Section,
  gameStyles,
} from '../components/GameStats';
import styles from './TeamFortress2.module.css';

function ClassRow({ entry, isCompact }) {
  return (
    <StatRow
      name={entry.name}
      value={formatNumber(entry.kills)}
      barPct={entry.barPct}
      barTitle={`${formatNumber(entry.kills)} kills as ${entry.name}`}
      isCompact={isCompact}
      noIcon
      stats={[
        { label: 'DMG', value: formatScore(entry.damage) },
        {
          label: 'DPM',
          // Marked rather than hidden: the number is real, it just is not measuring the same thing
          // as the others. With the panel above the table gone, the star carries its own
          // explanation rather than pointing at a caveat that is no longer there.
          value: entry.mvmSkewed ? `${entry.damagePerMinute}*` : String(entry.damagePerMinute),
          title: entry.mvmSkewed
            ? `Inflated by Mann vs Machine, which shares the per-class counters — a wave kills far ` +
              `more than a round does. ${entry.name}'s best round reads ${entry.bestKills} kills, ` +
              'so this rate is measuring robots and is not comparable with the other classes.'
            : undefined,
        },
        { label: 'TIME', value: formatDuration(entry.secondsPlayed) },
        { label: 'SHARE', value: formatPct(entry.timeSharePct, 0) },
      ]}
    />
  );
}

/**
 * The richest stat set in the library, and the one that needs the most said about what it is not:
 * Valve never recorded deaths or shots for any class, and Mann vs Machine time is folded into the
 * same per-class counters as normal play. Both are stated on the page rather than smoothed over.
 */
export default function TeamFortress2() {
  const containerRef = useRef(null);
  const { isCompact, isSideBySide, statColumns } = useContainerLayout(containerRef);

  const { profile, summary, record, classes, specialities, mvm, fetchedAt } = tf2Data;

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
          capsuleAlt="Team Fortress 2 library art"
          name={profile.personaName}
          avatarUrl={profile.avatarUrl}
          subtitle="Team Fortress 2"
          tag="CAREER RECORD"
          fetchedAt={fetchedAt}
          stats={[
            { label: 'KILLS', value: formatNumber(summary.kills) },
            {
              label: 'DAMAGE',
              value: formatScore(summary.damage),
              title: `${formatNumber(summary.damage)} damage dealt`,
            },
            { label: 'POINTS', value: formatNumber(summary.points) },
            { label: 'ASSISTS', value: formatNumber(summary.assists) },
            { label: 'DOMINATIONS', value: formatNumber(summary.dominations) },
            {
              label: 'TIME PLAYED',
              // The only time figure left on the page, and the classes table below sums to less
              // than it, so the tooltip carries the reconciliation rather than a panel doing it.
              value: `${formatNumber(summary.libraryHours)}h`,
              title:
                `Steam's own figure for time with the game open. Valve's per-class timers account ` +
                `for ${formatNumber(summary.hoursPlayed)}h of it — ` +
                `${formatPct(summary.trackedPct, 0)} — which is what the classes table sums to.`,
            },
          ]}
        />
      </motion.section>

      <Section title="CAREER RECORD">
        <RecordGrid entries={record} columns={statColumns} />
      </Section>

      <Section title="CLASSES">
        <ul className={gameStyles.equipList}>
          {classes.map((entry) => (
            <ClassRow key={entry.slug} entry={entry} isCompact={isCompact} />
          ))}
        </ul>
      </Section>

      <Section title="SPECIALITIES">
        <TallyPanel
          rows={specialities.map((entry) => ({
            key: entry.key,
            label: `${entry.label} — ${entry.classes.join(', ')}`,
            value: formatStat(entry.value),
            title: formatNumber(entry.value),
          }))}
          columns={isSideBySide ? 2 : 1}
        />
      </Section>


      {mvm.length > 0 && (
        <Section title="MANN VS MACHINE">
          <TallyPanel
            rows={mvm.map((entry) => ({
              key: entry.key,
              label: entry.label,
              value: formatStat(entry.value),
              title: formatNumber(entry.value),
            }))}
            columns={isSideBySide ? 2 : 1}
          />
        </Section>
      )}


      <motion.p variants={fadeUp} className={gameStyles.attribution}>
        Team Fortress is a trademark of Valve Corporation. Library art &copy; Valve, used under fair
        use. Stats read from the Steam Web API and cached at build time. Valve never populated the
        death or shot counters for any of the nine classes &mdash; every one reads zero &mdash; so
        there is no kill/death ratio or accuracy here, and none is inferred. Class art is not shown
        either: the only published source sits behind a bot check, so the table is drawn without it
        rather than working around one.
      </motion.p>
    </motion.div>
  );
}
