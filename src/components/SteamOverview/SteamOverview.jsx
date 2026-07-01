import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import SteamStats from '../SteamStats/SteamStats';
import AchievementCard from '../SteamAchievements/AchievementCard';
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

export default function SteamOverview({ games, profile, wishlist }) {
  const [selectedDay, setSelectedDay] = useState(null);

  const wishlistItems = wishlist || [];

  const { gamesWithItems, unlockedAch, perfectGames } = useMemo(
    () => buildAchievementData(games),
    [games],
  );

  const rarity = useMemo(() => {
    const buckets = RARITY_BUCKETS.map((b) => ({ label: b.label, count: 0 }));
    for (const a of unlockedAch) {
      if (a.globalPct == null) continue;
      const idx = RARITY_BUCKETS.findIndex((b) => a.globalPct < b.max);
      if (idx >= 0) buckets[idx].count += 1;
    }
    const maxBucket = Math.max(1, ...buckets.map((b) => b.count));
    return { buckets, maxBucket };
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

  // Last 365 days of unlock activity as one weekday-aligned grid per month.
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
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - 364);

    const months = [];
    let maxCount = 0;
    let yearTotal = 0;
    let prevYear = null;

    const monthCursor = new Date(
      windowStart.getFullYear(),
      windowStart.getMonth(),
      1,
    );
    const monthEnd = new Date(today.getFullYear(), today.getMonth(), 1);

    while (monthCursor <= monthEnd) {
      const y = monthCursor.getFullYear();
      const m = monthCursor.getMonth();
      const firstOfMonth = new Date(y, m, 1);
      const lastOfMonth = new Date(y, m + 1, 0);
      const start = firstOfMonth < windowStart ? new Date(windowStart) : firstOfMonth;
      const end = lastOfMonth > today ? new Date(today) : lastOfMonth;

      const cells = [];
      for (let i = 0; i < start.getDay(); i += 1) cells.push(null);

      const d = new Date(start);
      while (d <= end) {
        const key = dayKey(d);
        const count = dayCounts.get(key) || 0;
        if (count > maxCount) maxCount = count;
        yearTotal += count;
        cells.push({
          key,
          count,
          label: d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
        });
        d.setDate(d.getDate() + 1);
      }
      while (cells.length % 7 !== 0) cells.push(null);

      const weeks = [];
      for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7));
      }

      const showYear = prevYear !== y;
      prevYear = y;
      months.push({
        key: `${y}-${String(m + 1).padStart(2, '0')}`,
        label: showYear ? `${MONTH_NAMES[m]} '${String(y).slice(2)}` : MONTH_NAMES[m],
        weeks,
      });

      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }

    return { months, maxCount, yearTotal };
  }, [unlockedAch]);

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
    const count = wishlistItems.length;
    const cutoff = Date.now() / 1000 - 30 * 24 * 60 * 60;
    const recent = wishlistItems.filter((w) => (w.dateAdded || 0) >= cutoff).length;
    return { count, recent };
  }, [wishlistItems]);

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

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>COLLECTION</h2>
          <p className={styles.blockHint}>
            Reviews, wishlist and tier-list activity at a glance
          </p>
        </div>
        <div className={styles.snapshotGrid}>
          <div className={styles.snapshotCard}>
            <span className={styles.snapshotLabel}>REVIEWS</span>
            <span className={styles.snapshotValue}>{reviewStats.count}</span>
            <span className={styles.snapshotMeta}>
              avg {reviewStats.avg.toFixed(1)}/10 · {reviewStats.recommendedPct}%
              recommended
            </span>
          </div>
          <div className={styles.snapshotCard}>
            <span className={styles.snapshotLabel}>WISHLIST</span>
            <span className={styles.snapshotValue}>
              {wishlistStats.count.toLocaleString()}
            </span>
            <span className={styles.snapshotMeta}>
              {wishlistStats.recent} added in last 30 days
            </span>
          </div>
          <div className={styles.snapshotCard}>
            <span className={styles.snapshotLabel}>TIER LIST</span>
            <span className={styles.snapshotValue}>{tierStats.ranked}</span>
            <span className={styles.snapshotMeta}>
              ranked across {tierStats.categories} categor
              {tierStats.categories === 1 ? 'y' : 'ies'}
            </span>
          </div>
        </div>
      </section>

      {gamesWithItems.length > 0 && (
        <>
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <h2 className={styles.blockTitle}>RARITY DISTRIBUTION</h2>
              <p className={styles.blockHint}>
                Unlocked achievements grouped by global rarity
              </p>
            </div>
            <div className={styles.barList}>
              {rarity.buckets.map((b) => (
                <div key={b.label} className={styles.barRow}>
                  <span className={styles.barLabel}>{b.label}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${(b.count / rarity.maxBucket) * 100}%` }}
                    />
                  </div>
                  <span className={styles.barValue}>{b.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.block}>
            <div className={styles.blockHead}>
              <h2 className={styles.blockTitle}>UNLOCK ACTIVITY</h2>
              <p className={styles.blockHint}>
                {unlockedAch.length > 0
                  ? `${yearTotal.toLocaleString()} achievements unlocked in the last year · click a day for details`
                  : 'Achievements earned per day over the last year'}
              </p>
            </div>
            <div className={styles.calendarScroll}>
              <div className={styles.calMonths}>
                {calendar.months.map((month) => (
                  <div key={month.key} className={styles.calMonthBlock}>
                    <span className={styles.calMonthLabel}>{month.label}</span>
                    <div className={styles.calGrid}>
                      {month.weeks.map((week, wi) => (
                        <div key={wi} className={styles.calWeek}>
                          {week.map((day, di) => {
                            if (!day) {
                              return (
                                <div
                                  key={`empty-${wi}-${di}`}
                                  className={styles.calDayEmpty}
                                />
                              );
                            }
                            const perfected = dayDetails.perfected.has(day.key);
                            const cellTitle = `${day.count} unlocked · ${day.label}${perfected ? ' · perfected a game' : ''}`;
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
                                <span className={styles.calDayNum}>
                                  {day.count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedDay && (
              <motion.div
                key={selectedDay.key}
                className={styles.dayPanel}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className={styles.dayPanelHead}>
                  <div>
                    <p className={styles.dayPanelDate}>{selectedDay.label}</p>
                    <p className={styles.dayPanelSub}>
                      {selectedDay.count} achievement
                      {selectedDay.count === 1 ? '' : 's'} unlocked
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.dayPanelClose}
                    onClick={() => setSelectedDay(null)}
                    aria-label="Close"
                  >
                    &#10005;
                  </button>
                </div>
                {dayDetails.perfected.get(selectedDay.key) && (
                  <p className={styles.dayPerfect}>
                    <span className={styles.dayPerfectStar}>&#9733;</span>
                    Perfected: {dayDetails.perfected.get(selectedDay.key).join(', ')}
                  </p>
                )}
                <div className={styles.achGrid}>
                  {(dayDetails.items.get(selectedDay.key) || []).map((a) => (
                    <AchievementCard key={`${a.appId}-${a.apiName}`} ach={a} />
                  ))}
                </div>
              </motion.div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
