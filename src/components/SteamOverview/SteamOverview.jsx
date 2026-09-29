import { useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import SteamStats from '../SteamStats/SteamStats';
import SteamChanges from '../SteamChanges/SteamChanges';
import DayDetailModal from './DayDetailModal';
import {
  buildAchievementData,
  dayKey,
  RARITY_BUCKETS,
} from '../SteamAchievements/achievementShared';
import steamReviewsData from '../../data/steam-reviews.json';
import steamTierlistData from '../../data/steam-tierlist.json';
import styles from './SteamOverview.module.css';

const { reviews } = steamReviewsData;
const { tierLists } = steamTierlistData;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Weeks start on Sunday (see the calendar cursor below).
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function SteamOverview({ games, profile, wishlist }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [now] = useState(() => Date.now());
  const [year, setYear] = useState(() => new Date().getFullYear());

  const { gamesWithItems, unlockedAch, perfectGames } = useMemo(
    () => buildAchievementData(games),
    [games],
  );

  // `games` arrives unsorted from SteamLibrary (only the library tab gets the
  // sorted copy), so order the top five explicitly rather than trusting the JSON.
  const { topPlayed, maxHours } = useMemo(() => {
    const sorted = [...games]
      .sort((a, b) => (b.playtimeHours || 0) - (a.playtimeHours || 0))
      .slice(0, 5);
    return { topPlayed: sorted, maxHours: sorted[0]?.playtimeHours || 1 };
  }, [games]);

  const rarity = useMemo(() => {
    const buckets = RARITY_BUCKETS.map((b) => ({ label: b.label, count: 0 }));
    for (const a of unlockedAch) {
      if (a.globalPct == null) continue;
      const idx = RARITY_BUCKETS.findIndex((b) => a.globalPct < b.max);
      if (idx >= 0) buckets[idx].count += 1;
    }
    const maxBucket = Math.max(1, ...buckets.map((b) => b.count));
    // RARITY_BUCKETS runs rarest-first because `rarityLabel` relies on that
    // order; the panel reads better the other way round, so flip a copy rather
    // than reordering the shared constant.
    return { buckets: [...buckets].reverse(), maxBucket };
  }, [unlockedAch]);

  // Per-day unlock details + games perfected (hit 100%) on a given day.
  const dayDetails = useMemo(() => {
    const items = new Map();
    for (const a of unlockedAch) {
      if (!a.unlockTime) continue;
      const d = new Date(a.unlockTime * 1000);
      d.setHours(0, 0, 0, 0);
      const key = dayKey(d);
      if (!items.has(key)) items.set(key, []);
      items.get(key).push(a);
    }
    for (const arr of items.values()) {
      arr.sort((x, y) => (x.globalPct ?? 101) - (y.globalPct ?? 101));
    }

    const perfected = new Map();
    for (const g of perfectGames) {
      let lastUnlock = 0;
      for (const it of g.achievements.items) {
        if (it.unlocked && it.unlockTime > lastUnlock) lastUnlock = it.unlockTime;
      }
      if (!lastUnlock) continue;
      const d = new Date(lastUnlock * 1000);
      d.setHours(0, 0, 0, 0);
      const key = dayKey(d);
      if (!perfected.has(key)) perfected.set(key, []);
      perfected.get(key).push(g.name);
    }
    return { items, perfected };
  }, [unlockedAch, perfectGames]);

  // Every year with at least one unlock, newest first. The current year is
  // always offered so the default selection is never missing from the list.
  const years = useMemo(() => {
    const set = new Set([new Date().getFullYear()]);
    for (const a of unlockedAch) {
      if (a.unlockTime) set.add(new Date(a.unlockTime * 1000).getFullYear());
    }
    return [...set].sort((a, b) => b - a);
  }, [unlockedAch]);

  // One calendar year (Jan–Dec) of unlock activity as a weekday-aligned grid.
  const calendar = useMemo(() => {
    const dayCounts = new Map();
    for (const a of unlockedAch) {
      if (!a.unlockTime) continue;
      const d = new Date(a.unlockTime * 1000);
      d.setHours(0, 0, 0, 0);
      const key = dayKey(d);
      dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowStart = new Date(year, 0, 1);
    const windowEnd = new Date(year, 11, 31);

    // Start on the Sunday at or before the window so every column is a full week.
    const cursor = new Date(windowStart);
    cursor.setDate(cursor.getDate() - cursor.getDay());

    const weeks = [];
    let maxCount = 0;
    let yearTotal = 0;

    while (cursor <= windowEnd) {
      const cells = [];
      for (let i = 0; i < 7; i += 1) {
        if (cursor < windowStart || cursor > windowEnd) {
          cells.push(null);
        } else {
          const key = dayKey(cursor);
          const count = dayCounts.get(key) || 0;
          // Days still to come in the current year keep their slot so the
          // year reads as a whole, but render as blanks.
          const future = cursor > today;
          if (count > maxCount) maxCount = count;
          yearTotal += count;
          cells.push({
            key,
            count,
            future,
            month: cursor.getMonth(),
            year: cursor.getFullYear(),
            label: cursor.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }),
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(cells);
    }

    // One label per run of columns starting in the same month, so labels sit
    // above the weeks they describe rather than over separate blocks.
    const monthSpans = [];
    for (const week of weeks) {
      const first = week.find(Boolean);
      if (!first) continue;
      const open = monthSpans[monthSpans.length - 1];
      if (open && open.month === first.month && open.year === first.year) {
        open.span += 1;
        continue;
      }
      monthSpans.push({
        key: `${first.year}-${String(first.month + 1).padStart(2, '0')}`,
        label: MONTH_NAMES[first.month],
        month: first.month,
        year: first.year,
        span: 1,
      });
    }

    return { weeks, monthSpans, maxCount, yearTotal };
  }, [unlockedAch, year]);

  const heatLevel = (count) => {
    if (!count) return 0;
    if (!calendar.maxCount) return 1;
    const ratio = count / calendar.maxCount;
    if (ratio > 0.66) return 4;
    if (ratio > 0.33) return 3;
    if (ratio > 0.1) return 2;
    return 1;
  };

  // ---- Derived summaries for the other tabs ----
  const reviewStats = useMemo(() => {
    const count = reviews.length;
    if (count === 0) return { count: 0, avg: 0, recommendedPct: 0 };
    const sum = reviews.reduce((s, r) => s + (r.rating || 0), 0);
    const recommended = reviews.filter((r) => r.recommended).length;
    return {
      count,
      avg: sum / count,
      recommendedPct: Math.round((recommended / count) * 100),
    };
  }, []);

  const wishlistStats = useMemo(() => {
    const items = wishlist || [];
    const cutoff = now / 1000 - 30 * 24 * 60 * 60;
    const recent = items.filter((w) => (w.dateAdded || 0) >= cutoff).length;
    return { count: items.length, recent };
  }, [wishlist, now]);

  const tierStats = useMemo(() => {
    const categories = tierLists.length;
    const ranked = new Set();
    for (const tl of tierLists) {
      for (const [tier, ids] of Object.entries(tl.tiers || {})) {
        if (tier === 'unplayed') continue;
        for (const id of ids) ranked.add(id);
      }
    }
    return { categories, ranked: ranked.size };
  }, []);

  const yearTotal = calendar.yearTotal;

  return (
    <div className={styles.container}>
      <SteamStats games={games} profile={profile} />

      <div
        className={styles.chartRow}
        data-single={gamesWithItems.length === 0 ? 'true' : undefined}
      >
        <div className={styles.panel}>
          <p className={styles.panelLabel}>MOST PLAYED</p>
          <div className={styles.chartRows}>
            {topPlayed.map((game) => (
              <div key={game.appId} className={styles.playRow}>
                <div className={styles.playMain}>
                  <span className={styles.playName}>{game.name}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${(game.playtimeHours / maxHours) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <span className={styles.playValue}>
                  {game.playtimeHours.toLocaleString()}h
                </span>
              </div>
            ))}
          </div>
        </div>

        {gamesWithItems.length > 0 && (
          <div className={styles.panel}>
            <p className={styles.panelLabel}>ACHIEVEMENT RARITY</p>
            <div className={styles.chartRows}>
              {rarity.buckets.map((b) => (
                <div key={b.label} className={styles.rarityRow}>
                  <div className={styles.rarityMain}>
                    <span className={styles.rarityLabel}>{b.label}</span>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${(b.count / rarity.maxBucket) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className={styles.rarityValue}>
                    {b.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.collectionStrip}>
        <div className={styles.collectionCell}>
          <span className={styles.collectionLabel}>REVIEWS</span>
          <div className={styles.collectionFigures}>
            <span className={styles.collectionValue}>{reviewStats.count}</span>
            <span className={styles.collectionMeta}>
              avg {reviewStats.avg.toFixed(1)}/10 · {reviewStats.recommendedPct}%
              recommended
            </span>
          </div>
        </div>
        <div className={styles.collectionCell}>
          <span className={styles.collectionLabel}>WISHLIST</span>
          <div className={styles.collectionFigures}>
            <span className={styles.collectionValue}>
              {wishlistStats.count.toLocaleString()}
            </span>
            <span className={styles.collectionMeta}>
              {wishlistStats.recent} added in last 30 days
            </span>
          </div>
        </div>
        <div className={styles.collectionCell}>
          <span className={styles.collectionLabel}>TIER LIST</span>
          <div className={styles.collectionFigures}>
            <span className={styles.collectionValue}>{tierStats.ranked}</span>
            <span className={styles.collectionMeta}>
              ranked across {tierStats.categories} categor
              {tierStats.categories === 1 ? 'y' : 'ies'}
            </span>
          </div>
        </div>
      </div>

      <SteamChanges games={games} />

      {gamesWithItems.length > 0 && (
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <div className={styles.blockTitleRow}>
                <h2 className={styles.blockTitle}>UNLOCK ACTIVITY</h2>
                {years.length > 1 && (
                  <select
                    className={styles.yearSelect}
                    value={year}
                    aria-label="Year"
                    onChange={(e) => {
                      setYear(Number(e.target.value));
                      setSelectedDay(null);
                    }}
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className={styles.blockHint}>
                {unlockedAch.length > 0
                  ? `${yearTotal.toLocaleString()} achievements unlocked in ${year} · click a day for details`
                  : `Achievements earned per day in ${year}`}
              </p>
            </div>
            <div
              className={styles.calendarWrap}
              style={{ '--cal-weeks': calendar.weeks.length }}
            >
              <div className={styles.calendarInner}>
                <div className={styles.calWeekdayRow} aria-hidden="true">
                  {WEEKDAY_INITIALS.map((d, i) => (
                    <span key={i} className={styles.calWeekdayLabel}>
                      {d}
                    </span>
                  ))}
                </div>
                <div className={styles.calMonthRow}>
                  {calendar.monthSpans.map((month) => (
                    <span
                      key={month.key}
                      className={styles.calMonthLabel}
                      style={{ '--cal-span': month.span }}
                      data-short={month.span < 3 ? 'true' : undefined}
                    >
                      {month.label}
                    </span>
                  ))}
                </div>
                <div className={styles.calGrid}>
                  {calendar.weeks.flat().map((day, i) => {
                    if (!day) {
                      return (
                        <div key={`empty-${i}`} className={styles.calDayEmpty} />
                      );
                    }
                    const perfected = dayDetails.perfected.has(day.key);
                    const cellTitle = `${day.count} unlocked · ${day.label}${perfected ? ' · perfected a game' : ''}`;
                    if (day.future) {
                      return (
                        <div
                          key={day.key}
                          className={styles.calDay}
                          data-future="true"
                          title={day.label}
                        />
                      );
                    }
                    if (day.count === 0) {
                      return (
                        <div
                          key={day.key}
                          className={styles.calDay}
                          data-level={0}
                          title={cellTitle}
                        />
                      );
                    }
                    return (
                      <button
                        key={day.key}
                        type="button"
                        className={styles.calDay}
                        data-level={heatLevel(day.count)}
                        data-perfected={perfected ? 'true' : undefined}
                        data-selected={
                          selectedDay?.key === day.key ? 'true' : undefined
                        }
                        title={cellTitle}
                        onClick={() =>
                          setSelectedDay((cur) =>
                            cur?.key === day.key ? null : day,
                          )
                        }
                      >
                        <span className={styles.calDayNum}>{day.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {selectedDay && (
                <DayDetailModal
                  day={selectedDay}
                  items={dayDetails.items.get(selectedDay.key) || []}
                  perfected={dayDetails.perfected.get(selectedDay.key)}
                  onClose={() => setSelectedDay(null)}
                />
              )}
            </AnimatePresence>
          </section>
      )}
    </div>
  );
}
