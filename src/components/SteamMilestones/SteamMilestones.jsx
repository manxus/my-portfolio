import { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SectionGlyph from './SectionGlyph';
import MilestoneModal from './MilestoneModal';
import {
  buildAchievementData,
  fmtDate,
  fmtPct,
} from '../SteamAchievements/achievementShared';
import reviewsData from '../../data/steam-reviews.json';
import hallOfPainData from '../../data/steam-hallofpain.json';
import styles from './SteamMilestones.module.css';

/** An achievement counts as rare below this global unlock percentage. */
const RARE_MAX_PCT = 5;

/** [plural, singular] — the first rung of several ladders is exactly 1. */
const UNITS = {
  library: ['games', 'game'],
  hours: ['hrs', 'hr'],
  single: ['hrs', 'hr'],
  perfect: ['titles', 'title'],
  achievements: ['unlocks', 'unlock'],
  wishlist: ['games', 'game'],
  rare: ['rare unlocks', 'rare unlock'],
  reviews: ['reviews', 'review'],
  hallofpain: ['conquered', 'conquered'],
};

const STATE_WORD = {
  complete: 'unlocked',
  next: 'in progress',
  future: 'locked',
};

function unit(sectionId, n) {
  const pair = UNITS[sectionId];
  if (!pair) return '';
  return n === 1 ? pair[1] : pair[0];
}

/** Hours read better with a decimal; counts do not. */
const DECIMAL_SECTIONS = new Set(['hours', 'single']);

function fmtCount(n) {
  return Math.round(n).toLocaleString();
}

function fmtHoursOneDecimal(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function fmtValue(sectionId, n) {
  return DECIMAL_SECTIONS.has(sectionId) ? fmtHoursOneDecimal(n) : fmtCount(n);
}

function withUnit(sectionId, n) {
  return `${fmtValue(sectionId, n)} ${unit(sectionId, n)}`.trim();
}

function thresholdBadge(sectionId, threshold) {
  return `${threshold.toLocaleString()} ${unit(sectionId, threshold)}`.trim();
}

function ordinal(n) {
  const mod100 = n % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? 'th'
      : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th');
  return `${n.toLocaleString()}${suffix}`;
}

function buildMetrics(games, wishlist, achData) {
  let totalHours = 0;
  let maxSingleHours = 0;
  let perfectGames = 0;
  let totalAchUnlocked = 0;
  let topGameName = '—';

  for (const g of games) {
    const hours = Number(g.playtimeHours) || 0;
    totalHours += hours;
    if (hours > maxSingleHours) {
      maxSingleHours = hours;
      topGameName = g.name;
    }
    const a = g.achievements;
    if (!a || !a.total) continue;
    totalAchUnlocked += a.unlocked || 0;
    if (a.unlocked === a.total) perfectGames += 1;
  }

  const rareUnlocked = achData.unlockedAch.filter(
    (a) => a.globalPct != null && a.globalPct < RARE_MAX_PCT,
  ).length;

  return {
    gameCount: games.length,
    totalHours,
    maxSingleHours,
    perfectGames,
    totalAchUnlocked,
    wishlistCount: wishlist.length,
    rareUnlocked,
    reviewCount: reviewsData.reviews.length,
    conqueredCount: hallOfPainData.entries.filter(
      (e) => e.status === 'conquered',
    ).length,
    topGameName,
  };
}

/**
 * The dated events behind each ladder, oldest first, so the Nth rung can name
 * the exact unlock, game or review that crossed it and the day it happened.
 * Only ladders with real timestamps get a list: library size, playtime and
 * deepest-title have no history in the data, and Hall of Pain entries carry no
 * date. Several achievements can share one unlock second; the sort is stable,
 * so which of them is "the Nth" follows the order in steam-library.json.
 */
function buildUnlockEvents(achData, wishlist, games) {
  const byAppId = new Map(games.map((g) => [g.appId, g]));
  const byTime = (a, b) => a.time - b.time;

  const achEvent = (a) => ({
    time: a.unlockTime,
    label: a.name,
    sub: a.gameName,
    note: a.globalPct != null ? `${fmtPct(a.globalPct)} of players have it` : null,
    image: a.iconUrl || null,
    imageKind: 'icon',
  });

  const dated = achData.unlockedAch.filter((a) => a.unlockTime > 0);

  const achievements = dated.map(achEvent).sort(byTime);

  const rare = dated
    .filter((a) => a.globalPct != null && a.globalPct < RARE_MAX_PCT)
    .map(achEvent)
    .sort(byTime);

  // perfectGames only covers games carrying full per-achievement detail, so
  // this list can be shorter than the perfect-game count; rungs past its end
  // simply have no date.
  const perfect = achData.perfectGames
    .filter((g) => g.perfectedAt > 0)
    .map((g) => ({
      time: g.perfectedAt,
      label: g.name,
      sub: `${g.achievements.total.toLocaleString()} achievements, all of them`,
      note: null,
      image: g.headerUrl || null,
      imageKind: 'banner',
    }))
    .sort(byTime);

  const wishlisted = wishlist
    .filter((w) => w.dateAdded > 0)
    .map((w) => ({
      time: w.dateAdded,
      label: w.name || `App ${w.appId}`,
      sub: null,
      note: null,
      image: w.headerUrl || null,
      imageKind: 'banner',
    }))
    .sort(byTime);

  const reviews = reviewsData.reviews
    .map((r) => {
      const game = byAppId.get(r.appId);
      // Local noon rather than the UTC midnight a bare YYYY-MM-DD parses to,
      // so the date cannot slip back a day west of Greenwich.
      const time = Math.floor(new Date(`${r.date}T12:00:00`).getTime() / 1000);
      return {
        time,
        label: game?.name ?? r.title,
        sub: game ? `“${r.title}”` : null,
        note: r.rating != null ? `Rated ${r.rating}/10` : null,
        image: game?.headerUrl || null,
        imageKind: 'banner',
      };
    })
    .filter((e) => Number.isFinite(e.time) && e.time > 0)
    .sort(byTime);

  return { achievements, rare, perfect, wishlist: wishlisted, reviews };
}

/** Section-level context the popup shows on every rung of that ladder. */
function buildExtras(metrics, games) {
  const byAppId = new Map(games.map((g) => [g.appId, g.name]));
  const conquered = hallOfPainData.entries
    .filter((e) => e.status === 'conquered')
    .map((e) => byAppId.get(e.appId) ?? `App ${e.appId}`);

  return {
    single: {
      label: 'Deepest title',
      value: `${metrics.topGameName} · ${fmtHoursOneDecimal(metrics.maxSingleHours)} hrs`,
    },
    hallofpain:
      conquered.length > 0
        ? { label: 'Conquered', value: conquered.join(', ') }
        : null,
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
      { threshold: 10, title: 'Starter shelf' },
      { threshold: 50, title: 'Shelf weight' },
      { threshold: 100, title: 'Century club' },
      { threshold: 250, title: 'Wall of spines' },
      { threshold: 500, title: 'Private collection' },
      { threshold: 1000, title: 'Card catalogue' },
      { threshold: 2500, title: 'Backlog abyss' },
      { threshold: 5000, title: 'Archive wing' },
      { threshold: 7500, title: 'Sale-season casualty' },
      { threshold: 10000, title: 'National library' },
      { threshold: 15000, title: 'Lost in the stacks' },
      { threshold: 25000, title: 'Library of Babel' },
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
      { threshold: 500, title: 'Settled in' },
      { threshold: 1000, title: 'No longer casual' },
      { threshold: 2500, title: 'Time sink' },
      { threshold: 5000, title: 'Marathon, not a sprint' },
      { threshold: 10000, title: 'The 10,000-hour rule' },
      { threshold: 25000, title: 'Years, not hours' },
      { threshold: 35000, title: 'Four years, nonstop' },
      { threshold: 50000, title: 'Grizzled veteran' },
      { threshold: 75000, title: 'Hall of fame' },
      { threshold: 100000, title: 'Living legend' },
      { threshold: 150000, title: 'Mythic playtime' },
      { threshold: 250000, title: 'Beyond mortal hours' },
    ],
  },
  {
    sectionId: 'single',
    heading: 'Deepest single title',
    hint: 'Peak hours poured into any one synced game',
    getValue: (m) => m.maxSingleHours,
    milestones: [
      { threshold: 100, title: 'Found a favourite' },
      { threshold: 500, title: 'Second home' },
      { threshold: 1000, title: 'Dropped anchor' },
      { threshold: 2000, title: 'Part of the furniture' },
      { threshold: 3000, title: 'Muscle memory' },
      { threshold: 4000, title: 'Fixation' },
      { threshold: 5000, title: 'Knows every pixel' },
      { threshold: 6000, title: 'Married to the game' },
      { threshold: 7500, title: 'Lifer' },
      { threshold: 10000, title: 'Grandmaster' },
    ],
  },
  {
    sectionId: 'perfect',
    heading: 'Flawless runs',
    hint: 'Titles with 100% of tracked achievements',
    eventNoun: 'perfected title',
    getValue: (m) => m.perfectGames,
    milestones: [
      { threshold: 1, title: 'Proof of concept' },
      { threshold: 10, title: 'Clean sweep' },
      { threshold: 50, title: 'Nothing left behind' },
      { threshold: 100, title: 'Hundred-percenter' },
      { threshold: 250, title: 'Every last checkbox' },
      { threshold: 500, title: 'Zero loose ends' },
      { threshold: 750, title: 'Immaculate' },
      { threshold: 1000, title: 'Completionist' },
      { threshold: 1500, title: 'Perfectionist' },
      { threshold: 2500, title: 'Total completion' },
    ],
  },
  {
    sectionId: 'achievements',
    heading: 'Achievement haul',
    hint: 'Total achievement unlocks across tracked games',
    eventNoun: 'unlock',
    getValue: (m) => m.totalAchUnlocked,
    milestones: [
      { threshold: 100, title: 'Getting the ding' },
      { threshold: 500, title: 'Pop-up regular' },
      { threshold: 1000, title: 'Chime collector' },
      { threshold: 2500, title: 'Notification fatigue' },
      { threshold: 5000, title: 'Fanfare on loop' },
      { threshold: 10000, title: 'Trophy room' },
      { threshold: 25000, title: 'Achievement avalanche' },
      { threshold: 35000, title: 'Unlock machine' },
      { threshold: 50000, title: 'Wall of merit' },
      { threshold: 75000, title: 'Heavily decorated' },
      { threshold: 100000, title: 'Badge storm' },
      { threshold: 150000, title: 'Achievement singularity' },
      { threshold: 250000, title: 'Unlocked everything, probably' },
    ],
  },
  {
    sectionId: 'rare',
    heading: 'Rare unlocks',
    hint: `Achievements held by under ${RARE_MAX_PCT}% of players`,
    eventNoun: 'rare unlock',
    getValue: (m) => m.rareUnlocked,
    milestones: [
      { threshold: 1, title: 'Off the beaten path' },
      { threshold: 10, title: 'Rarefied air' },
      { threshold: 50, title: 'Among the few' },
      { threshold: 100, title: 'Hard-won' },
      { threshold: 250, title: 'Deep cuts' },
      { threshold: 500, title: 'Seldom seen' },
      { threshold: 1000, title: 'Cabinet of curiosities' },
      { threshold: 2500, title: 'Dragon’s hoard' },
      { threshold: 5000, title: 'Statistical outlier' },
      { threshold: 10000, title: 'Vanishingly rare' },
    ],
  },
  {
    sectionId: 'wishlist',
    heading: 'Wishlist horizon',
    hint: 'Games saved for later on Steam',
    eventNoun: 'wishlisted game',
    getValue: (m) => m.wishlistCount,
    milestones: [
      { threshold: 1, title: 'Eye on the prize' },
      { threshold: 25, title: 'Someday shelf' },
      { threshold: 100, title: 'Waiting for a sale' },
      { threshold: 500, title: 'Pile of maybes' },
      { threshold: 1000, title: 'Eternal optimist' },
      { threshold: 2500, title: 'Next sale, surely' },
      { threshold: 3500, title: 'Wishful thinking' },
      { threshold: 5000, title: 'Several lifetimes queued' },
      { threshold: 7500, title: 'Moving horizon' },
      { threshold: 10000, title: 'Infinite wishlist' },
    ],
  },
  {
    sectionId: 'reviews',
    heading: 'Reviews written',
    hint: 'Games you have written up on this site',
    eventNoun: 'review',
    getValue: (m) => m.reviewCount,
    milestones: [
      { threshold: 1, title: 'First verdict' },
      { threshold: 5, title: 'Finding the voice' },
      { threshold: 10, title: 'Opinions on file' },
      { threshold: 25, title: 'Columnist' },
      { threshold: 50, title: 'Critic’s desk' },
      { threshold: 100, title: 'Seasoned critic' },
      { threshold: 250, title: 'Editor-in-chief' },
    ],
  },
  {
    sectionId: 'hallofpain',
    heading: 'Hall of Pain',
    hint: 'Punishing completions marked conquered',
    getValue: (m) => m.conqueredCount,
    milestones: [
      { threshold: 1, title: 'First scalp' },
      { threshold: 5, title: 'Glutton for punishment' },
      { threshold: 10, title: 'Scar tissue' },
      { threshold: 25, title: 'Unbreakable' },
    ],
  },
];


function buildModel(games, wishlist) {
  const achData = buildAchievementData(games);
  const metrics = buildMetrics(games, wishlist, achData);
  const events = buildUnlockEvents(achData, wishlist, games);
  const extras = buildExtras(metrics, games);

  const sections = SECTION_DEFINITIONS.map((section) => {
    const { sectionId, heading } = section;
    const current = section.getValue(metrics);
    const sectionEvents = events[sectionId] ?? null;
    const n = section.milestones.length;
    const firstIncomplete = section.milestones.findIndex(
      (def) => current < def.threshold,
    );

    const milestones = section.milestones.map((def, idx) => {
      const complete = current >= def.threshold;
      const pct =
        def.threshold <= 0
          ? 100
          : Math.min(100, (current / def.threshold) * 100);

      // The Nth event, when the ladder has dated events reaching that far.
      const event =
        complete && sectionEvents && sectionEvents.length >= def.threshold
          ? sectionEvents[def.threshold - 1]
          : null;

      return {
        key: `${sectionId}-${def.threshold}`,
        title: def.title,
        threshold: def.threshold,
        complete,
        state: complete ? 'complete' : idx === firstIncomplete ? 'next' : 'future',
        pct,
        pctLabel: complete ? '100%' : `${Math.round(pct)}%`,
        thresholdBadge: thresholdBadge(sectionId, def.threshold),
        event,
        eventKicker:
          event && section.eventNoun
            ? `${ordinal(def.threshold)} ${section.eventNoun}`
            : null,
        dateLabel: event ? fmtDate(event.time) : null,
        toGo: complete
          ? null
          : `${withUnit(sectionId, def.threshold - current)} to go`,
      };
    });

    const ladderComplete = firstIncomplete === -1;
    const focusIndex = ladderComplete ? n - 1 : firstIncomplete;

    // One equal cell per rung rather than a to-scale bar: the thresholds run
    // from 1 to 25,000, so a linear bar would pile the early rungs into the
    // first few pixels. The current rung's cell fills by how far you are
    // between the previous threshold and this one.
    let nextFrac = 1;
    if (!ladderComplete) {
      const prev =
        firstIncomplete === 0
          ? 0
          : section.milestones[firstIncomplete - 1].threshold;
      const next = section.milestones[firstIncomplete].threshold;
      nextFrac = Math.max(0, Math.min(1, (current - prev) / (next - prev)));
    }

    return {
      sectionId,
      heading,
      hint: section.hint,
      currentLabel: withUnit(sectionId, current),
      dated: Boolean(sectionEvents && sectionEvents.length > 0),
      doneCount: milestones.filter((m) => m.complete).length,
      complete: ladderComplete,
      focusIndex,
      nextFrac,
      display: milestones[focusIndex],
      milestones,
      extra: extras[sectionId] ?? null,
    };
  });

  return { sections };
}

/**
 * One ladder: the next rung's name, then a bar carrying every rung as a
 * marker. The markers are a single tab stop with arrow keys moving between
 * them, so nine ladders of up to fourteen rungs do not become ~100 stops.
 */
function LadderRow({ section, index, onOpen }) {
  const [focusIdx, setFocusIdx] = useState(section.focusIndex);
  const rungRefs = useRef([]);
  const n = section.milestones.length;
  const d = section.display;

  const moveTo = (i) => {
    rungRefs.current[Math.max(0, Math.min(n - 1, i))]?.focus();
  };

  const handleKeyDown = (e, i) => {
    switch (e.key) {
      case 'ArrowRight':
        moveTo(i + 1);
        break;
      case 'ArrowLeft':
        moveTo(i - 1);
        break;
      case 'Home':
        moveTo(0);
        break;
      case 'End':
        moveTo(n - 1);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <motion.li
      className={styles.flight}
      data-section={section.sectionId}
      data-complete={section.complete || undefined}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 + index * 0.03 }}
    >
      <SectionGlyph
        id={section.sectionId}
        className={styles.flightGlyph}
        aria-hidden="true"
      />
      <div className={styles.flightMain}>
        <div className={styles.flightTop}>
          <button
            type="button"
            className={styles.flightTitle}
            aria-haspopup="dialog"
            onClick={() => onOpen(section.sectionId, section.focusIndex)}
          >
            {section.heading}
          </button>
          <span className={styles.flightBadge}>{d.thresholdBadge}</span>
        </div>

        <div className={styles.flightMeter}>
          <div
            className={styles.ladder}
            role="group"
            aria-label={`${section.heading} milestones`}
          >
            {section.milestones.map((m, i) => (
              <button
                key={m.key}
                ref={(el) => {
                  rungRefs.current[i] = el;
                }}
                type="button"
                className={styles.cell}
                aria-haspopup="dialog"
                data-state={m.state}
                data-rung={m.key}
                style={
                  m.state === 'next'
                    ? { '--frac': `${section.nextFrac * 100}%` }
                    : undefined
                }
                tabIndex={i === focusIdx ? 0 : -1}
                // Rung names only appear in the popup; the tooltip gives the
                // threshold and state. The name stays in aria-label below.
                title={`${m.thresholdBadge} · ${STATE_WORD[m.state]}`}
                aria-label={`${m.thresholdBadge}: ${m.title}, ${STATE_WORD[m.state]}`}
                onFocus={() => setFocusIdx(i)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                onClick={() => onOpen(section.sectionId, i)}
              />
            ))}
          </div>
          <span className={styles.pctLabel}>
            {section.doneCount}/{n}
          </span>
        </div>

        <div className={styles.flightFoot}>
          <span className={styles.flightCurrent}>{section.currentLabel}</span>
          {/* No percentage here: d.pctLabel is progress from zero (27,793 of
              35,000 hrs = 79%), while the current cell fills from the previous
              rung (25,000 → 35,000, 28%). Side by side they read as a
              contradiction. The popup shows both numbers in context. */}
          <span className={styles.flightToGo}>
            {section.complete ? 'Ladder complete' : d.toGo}
          </span>
        </div>
      </div>
    </motion.li>
  );
}

export default function SteamMilestones({ games, wishlist }) {
  // The defaults live inside the callback: `games || []` in the component body
  // would be a new array every render and this memo sorts ~21k achievements.
  const model = useMemo(() => {
    const list = games || [];
    return list.length === 0 ? null : buildModel(list, wishlist || []);
  }, [games, wishlist]);

  const [selected, setSelected] = useState(null);

  const openRung = useCallback((sectionId, index) => {
    setSelected({ sectionId, index });
  }, []);

  const selectedSection = selected
    ? model?.sections.find((s) => s.sectionId === selected.sectionId)
    : null;

  const selectRung = useCallback((index) => {
    setSelected((cur) => (cur ? { ...cur, index } : cur));
  }, []);

  // Hand focus back to the marker for whichever rung the popup ended on, so a
  // keyboard user lands where they were rather than at the top of the page.
  const closeModal = useCallback(() => {
    const key = selectedSection?.milestones[selected?.index]?.key;
    setSelected(null);
    if (key) document.querySelector(`[data-rung="${key}"]`)?.focus();
  }, [selectedSection, selected]);

  if (!model) {
    return (
      <p className={styles.empty}>
        No library data loaded yet — run{' '}
        <code className={styles.code}>node scripts/fetch-steam-data.js</code>{' '}
        to assemble milestones from your Steam profile.
      </p>
    );
  }

  const { sections } = model;

  return (
    <div className={styles.wrapper}>
      <section className={styles.block} aria-labelledby="ms-ladders">
        <div className={styles.blockHead}>
          <h2 id="ms-ladders" className={styles.blockTitle}>
            Ladders
          </h2>
          <p className={styles.blockHint}>
            Every rung on every ladder — select one for the full story
          </p>
        </div>
        <ul className={styles.flightList}>
          {sections.map((section, i) => (
            <LadderRow
              key={section.sectionId}
              section={section}
              index={i}
              onOpen={openRung}
            />
          ))}
        </ul>
      </section>

      <AnimatePresence>
        {selectedSection && (
          <MilestoneModal
            key="milestone-modal"
            section={selectedSection}
            index={selected.index}
            onSelect={selectRung}
            onClose={closeModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
