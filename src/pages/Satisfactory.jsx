import { useRef } from 'react';
import { motion } from 'framer-motion';
import satisfactoryData from '../data/satisfactory.json';
import {
  useContainerLayout,
  formatNumber,
  formatStat,
  formatDistance,
  fadeUp,
  stagger,
  Dossier,
  RecordGrid,
  StatRow,
  Section,
  gameStyles,
} from '../components/GameStats';
import styles from './Satisfactory.module.css';

/**
 * The only non-shooter of the set, and the numbers are the reason it is here: 111km of belt and a
 * paved footprint measured in hectares read as facts about a place rather than a scoreboard.
 */
export default function Satisfactory() {
  const containerRef = useRef(null);
  const { statColumns, isCompact } = useContainerLayout(containerRef);

  const { profile, summary, sections, tiers, fetchedAt } = satisfactoryData;

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
          capsuleAlt="Satisfactory library art"
          name={profile.personaName}
          avatarUrl={profile.avatarUrl}
          subtitle="Satisfactory"
          tag="FICSIT PIONEER RECORD"
          fetchedAt={fetchedAt}
          stats={[
            {
              label: 'BELT BUILT',
              value: formatDistance(summary.beltMetres),
              title: `${formatNumber(summary.beltMetres)} metres of conveyor`,
            },
            {
              label: 'FOUNDATIONS',
              value: formatStat(summary.foundations),
              title: `${formatNumber(summary.foundations)} placed — about ${summary.pavedHectares} hectares paved`,
            },
            { label: 'MILESTONES', value: formatNumber(summary.milestones) },
            { label: 'ALT RECIPES', value: formatNumber(summary.altRecipes) },
            { label: 'HARD DRIVES', value: formatNumber(summary.hardDrives) },
            { label: 'PHASES DONE', value: formatNumber(summary.phasesComplete) },
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
                entry.kind === 'distance' ? formatDistance(entry.value) : formatStat(entry.value),
              title:
                entry.kind === 'distance'
                  ? `${formatNumber(entry.value)} metres — the unit Satisfactory measures in, ` +
                    'inferred from the LENGTH_ key. Coffee Stain publishes no unit with these counters.'
                  : undefined,
            }))}
            columns={statColumns}
          />
        </Section>
      ))}

      <Section title="MILESTONES BY TIER">
        <ul className={gameStyles.equipList}>
          {tiers.map((tier) => (
            <StatRow
              key={tier.key}
              name={tier.name}
              value={formatNumber(tier.unlocked)}
              barPct={tier.barPct}
              barTitle={
                `${tier.unlocked} milestones unlocked in ${tier.name}. Counted from the per-milestone ` +
                'unlock flags Steam exposes, which only report what is unlocked — the tiers carry ' +
                'no total to measure against.'
              }
              isCompact={isCompact}
              noIcon
            />
          ))}
        </ul>
      </Section>

      <motion.p variants={fadeUp} className={gameStyles.attribution}>
        Satisfactory is a trademark of Coffee Stain Studios. Library art &copy; Coffee Stain, used
        under fair use. Stats read from the Steam Web API and cached at build time. Coffee Stain
        ships no display names with them, so every label here is written against the stat key rather
        than quoted from Steam.
      </motion.p>
    </motion.div>
  );
}
