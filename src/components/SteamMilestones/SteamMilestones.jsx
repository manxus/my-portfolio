import { useMemo } from 'react';
import { motion } from 'framer-motion';
import styles from './SteamMilestones.module.css';

function buildMetrics(games, wishlistCount) {
  const gameCount = games.length;
  const totalHours = games.reduce(
    (s, g) => s + (Number(g.playtimeHours) || 0),
    0,
  );
  const maxSingleHours = Math.max(
    0,
    ...games.map((g) => Number(g.playtimeHours) || 0),
  );
  let perfectGames = 0;
  let totalAchUnlocked = 0;
  for (const g of games) {
    const a = g.achievements;
    if (!a || !a.total) continue;
    totalAchUnlocked += a.unlocked || 0;
    if (a.unlocked === a.total) perfectGames += 1;
  }
  const topGame = [...games].sort(
    (a, b) => (b.playtimeHours || 0) - (a.playtimeHours || 0),
  )[0];
  const topGameName = topGame?.name ?? '—';

  return {
    gameCount,
    totalHours,
    maxSingleHours,
    perfectGames,
    totalAchUnlocked,
    wishlistCount,
    topGameName,
  };
}

const SECTION_DEFINITIONS = [
  {
    sectionId: 'library',
    heading: 'Library catalog',
    hint: 'Owned titles in your synced Steam library',
    getValue: (m) => m.gameCount,
    milestones: [
      { threshold: 1, title: 'First footprint' },
      { threshold: 10, title: 'Into double digits' },
      { threshold: 50, title: 'Shelf weight' },
      { threshold: 100, title: 'Century club' },
      { threshold: 250, title: 'Quarter-thousand vault' },
      { threshold: 500, title: 'Library legend' },
      { threshold: 1000, title: 'Four-digit catalog' },
      { threshold: 2500, title: 'Deep backlog atlas' },
      { threshold: 5000, title: 'Five-thousand shelf' },
      { threshold: 10000, title: 'Ten thousand titles' },
    ],
  },
  {
    sectionId: 'hours',
    heading: 'Lifetime playtime',
    hint: 'Sum of tracked hours across the library',
    getValue: (m) => m.totalHours,
    milestones: [
      { threshold: 10, title: 'Just warming up' },
      { threshold: 100, title: 'Hundred-hour habit' },
      { threshold: 500, title: 'Half a thousand deep' },
      { threshold: 1000, title: 'Thousand-hour hall' },
      { threshold: 2500, title: 'Time sink apex' },
      { threshold: 5000, title: 'Five-k marathon' },
      { threshold: 10000, title: 'Ten thousand club' },
      { threshold: 25000, title: 'Twenty-five-k orbit' },
      { threshold: 50000, title: 'Fifty-k summit' },
      { threshold: 100000, title: 'Hundred-k monument' },
    ],
  },
  {
    sectionId: 'single',
    heading: 'Deepest single title',
    hint: 'Peak hours poured into any one synced game',
    getValue: (m) => m.maxSingleHours,
    milestones: [
      { threshold: 100, title: 'Main game mindset' },
      { threshold: 500, title: 'Second home' },
      { threshold: 1000, title: 'Thousand-hour anchor' },
      { threshold: 2000, title: 'Multi-year mount' },
      { threshold: 3000, title: 'Monument build' },
      { threshold: 4000, title: 'Four-k fixation' },
      { threshold: 5000, title: 'Five-k peak' },
    ],
  },
  {
    sectionId: 'perfect',
    heading: 'Flawless runs',
    hint: 'Titles with 100% of tracked achievements',
    getValue: (m) => m.perfectGames,
    milestones: [
      { threshold: 1, title: 'Proof of concept' },
      { threshold: 10, title: 'Double-digit perfects' },
      { threshold: 50, title: 'Flawless armada' },
      { threshold: 100, title: 'Century of cleans' },
      { threshold: 250, title: 'Two-fifty sealed' },
      { threshold: 500, title: 'Five hundred spotless' },
      { threshold: 1000, title: 'Thousand-title streak' },
    ],
  },
  {
    sectionId: 'achievements',
    heading: 'Achievement haul',
    hint: 'Total achievement unlocks across tracked games',
    getValue: (m) => m.totalAchUnlocked,
    milestones: [
      { threshold: 100, title: 'Hundred pings' },
      { threshold: 500, title: 'Pop-up powerhouse' },
      { threshold: 1000, title: 'Thousand chimes' },
      { threshold: 2500, title: 'Rare drop specialist' },
      { threshold: 5000, title: 'Five-k fanfare' },
      { threshold: 10000, title: 'Ten thousand pings' },
      { threshold: 25000, title: 'Achievement avalanche' },
      { threshold: 50000, title: 'Fifty-k merit wall' },
      { threshold: 100000, title: 'Hundred-k badge storm' },
    ],
  },
  {
    sectionId: 'wishlist',
    heading: 'Wishlist horizon',
    hint: 'Games saved for later on Steam',
    getValue: (m) => m.wishlistCount,
    milestones: [
      { threshold: 1, title: 'Eye on the prize' },
      { threshold: 25, title: 'Someday shelf' },
      { threshold: 100, title: 'Wishlist centurion' },
      { threshold: 500, title: 'Five hundred maybes' },
      { threshold: 1000, title: 'Thousand-title horizon' },
      { threshold: 2500, title: 'Twenty-five hundred queued' },
      { threshold: 5000, title: 'Five-thousand someday' },
    ],
  },
];

const THRESHOLD_UNITS = {
  library: (t) => `${t.toLocaleString()} games`,
  hours: (t) => `${t.toLocaleString()} hrs`,
  single: (t) => `${t.toLocaleString()} hrs`,
  perfect: (t) => `${t.toLocaleString()} titles`,
  achievements: (t) => `${t.toLocaleString()} unlocks`,
  wishlist: (t) => `${t.toLocaleString()} games`,
};

const STATE_CLASS = {
  complete: 'milestoneComplete',
  next: 'milestoneNext',
  future: 'milestoneFuture',
};

function fmtCount(n) {
  return Math.round(n).toLocaleString();
}

function fmtHoursOneDecimal(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function thresholdBadge(sectionId, threshold) {
  const fmt = THRESHOLD_UNITS[sectionId];
  return fmt ? fmt(threshold) : threshold.toLocaleString();
}

function milestoneCaptionParts(
  sectionId,
  current,
  threshold,
  complete,
  metrics,
) {
  const thr = threshold.toLocaleString();

  if (complete) {
    return { primary: `${thr}/${thr}`, secondary: null };
  }

  const useDecimal =
    sectionId === 'hours' || sectionId === 'single';
  const primary = useDecimal
    ? `${fmtHoursOneDecimal(current)}/${thr}`
    : `${fmtCount(current)}/${thr}`;
  const secondary =
    sectionId === 'single' ? metrics.topGameName : null;

  return { primary, secondary };
}

/** Verbose description for accessibility / progress hints. */
function milestoneAriaLabel(sectionId, current, threshold, complete, metrics) {
  const r = fmtCount;

  if (complete) {
    switch (sectionId) {
      case 'library':
        return `Completed: reached ${threshold.toLocaleString()} games in library`;
      case 'hours':
        return `Completed: reached ${threshold.toLocaleString()} total hours`;
      case 'single':
        return `Completed: reached ${threshold.toLocaleString()} hours in one game (${metrics.topGameName})`;
      case 'perfect':
        return `Completed: ${threshold.toLocaleString()} titles at 100% achievements`;
      case 'achievements':
        return `Completed: ${threshold.toLocaleString()} achievement unlocks`;
      case 'wishlist':
        return `Completed: ${threshold.toLocaleString()} wishlist games`;
      default:
        return `Completed milestone at ${threshold.toLocaleString()}`;
    }
  }

  switch (sectionId) {
    case 'library':
      return `${r(current)} of ${threshold.toLocaleString()} games in library`;
    case 'hours':
      return `${r(current)} of ${threshold.toLocaleString()} total hours`;
    case 'single':
      return `${fmtHoursOneDecimal(current)} of ${threshold.toLocaleString()} hours in deepest title (${metrics.topGameName})`;
    case 'perfect':
      return `${r(current)} of ${threshold.toLocaleString()} perfect games`;
    case 'achievements':
      return `${r(current)} of ${threshold.toLocaleString()} achievements unlocked`;
    case 'wishlist':
      return `${r(current)} of ${threshold.toLocaleString()} wishlist games`;
    default:
      return `${r(current)} of ${threshold.toLocaleString()}`;
  }
}

function assignMilestoneStates(milestones) {
  const firstIncompleteIdx = milestones.findIndex((m) => !m.complete);

  return milestones.map((m, idx) => {
    if (m.complete) return { ...m, state: 'complete' };
    if (idx === firstIncompleteIdx) return { ...m, state: 'next' };
    return { ...m, state: 'future' };
  });
}

function buildSections(metrics) {
  return SECTION_DEFINITIONS.map((section) => {
    const current = section.getValue(metrics);
    const milestones = section.milestones.map((def) => {
      const complete = current >= def.threshold;
      const pct =
        def.threshold <= 0
          ? 100
          : Math.min(100, (current / def.threshold) * 100);
      return {
        key: `${section.sectionId}-${def.threshold}`,
        title: def.title,
        threshold: def.threshold,
        complete,
        pct,
        pctLabel: complete ? '100%' : `${Math.round(pct)}%`,
        valueNow: Math.min(def.threshold, current),
        thresholdBadge: thresholdBadge(section.sectionId, def.threshold),
        captionParts: milestoneCaptionParts(
          section.sectionId,
          current,
          def.threshold,
          complete,
          metrics,
        ),
        ariaLabel: milestoneAriaLabel(
          section.sectionId,
          current,
          def.threshold,
          complete,
          metrics,
        ),
      };
    });

    return {
      sectionId: section.sectionId,
      heading: section.heading,
      hint: section.hint,
      milestones: assignMilestoneStates(milestones),
    };
  });
}

export default function SteamMilestones({ games, wishlistCount }) {
  const sections = useMemo(() => {
    if (!games || games.length === 0) return null;
    const metrics = buildMetrics(games, wishlistCount);
    return buildSections(metrics);
  }, [games, wishlistCount]);

  if (!games || games.length === 0) {
    return (
      <p className={styles.empty}>
        No library data loaded yet — run{' '}
        <code className={styles.code}>node scripts/fetch-steam-data.js</code>{' '}
        to assemble milestones from your Steam profile.
      </p>
    );
  }

  return (
    <div className={styles.wrapper}>
      {sections.map((section, sectionIdx) => (
        <motion.section
          key={section.sectionId}
          className={styles.block}
          aria-labelledby={`sec-${section.sectionId}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: sectionIdx * 0.05 }}
        >
          <div className={styles.blockHead}>
            <h2 id={`sec-${section.sectionId}`} className={styles.blockTitle}>
              {section.heading}
            </h2>
            {section.hint && (
              <p className={styles.blockHint}>{section.hint}</p>
            )}
          </div>
          <ul className={styles.milestoneList}>
            {section.milestones.map((m, i) => (
              <motion.li
                key={m.key}
                className={`${styles.milestone} ${styles[STATE_CLASS[m.state]]}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: sectionIdx * 0.05 + Math.min(i, 12) * 0.03,
                }}
              >
                <span className={styles.thresholdBadge}>{m.thresholdBadge}</span>
                <div className={styles.milestoneTop}>
                  <p className={styles.milestoneTitle}>{m.title}</p>
                  {m.complete && (
                    <span
                      className={styles.doneMark}
                      title="Completed"
                      aria-label="Completed"
                    >
                      ✓
                    </span>
                  )}
                </div>
                <div className={styles.captionBlock}>
                  <p
                    className={
                      m.complete ? styles.doneCaption : styles.progressCaption
                    }
                  >
                    {m.captionParts.primary}
                  </p>
                  {m.captionParts.secondary && (
                    <p
                      className={styles.captionGame}
                      title={m.captionParts.secondary}
                    >
                      {m.captionParts.secondary}
                    </p>
                  )}
                </div>
                <div className={styles.progressRow}>
                  <div
                    className={styles.progressTrack}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={m.threshold}
                    aria-valuenow={Math.round(m.valueNow)}
                    aria-label={m.ariaLabel}
                  >
                    <div
                      className={styles.progressFill}
                      style={{ width: `${m.pct}%` }}
                    />
                  </div>
                  <span className={styles.pctLabel}>{m.pctLabel}</span>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.section>
      ))}
    </div>
  );
}
