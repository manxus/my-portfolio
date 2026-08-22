import { useRef } from 'react';
import { motion } from 'framer-motion';
import drgData from '../data/deeprockgalactic.json';
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
  Section,
  gameStyles,
} from '../components/GameStats';
import styles from './DeepRockGalactic.module.css';

/**
 * Ghost Ship publishes counters but no per-class or per-mission-type breakdown, so there is no list
 * to rank and this page is grids the whole way down. The stat set is small enough that every one of
 * them earns a cell, which is unusual -- the other game pages have to filter noise out first.
 */
export default function DeepRockGalactic() {
  const containerRef = useRef(null);
  const { statColumns } = useContainerLayout(containerRef);

  const { profile, summary, sections, fetchedAt } = drgData;

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
          capsuleAlt="Deep Rock Galactic library art"
          name={profile.personaName}
          avatarUrl={profile.avatarUrl}
          subtitle="Deep Rock Galactic"
          tag="MISSION LOG"
          fetchedAt={fetchedAt}
          stats={[
            {
              label: 'MISSIONS',
              value: formatNumber(summary.missionsCompleted),
              title: `${summary.minutesPerMission} minutes per mission on average`,
            },
            { label: 'MILESTONES', value: formatNumber(summary.milestones) },
            { label: 'DREADNAUGHTS', value: formatNumber(summary.dreadnaughts) },
            {
              label: 'WEAKSPOTS',
              value: formatScore(summary.weakspotsHit),
              title: `${formatNumber(summary.weakspotsHit)} weakspots hit`,
            },
            { label: 'PROMOTIONS', value: formatNumber(summary.promotions) },
            {
              label: 'HOSTED',
              value: formatPct(summary.hostedPct, 0),
              title:
                `${formatNumber(summary.hostedMissions)} missions hosted, ` +
                `${formatNumber(summary.soloMissions)} played solo`,
            },
            { label: 'IN GAME', value: `${formatNumber(summary.hoursPlayed)}h` },
          ]}
        />
      </motion.section>

      {sections.map((section) => (
        <Section key={section.id} title={section.title}>
          <RecordGrid
            entries={section.entries.map((entry) => ({
              ...entry,
              display:
                entry.kind === 'duration' ? formatDuration(entry.value) : formatStat(entry.value),
            }))}
            columns={statColumns}
          />
        </Section>
      ))}


      <motion.p variants={fadeUp} className={gameStyles.attribution}>
        Deep Rock Galactic is a trademark of Ghost Ship Games. Library art &copy; Ghost Ship Games,
        used under fair use. Stats read from the Steam Web API and cached at build time; the labels
        are Ghost Ship&apos;s own, shortened where they were written as full sentences. Two unlabelled
        counters Steam returns are left off the page rather than captioned with a guess.
      </motion.p>
    </motion.div>
  );
}
