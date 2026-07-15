import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import qaPortfolioData from '../data/qaPortfolio.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import PlaytestCover from '../components/PlaytestCover/PlaytestCover';
import { parseSteamAppId } from '../utils/steamArt';
import styles from './QAPortfolio.module.css';

const { education, experience, gamesWorkedOn, playtests } = qaPortfolioData;

function playtestHref(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function isPrivateGameround(pt) {
  return pt.source === 'gameround' && pt.visibility === 'private';
}

function getPlaytestDisplay(pt) {
  if (isPrivateGameround(pt)) {
    return {
      title: 'Undisclosed Title',
      studio: 'Gameround (NDA)',
      year: pt.year,
      url: '',
      appId: null,
      coverUrl: '',
    };
  }
  return {
    title: pt.title,
    studio: pt.studio,
    year: pt.year,
    url: pt.url,
    appId: pt.appId || parseSteamAppId(pt.url),
    coverUrl: pt.coverUrl,
  };
}

const PLAYTEST_SUBSECTIONS = [
  { source: 'official', title: 'OFFICIAL PLAYTESTS', showType: true },
  { source: 'gameround', title: 'GAMEROUND PLAYTESTS', showType: false },
];

const GRID_BREAKPOINT = 768;

function getGridColumnCount(width) {
  const minCol = width <= GRID_BREAKPOINT ? 120 : 150;
  const gap = width <= GRID_BREAKPOINT ? 8 : 12;
  return Math.max(1, Math.floor((width + gap) / (minCol + gap)));
}

function useGridColumnCount(containerRef) {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const update = () => {
      setColumns(getGridColumnCount(el.offsetWidth));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return columns;
}

function ExpandableGameGrid({ items, renderItem }) {
  const containerRef = useRef(null);
  const columns = useGridColumnCount(containerRef);
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > columns;
  const visibleItems = expanded ? items : items.slice(0, columns);

  return (
    <div ref={containerRef} className={styles.expandableGridWrap}>
      <div className={styles.playtestGrid}>
        {visibleItems.map(renderItem)}
      </div>
      {hasMore && (
        <button
          type="button"
          className={styles.gridExpandBtn}
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function GameCoverCard({
  title,
  meta,
  storeUrl,
  appId,
  coverUrl,
  overlay,
  index,
}) {
  const cover = (
    <PlaytestCover
      title={title}
      appId={appId}
      coverUrl={coverUrl}
      imageClassName={styles.playtestCoverImage}
    />
  );

  return (
    <article className={styles.playtestCard}>
      <div className={styles.playtestCoverFrame}>
        {storeUrl ? (
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.playtestCoverLink}
            aria-label={`${title} store page`}
          >
            {cover}
          </a>
        ) : (
          cover
        )}
        {overlay}
      </div>
      <div className={styles.playtestInfo}>
        <div className={styles.playtestInfoHeader}>
          <h4 className={styles.playtestTitle}>
            {storeUrl ? (
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.playtestTitleLink}
              >
                {title}
              </a>
            ) : (
              title
            )}
          </h4>
          {index != null && <EditableItemControls index={index} />}
        </div>
        <p className={styles.playtestMeta}>{meta}</p>
      </div>
    </article>
  );
}

function WorkedOnGrid({ items }) {
  return (
    <ExpandableGameGrid
      items={items}
      renderItem={(game, index) => {
        const storeUrl = playtestHref(game.url);
        const appId = game.appId || parseSteamAppId(game.url);
        const meta = [game.company, game.period].filter(Boolean).join(' · ');

        return (
          <GameCoverCard
            key={index}
            title={game.title}
            meta={meta}
            storeUrl={storeUrl}
            appId={appId}
            coverUrl={game.coverUrl}
            index={index}
            overlay={
              game.role ? (
                <span className={styles.playtestTypeOverlay}>{game.role}</span>
              ) : null
            }
          />
        );
      }}
    />
  );
}

function PlaytestGrid({ items, showType }) {
  return (
    <ExpandableGameGrid
      items={items}
      renderItem={({ pt, index }) => {
        const display = getPlaytestDisplay(pt);
        const storeUrl = playtestHref(display.url);

        return (
          <GameCoverCard
            key={index}
            title={display.title}
            meta={`${display.studio} · ${display.year}`}
            storeUrl={storeUrl}
            appId={display.appId}
            coverUrl={display.coverUrl}
            index={index}
            overlay={
              <>
                {showType && (
                  <span className={styles.playtestTypeOverlay}>{pt.type}</span>
                )}
                {!showType && isPrivateGameround(pt) && (
                  <span className={styles.playtestPrivateOverlay}>Private</span>
                )}
              </>
            }
          />
        );
      }}
    />
  );
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function QAPortfolio() {
  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* --- Games worked on --- */}
      {gamesWorkedOn.length > 0 && (
        <motion.section variants={fadeUp} className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>&gt;</span> GAMES WORKED ON
          </h2>
          <EditableSection collection="qaPortfolio" dataKey="gamesWorkedOn">
            <WorkedOnGrid items={gamesWorkedOn} />
          </EditableSection>
        </motion.section>
      )}

      {/* --- Playtests --- */}
      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> PLAYTEST PARTICIPATIONS
        </h2>
        <EditableSection collection="qaPortfolio" dataKey="playtests">
          {PLAYTEST_SUBSECTIONS.map(({ source, title, showType }) => {
            const items = playtests
              .map((pt, index) => ({ pt, index }))
              .filter(({ pt }) => pt.source === source);
            if (items.length === 0) return null;
            return (
              <div key={source} className={styles.playtestSubsection}>
                <h3 className={styles.playtestSubsectionTitle}>{title}</h3>
                <PlaytestGrid items={items} showType={showType} />
              </div>
            );
          })}
        </EditableSection>
      </motion.section>

      {/* --- Experience --- */}
      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> PROFESSIONAL EXPERIENCE
        </h2>
        <EditableSection collection="qaPortfolio" dataKey="experience">
          <div className={styles.timeline}>
            {experience.map((job, i) => (
              <div key={i} className={styles.timelineItem}>
                <div className={styles.timelineDot} />
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      {job.title}
                      <EditableItemControls index={i} />
                    </h3>
                    <span className={styles.cardPeriod}>{job.period}</span>
                  </div>
                  <p className={styles.cardCompany}>{job.company}</p>
                  <p className={styles.cardDesc}>{job.description}</p>
                  {job.highlights && (
                    <ul className={styles.highlights}>
                      {job.highlights.map((h, j) => (
                        <li key={j}>{h}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </EditableSection>
      </motion.section>

      {/* --- Education --- */}
      <motion.section variants={fadeUp} className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> EDUCATION
        </h2>
        <EditableSection collection="qaPortfolio" dataKey="education">
          <div>
            {education.map((edu, i) => (
              <div key={i} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>
                    {edu.degree}
                    <EditableItemControls index={i} />
                  </h3>
                  <span className={styles.cardPeriod}>{edu.period}</span>
                </div>
                <p className={styles.cardCompany}>{edu.institution}</p>
                <p className={styles.cardDesc}>{edu.description}</p>
              </div>
            ))}
          </div>
        </EditableSection>
      </motion.section>
    </motion.div>
  );
}
