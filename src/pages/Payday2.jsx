import { useRef } from 'react';
import { motion } from 'framer-motion';
import payday2Data from '../data/payday2.json';
import {
  useContainerLayout,
  formatNumber,
  formatScore,
  formatPct,
  fadeUp,
  stagger,
  Dossier,
  RecordGrid,
  StatRow,
  StatSection,
  Section,
  gameStyles,
} from '../components/GameStats';
import styles from './Payday2.module.css';

const GEAR_KINDS = [
  { name: 'Melee', count: 0 },
  { name: 'Throwable', count: 0 },
];

function WeaponRow({ weapon, isCompact }) {
  return (
    <StatRow
      name={weapon.name}
      value={formatNumber(weapon.kills)}
      barPct={weapon.barPct}
      barTitle={`${formatNumber(weapon.kills)} kills with the ${weapon.name}`}
      isCompact={isCompact}
      noIcon
      stats={[
        {
          label: 'ACC',
          // Explosives log a hit per enemy in the blast, so there is no accuracy to state. With the
          // panel above the list gone, the dash carries its own explanation.
          value: weapon.accuracy === null ? '—' : formatPct(weapon.accuracy, 0),
          title:
            weapon.accuracy === null
              ? `${weapon.name} logs a hit for every enemy caught in the blast, so it records more ` +
                `hits (${formatNumber(weapon.hits)}) than shots fired (${formatNumber(weapon.shots)}). ` +
                'An accuracy percentage would be meaningless.'
              : undefined,
        },
        { label: 'SHOTS', value: formatScore(weapon.shots) },
        { label: 'USED', value: formatNumber(weapon.used) },
      ]}
    />
  );
}

/**
 * The biggest stat set in the library by a distance -- 1,248 keys, of which the sync script keeps
 * 773 -- and the only one of the four new pages where the shot counters actually work, so the
 * weapon table carries real accuracy.
 */
export default function Payday2() {
  const containerRef = useRef(null);
  const { isCompact, statColumns } = useContainerLayout(containerRef);

  const { profile, summary, record, weapons, enemies, gear, difficulties, fetchedAt } = payday2Data;

  const gearKinds = GEAR_KINDS.map((kind) => ({
    name: kind.name,
    count: gear.filter((entry) => entry.kind === kind.name).length,
  })).filter((kind) => kind.count > 0);

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
          capsuleAlt="PAYDAY 2 library art"
          name={profile.personaName}
          avatarUrl={profile.avatarUrl}
          subtitle="PAYDAY 2"
          tag="CRIME.NET RECORD"
          fetchedAt={fetchedAt}
          stats={[
            { label: 'LEVEL', value: formatNumber(summary.level) },
            {
              label: 'HEISTS WON',
              value: formatNumber(summary.heistsSucceeded),
              title: `${formatNumber(summary.heistsPlayed)} attempted, ${formatNumber(summary.heistsFailed)} failed`,
            },
            { label: 'SUCCESS', value: formatPct(summary.successPct) },
            {
              label: 'KILLS',
              value: formatScore(summary.enemyKills),
              title: `${formatNumber(summary.enemyKills)} kills — about ${summary.killsPerHeist} a heist`,
            },
            { label: 'ACCURACY', value: formatPct(summary.accuracy) },
            {
              label: 'OFFSHORE',
              value: `$${formatScore(summary.cash)}`,
              title: `$${formatNumber(summary.cash)}`,
            },
            { label: 'IN GAME', value: `${formatNumber(summary.hoursPlayed)}h` },
          ]}
        />
      </motion.section>

      <Section title="CRIMINAL RECORD">
        <RecordGrid entries={record} columns={statColumns} />
      </Section>

      <Section title="DIFFICULTY">
        <ul className={gameStyles.equipList}>
          {difficulties.map((tier) => (
            <StatRow
              key={tier.slug}
              name={tier.name}
              value={formatNumber(tier.plays)}
              barPct={tier.barPct}
              barTitle={`${formatNumber(tier.plays)} heists on ${tier.name}`}
              isCompact={isCompact}
              noIcon
            />
          ))}
        </ul>
      </Section>

      <Section title="WEAPONS">
        <StatSection
          items={weapons}
          filters={[]}
          filterKey="slug"
          renderRow={(weapon) => (
            <WeaponRow key={weapon.slug} weapon={weapon} isCompact={isCompact} />
          )}
        />
      </Section>

      <Section title="ENEMIES">
        <StatSection
          items={enemies}
          filters={[]}
          filterKey="slug"
          renderRow={(enemy) => (
            <StatRow
              key={enemy.slug}
              name={enemy.name}
              value={formatNumber(enemy.kills)}
              barPct={enemy.barPct}
              isCompact={isCompact}
              noIcon
            />
          )}
        />
      </Section>

      <Section title="MELEE &amp; THROWABLES">
        <StatSection
          items={gear}
          filters={gearKinds}
          filterKey="kind"
          renderRow={(entry) => (
            <StatRow
              key={`${entry.kind}-${entry.slug}`}
              name={entry.name}
              value={formatNumber(entry.used)}
              barPct={entry.barPct}
              barTitle={`Equipped ${formatNumber(entry.used)} times — the bar shows uses, not kills`}
              isCompact={isCompact}
              noIcon
              stats={[{ label: 'KILLS', value: formatNumber(entry.kills) }]}
            />
          )}
        />
      </Section>

      <motion.p variants={fadeUp} className={gameStyles.attribution}>
        PAYDAY is a trademark of Starbreeze and Overkill Software. Library art &copy; Overkill, used
        under fair use. Stats read from the Steam Web API and cached at build time. Overkill publishes
        no display names, so weapon and gear names are the internal ids tidied up &mdash;{' '}
        <code>x_</code> is its own marker for an akimbo pair. Enemies and difficulty tiers are named
        explicitly because their ids say something different from what the game does:{' '}
        <code>spooc</code> is the Cloaker, and <code>easy_wish</code> is the tier now called Mayhem.
      </motion.p>
    </motion.div>
  );
}
