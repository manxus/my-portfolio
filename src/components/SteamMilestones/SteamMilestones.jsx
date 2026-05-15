import { useMemo } from 'react';
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

function fmtCount(n) {
  return Math.round(n).toLocaleString();
}

function fmtHoursOneDecimal(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** Short caption under each card (no repeating totals like “247 games” on completed tiers). */
function milestoneCaption(sectionId, current, threshold, complete, metrics) {
  const thr = threshold.toLocaleString();

  if (complete) {
    return `${thr}/${thr}`;
  }

  switch (sectionId) {
    case 'library':
      return `${fmtCount(current)}/${thr}`;
    case 'hours':
      return `${fmtCount(current)}/${thr}`;
    case 'single':
      return `${fmtHoursOneDecimal(current)}/${thr} · ${metrics.topGameName}`;
    case 'perfect':
      return `${fmtCount(current)}/${thr}`;
    case 'achievements':
      return `${fmtCount(current)}/${thr}`;
    case 'wishlist':
      return `${fmtCount(current)}/${thr}`;
    default:
      return `${fmtCount(current)}/${thr}`;
  }
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
        valueNow: Math.min(def.threshold, current),
        caption: milestoneCaption(
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
      milestones,
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
      {sections.map((section) => (
        <section
          key={section.sectionId}
          className={styles.block}
          aria-labelledby={`sec-${section.sectionId}`}
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
            {section.milestones.map((m) => (
              <li key={m.key} className={styles.milestone}>
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
                {!m.complete && (
                  <>
                    <p className={styles.progressCaption}>{m.caption}</p>
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
                  </>
                )}
                {m.complete && (
                  <p className={styles.doneCaption}>{m.caption}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
