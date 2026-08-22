import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import runescapeData from '../data/runescape.json';
import {
  useContainerLayout,
  formatNumber,
  formatScore as formatXp,
  fadeUp,
  stagger,
  StatSection,
  gameStyles,
} from '../components/GameStats';
// Not re-exported from the barrel, and worth sharing rather than restating as a literal.
import { COMPACT_ROW_WIDTH } from '../components/GameStats/useContainerLayout';
import { useAdminStore } from '../stores/adminStore';
import EditableSection from '../admin/EditableSection';
import styles from './RuneScape.module.css';

// 29 tiles is a lot to stagger; 0.05 each would take a second and a half.
const tileStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.015 } },
};

/**
 * Skill ids in the order the in-game interface lays them out: three columns grouped
 * combat / support / gathering-artisan, read row by row. The DOM has to be row-major so the
 * grid still makes sense when it collapses to two columns, and so screen readers follow the
 * same order a sighted reader does.
 */
const SKILL_DISPLAY_ORDER = [
  0, 3, 14, //  Attack        Constitution   Mining
  2, 16, 13, //  Strength      Agility        Smithing
  1, 15, 10, //  Defence       Herblore       Fishing
  4, 17, 7, //   Ranged        Thieving       Cooking
  5, 12, 11, //  Prayer        Crafting       Firemaking
  6, 9, 8, //    Magic         Fletching      Woodcutting
  20, 18, 19, // Runecrafting  Slayer         Farming
  22, 21, 23, // Construction  Hunter         Summoning
  24, 25, 26, // Dungeoneering Divination     Invention
  27, 28, //     Archaeology   Necromancy     [total level tile]
];

/** Below this the character render sits above the stats instead of beside them. */
const SPLIT_MIN_WIDTH = 620;
/** Below this the skill grid drops to two columns. Two is the floor — one is unreadable. */
const TWO_COLUMN_WIDTH = 440;
/** The grid is capped at 420px, so the quest panel fits beside it once there is room for both. */
const SIDE_BY_SIDE_WIDTH = 760;

/** The skill grid breaks at its own widths, so this page measures itself rather than the stat-list
    breakpoints the shooter pages share. */
const measureLayout = (width) => ({
  isSplit: width >= SPLIT_MIN_WIDTH,
  isSideBySide: width >= SIDE_BY_SIDE_WIDTH,
  columns: width >= TWO_COLUMN_WIDTH ? 3 : 2,
  // The quest log uses the shared stat rows, so it needs the shared row breakpoint too.
  isCompact: width < COMPACT_ROW_WIDTH,
});

function skillTooltip(skill) {
  const parts = [`${skill.name} — level ${skill.level}`, `${formatNumber(skill.xp)} XP`];
  if (skill.xpToNext !== null && skill.xpToNext > 0) {
    parts.push(`${formatNumber(skill.xpToNext)} XP to level ${skill.virtualLevel + 1}`);
  }
  return parts.join(' · ');
}

function SkillTile({ skill }) {
  // Virtual level is what the XP would be worth past the skill's cap. Showing it over the real
  // level reproduces the in-game "boosted" tile without inventing data.
  const isOverCap = skill.virtualLevel > skill.level;

  return (
    <motion.div
      variants={fadeUp}
      className={`${styles.tile}${isOverCap ? ` ${styles.tileOverCap}` : ''}${
        skill.isMaxed ? ` ${styles.tileMaxed}` : ''
      }`}
      title={skillTooltip(skill)}
    >
      <img
        src={skill.iconUrl}
        alt=""
        className={styles.tileIcon}
        width={20}
        height={20}
        loading="lazy"
      />
      <div className={styles.tileLevels}>
        <span className={styles.levelTop}>{skill.virtualLevel}</span>
        <span className={styles.levelBase}>{skill.level}</span>
      </div>
      <span className={styles.srOnly}>{`${skill.name} level ${skill.level}`}</span>
      {skill.progressPct !== null && (
        <span
          className={styles.tileProgress}
          style={{ '--pct': `${skill.progressPct}%` }}
          aria-hidden="true"
        />
      )}
    </motion.div>
  );
}

function TotalLevelTile({ profile }) {
  return (
    <motion.div
      variants={fadeUp}
      className={`${styles.tile} ${styles.tileTotal}`}
      title={`${formatNumber(profile.totalXp)} total XP`}
    >
      <span className={styles.tileTotalLabel}>TOTAL</span>
      <div className={styles.tileLevels}>
        <span className={styles.levelTop}>{formatNumber(profile.totalLevel)}</span>
        <span className={styles.levelBase}>{formatXp(profile.totalXp)}</span>
      </div>
    </motion.div>
  );
}

function SkillGrid({ skills, profile, columns }) {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));

  return (
    <motion.div
      className={styles.skillGrid}
      data-columns={columns}
      variants={tileStagger}
      initial="hidden"
      animate="show"
    >
      {SKILL_DISPLAY_ORDER.map((id) => {
        const skill = byId.get(id);
        return skill ? <SkillTile key={id} skill={skill} /> : null;
      })}
      <TotalLevelTile profile={profile} />
    </motion.div>
  );
}

function CharacterPortrait({ character }) {
  const source = (character.imageUrl || '').trim() || character.avatarUrl || '';
  const [failed, setFailed] = useState(false);

  if (!source || failed) {
    return (
      <div className={styles.portraitPlaceholder}>
        <span className={styles.portraitGlyph}>?</span>
        <span className={styles.portraitHint}>No character render cached</span>
      </div>
    );
  }

  return (
    <img
      src={source}
      alt={`${character.displayName} in RuneScape`}
      className={styles.portrait}
      onError={() => setFailed(true)}
    />
  );
}

function CharacterPanel({ character, profile, fetchedAt, isSplit }) {
  const synced = fetchedAt ? new Date(fetchedAt).toISOString().slice(0, 10) : '';

  return (
    <div className={`${styles.characterPanel}${isSplit ? ` ${styles.characterSplit}` : ''}`}>
      <CharacterPortrait character={character} />

      <div className={styles.characterBody}>
        <h2 className={styles.characterName}>{character.displayName || profile.name}</h2>
        {character.tagline && <p className={styles.characterTagline}>{character.tagline}</p>}

        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{profile.combatLevel}</span>
            <span className={styles.statLabel}>COMBAT</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{formatNumber(profile.totalLevel)}</span>
            <span className={styles.statLabel}>TOTAL LEVEL</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{formatXp(profile.totalXp)}</span>
            <span className={styles.statLabel}>TOTAL XP</span>
          </div>
        </div>

        {character.note && <p className={styles.characterNote}>{character.note}</p>}
        {synced && <p className={styles.syncedAt}>SYNCED {synced}</p>}
      </div>
    </div>
  );
}

function QuestPanel({ quests }) {
  const pct = quests.pointsTotal > 0 ? Math.round((quests.points / quests.pointsTotal) * 100) : 0;

  return (
    <div className={styles.panel}>
      <div className={styles.questHeader}>
        <div className={styles.questPoints}>
          <span className={styles.questPointsValue}>{formatNumber(quests.points)}</span>
          <span className={styles.questPointsTotal}>/ {formatNumber(quests.pointsTotal)}</span>
        </div>
        <span className={styles.statLabel}>QUEST POINTS</span>
      </div>

      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>

      <div className={styles.questCounts}>
        <span>
          <strong>{quests.completed}</strong> complete
        </span>
        <span>
          <strong>{quests.started}</strong> in progress
        </span>
        <span>
          <strong>{quests.notStarted}</strong> not started
        </span>
      </div>

      <ul className={styles.difficultyList}>
        {quests.byDifficulty.map((bucket) => {
          const bucketPct = bucket.total > 0 ? (bucket.completed / bucket.total) * 100 : 0;
          return (
            <li key={bucket.label} className={styles.difficultyRow}>
              <span className={styles.difficultyLabel}>{bucket.label}</span>
              <span className={styles.difficultyTrack}>
                <span className={styles.difficultyFill} style={{ width: `${bucketPct}%` }} />
              </span>
              <span className={styles.difficultyCount}>
                {bucket.completed}/{bucket.total}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * A quest sits in exactly one bucket, which is what the shared filter chips expect. Splitting
 * "not started" by `eligible` is the useful cut: it separates what the account can actually start
 * today from what is still gated behind requirements.
 */
const QUEST_BUCKETS = ['COMPLETE', 'IN PROGRESS', 'AVAILABLE', 'LOCKED'];

function questBucket(quest) {
  if (quest.status === 'COMPLETED') return 'COMPLETE';
  if (quest.status === 'STARTED') return 'IN PROGRESS';
  return quest.eligible ? 'AVAILABLE' : 'LOCKED';
}


/** The detail that will not fit a fixed-width stat column, surfaced on hover instead. */
function questDetail(quest) {
  const parts = [quest.bucket.toLowerCase()];
  if (quest.series) {
    parts.push(quest.seriesIndex ? `${quest.series} #${quest.seriesIndex}` : quest.series);
  }
  if (quest.area) parts.push(quest.area);
  if (quest.combat) parts.push(`combat ${quest.combat}`);
  if (quest.members) parts.push('members');
  return `${quest.title} — ${parts.join(' · ')}`;
}

/**
 * Built from the shared row classes rather than <StatRow> because a quest has no progress to
 * draw: RuneMetrics reports only started / not started, so a bar could only ever show a made-up
 * figure. Everything else matches the sibling pages.
 */
function QuestRow({ quest, isCompact }) {
  return (
    <motion.li
      variants={fadeUp}
      className={`${gameStyles.equipRow} ${gameStyles.equipRowNoIcon}${
        isCompact ? ` ${gameStyles.equipRowCompact}` : ''
      }`}
      title={questDetail(quest)}
    >
      <div className={gameStyles.equipMain}>
        <div className={gameStyles.equipHeader}>
          <span className={gameStyles.equipName}>
            {/* Sits outside the link so it is not underlined on hover, and first so the name's
                ellipsis never eats it. */}
            <img
              className={styles.memberIcon}
              src={quest.members ? '/runescape/icons/members.png' : '/runescape/icons/free-to-play.png'}
              alt={quest.members ? 'Members' : 'Free to play'}
              title={quest.members ? 'Members' : 'Free to play'}
              width={16}
              height={16}
            />
            <a
              className={styles.questLink}
              data-status={quest.bucket}
              href={quest.wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {quest.title}
              {/* Colour carries the status for sighted readers; this carries it for everyone else. */}
              <span className={styles.srOnly}>{` — ${quest.bucket.toLowerCase()}`}</span>
            </a>
          </span>
          {/* Difficulty is a word, so it takes the flexible headline slot; the fixed 3.6rem stat
              columns below only ever hold short figures. */}
          <span className={gameStyles.equipValue}>{quest.difficultyLabel}</span>
        </div>
      </div>

      <dl className={gameStyles.equipStats} style={{ '--game-stat-columns': 1 }}>
        <div>
          <dt>QP</dt>
          <dd>{quest.questPoints > 0 ? quest.questPoints : '—'}</dd>
        </div>
      </dl>
    </motion.li>
  );
}

function QuestLog({ quests, isCompact }) {
  const items = useMemo(() => {
    const withBucket = (quests.items ?? []).map((quest) => ({
      ...quest,
      bucket: questBucket(quest),
    }));
    // Alphabetical, case- and accent-insensitive, so the list reads like the in-game quest journal
    // and a title is findable without knowing when it came out.
    return withBucket.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
  }, [quests.items]);

  const filters = useMemo(
    () =>
      QUEST_BUCKETS.map((name) => ({
        name,
        count: items.filter((quest) => quest.bucket === name).length,
      })).filter((option) => option.count > 0),
    [items],
  );

  if (items.length === 0) return null;

  return (
    <>
      <p className={gameStyles.sectionNote}>
        Every quest RuneMetrics reports, A&ndash;Z. <strong>Available</strong> are the ones whose
        requirements this account already meets. Titles link to the wiki.
      </p>
      <StatSection
        items={items}
        filters={filters}
        filterKey="bucket"
        allLabel="ALL"
        renderRow={(quest) => (
          <QuestRow key={quest.title} quest={quest} isCompact={isCompact} />
        )}
      />
    </>
  );
}

/** Entries revealed per click. RuneMetrics returns 20, so this opens in four steps. */
const LOG_PAGE_SIZE = 5;

function AdventurersLog({ activities }) {
  const [visibleCount, setVisibleCount] = useState(LOG_PAGE_SIZE);
  const expanderRef = useRef(null);

  if (activities.length === 0) return null;

  const shown = activities.slice(0, visibleCount);
  const remaining = activities.length - shown.length;
  const isFullyShown = remaining === 0 && activities.length > LOG_PAGE_SIZE;

  const showMore = () =>
    setVisibleCount((count) => Math.min(count + LOG_PAGE_SIZE, activities.length));

  const collapse = () => {
    setVisibleCount(LOG_PAGE_SIZE);
    // Collapsing drops rows from above the button, so the reader would otherwise be left staring
    // at whatever the page shifted up into their viewport.
    requestAnimationFrame(() => expanderRef.current?.scrollIntoView({ block: 'nearest' }));
  };

  return (
    <>
      <ul className={styles.logList}>
        {shown.map((entry, index) => (
          <li key={`${entry.date}-${index}`} className={styles.logEntry}>
            <span className={styles.logDate}>{entry.date}</span>
            <span className={styles.logText}>{entry.text}</span>
            {entry.details && entry.details !== entry.text && (
              <span className={styles.logDetails}>{entry.details}</span>
            )}
          </li>
        ))}
      </ul>

      {(remaining > 0 || isFullyShown) && (
        <button
          ref={expanderRef}
          type="button"
          className={gameStyles.expander}
          onClick={isFullyShown ? collapse : showMore}
        >
          {isFullyShown ? 'SHOW LESS' : `SHOW ${Math.min(LOG_PAGE_SIZE, remaining)} MORE`}
        </button>
      )}
    </>
  );
}

export default function RuneScape() {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const getData = useAdminStore((s) => s.getData);
  const isAdminUi = import.meta.env.DEV && isAuthenticated;

  const [adminCharacter, setAdminCharacter] = useState(null);
  const containerRef = useRef(null);
  const { isSplit, isSideBySide, columns, isCompact } = useContainerLayout(containerRef, measureLayout);

  // Only the character block is hand-editable; skills and quests are regenerated by the sync
  // script and would be overwritten on the next run.
  const character = (isAdminUi && adminCharacter) || runescapeData.character;
  const { profile, skills, quests, activities, fetchedAt } = runescapeData;

  const refreshAdminCharacter = useCallback(async () => {
    try {
      const data = await getData('runescape');
      setAdminCharacter(data.character || null);
    } catch (err) {
      console.error('Failed to load runescape character:', err);
    }
  }, [getData]);

  useEffect(() => {
    if (!isAdminUi) return;
    refreshAdminCharacter();
  }, [isAdminUi, refreshAdminCharacter]);

  useEffect(() => {
    if (!isAdminUi) return undefined;
    const onSaved = (e) => {
      if (e.detail?.collection !== 'runescape') return;
      refreshAdminCharacter();
    };
    window.addEventListener('admin-collection-saved', onSaved);
    return () => window.removeEventListener('admin-collection-saved', onSaved);
  }, [isAdminUi, refreshAdminCharacter]);

  return (
    <motion.div
      ref={containerRef}
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <motion.section variants={fadeUp}>
        <EditableSection collection="runescape" dataKey="character" singleton>
          <CharacterPanel
            character={character}
            profile={profile}
            fetchedAt={fetchedAt}
            isSplit={isSplit}
          />
        </EditableSection>
      </motion.section>

      <motion.section
        variants={fadeUp}
        className={`${styles.skillsQuestsRow}${isSideBySide ? ` ${styles.rowSplit}` : ''}`}
      >
        <div className={styles.skillsColumn}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>&gt;</span> SKILLS
          </h2>
          <SkillGrid skills={skills} profile={profile} columns={columns} />
          <p className={styles.gridNote}>
            Top number is the virtual level the XP is worth; bottom is the in-game level.
          </p>
        </div>

        <div className={styles.questsColumn}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>&gt;</span> QUESTS
          </h2>
          <QuestPanel quests={quests} />
        </div>
      </motion.section>

      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> QUEST LOG
        </h2>
        <QuestLog quests={quests} isCompact={isCompact} />
      </motion.section>

      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> ADVENTURER&apos;S LOG
        </h2>
        <AdventurersLog activities={activities} />
      </motion.section>

      <motion.p variants={fadeUp} className={styles.attribution}>
        RuneScape is a trademark of Jagex Ltd. Skill icons &copy; Jagex, used under fair use. Data
        via RuneMetrics. Quest details from the RuneScape Wiki (CC BY-NC-SA 3.0).
      </motion.p>
    </motion.div>
  );
}
