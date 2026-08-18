import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import runescapeData from '../data/runescape.json';
import { useAdminStore } from '../stores/adminStore';
import EditableSection from '../admin/EditableSection';
import styles from './RuneScape.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

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

// The page renders inside two shells with very different content widths (the desktop split-view
// reserves 420px for the menu), so a window media query would be wrong in both directions.
function useContainerLayout(ref) {
  const [layout, setLayout] = useState({ isSplit: false, isSideBySide: false, columns: 3 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const update = () => {
      const width = el.offsetWidth;
      setLayout({
        isSplit: width >= SPLIT_MIN_WIDTH,
        isSideBySide: width >= SIDE_BY_SIDE_WIDTH,
        columns: width >= TWO_COLUMN_WIDTH ? 3 : 2,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return layout;
}

function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
}

function formatXp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

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

function AdventurersLog({ activities }) {
  if (activities.length === 0) return null;

  return (
    <ul className={styles.logList}>
      {activities.map((entry, index) => (
        <li key={`${entry.date}-${index}`} className={styles.logEntry}>
          <span className={styles.logDate}>{entry.date}</span>
          <span className={styles.logText}>{entry.text}</span>
          {entry.details && entry.details !== entry.text && (
            <span className={styles.logDetails}>{entry.details}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function RuneScape() {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const getData = useAdminStore((s) => s.getData);
  const isAdminUi = import.meta.env.DEV && isAuthenticated;

  const [adminCharacter, setAdminCharacter] = useState(null);
  const containerRef = useRef(null);
  const { isSplit, isSideBySide, columns } = useContainerLayout(containerRef);

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
          <span className={styles.sectionIcon}>&gt;</span> ADVENTURER&apos;S LOG
        </h2>
        <AdventurersLog activities={activities} />
      </motion.section>

      <motion.p variants={fadeUp} className={styles.attribution}>
        RuneScape is a trademark of Jagex Ltd. Skill icons &copy; Jagex, used under fair use. Data
        via RuneMetrics.
      </motion.p>
    </motion.div>
  );
}
