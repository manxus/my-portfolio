import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import livestreamData from '../data/livestream.json';
import EditableSection, { EditableItemControls } from '../admin/EditableSection';
import {
  parseYoutubeVideoId,
  youtubeEmbedUrl,
} from '../utils/youtube';
import { parseTwitchClipSlug, parseTwitchVideoId, twitchClipEmbedUrl, twitchVideoEmbedUrl } from '../utils/twitch';
import { useHighlightThumbnail } from '../hooks/useHighlightThumbnail';
import styles from './Livestream.module.css';

const TWITCH_CHANNEL = livestreamData.twitchChannel;
const TWITCH_URL = `https://www.twitch.tv/${TWITCH_CHANNEL}`;
const TIMEZONE = livestreamData.timezone;
const SCHEDULE_NOTE = livestreamData.scheduleNote;
const ABOUT = livestreamData.about;
const SCHEDULE = livestreamData.schedule;
const HIGHLIGHTS = livestreamData.highlights || [];
const STREAM_LOADOUT = livestreamData.streamLoadout || [];
const CHAT_RULES = livestreamData.chatRules || [];
const CHAT_COMMANDS = livestreamData.chatCommands || [];

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

function HighlightCard({ item, fullIndex, onOpen }) {
  const thumbSrc = useHighlightThumbnail(item);

  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.highlightCard}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className={styles.highlightImageWrap}>
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={item.title}
            className={styles.highlightImage}
            loading="lazy"
          />
        ) : (
          <div className={styles.highlightPlaceholder} aria-hidden />
        )}
      </div>
      <div className={styles.highlightInfo}>
        <div className={styles.highlightTitleRow}>
          <h4 className={styles.highlightTitle}>{item.title}</h4>
          {fullIndex >= 0 && <EditableItemControls index={fullIndex} />}
        </div>
        {item.description && (
          <p className={styles.highlightDesc}>{item.description}</p>
        )}
      </div>
    </div>
  );
}

function HighlightLightbox({ item, parentDomain, onClose }) {
  const thumbSrc = useHighlightThumbnail(item);

  let media = null;
  const yt = parseYoutubeVideoId(item.videoUrl);
  if (yt) {
    media = (
      <div className={styles.lightboxEmbed}>
        <iframe
          title={item.title}
          src={youtubeEmbedUrl(yt)}
          className={styles.lightboxIframe}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  } else {
    const clip = parseTwitchClipSlug(item.videoUrl);
    if (clip) {
      media = (
        <div className={styles.lightboxEmbed}>
          <iframe
            title={item.title}
            src={twitchClipEmbedUrl(clip, parentDomain)}
            className={styles.lightboxIframe}
            allowFullScreen
          />
        </div>
      );
    } else {
      const vod = parseTwitchVideoId(item.videoUrl);
      if (vod) {
        media = (
          <div className={styles.lightboxEmbed}>
            <iframe
              title={item.title}
              src={twitchVideoEmbedUrl(vod, parentDomain)}
              className={styles.lightboxIframe}
              allowFullScreen
            />
          </div>
        );
      } else {
        const imgSrc =
          (typeof item.fullUrl === 'string' && item.fullUrl.trim()) || thumbSrc;
        media = imgSrc ? (
          <img src={imgSrc} alt={item.title} className={styles.lightboxImage} />
        ) : (
          <div className={styles.lightboxEmpty}>
            Add a video URL (YouTube, Twitch clip, or Twitch video) to play a highlight here.
          </div>
        );
      }
    }
  }

  return (
    <motion.div
      className={styles.lightbox}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.lightboxContent}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
      >
        {media}
        <div className={styles.lightboxInfo}>
          <h3>{item.title}</h3>
          {item.description && <p>{item.description}</p>}
        </div>
        <button type="button" className={styles.lightboxClose} onClick={onClose}>
          &times;
        </button>
      </motion.div>
    </motion.div>
  );
}

function LoadoutLink({ url, children }) {
  const href = typeof url === 'string' ? url.trim() : '';
  if (!href) return children;
  if (href.startsWith('/')) {
    return <Link to={href} className={styles.loadoutLink}>{children}</Link>;
  }
  const external = /^https?:\/\//i.test(href) ? href : `https://${href}`;
  return (
    <a href={external} target="_blank" rel="noopener noreferrer" className={styles.loadoutLink}>
      {children}
    </a>
  );
}

export default function Livestream() {
  const parentDomain = window.location.hostname;
  const [lightbox, setLightbox] = useState(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  );
  const [showChat, setShowChat] = useState(
    () => typeof window === 'undefined' || !window.matchMedia('(max-width: 768px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => {
      setIsMobile(e.matches);
      if (e.matches) {
        setShowChat(false);
      } else {
        setShowChat(true);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const chatVisible = !isMobile || showChat;

  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* About */}
      <motion.section variants={fadeUp} className={styles.aboutSection}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> ABOUT THE STREAM
        </h2>
        <EditableSection collection="livestream" dataKey="about" singleton>
          <div className={styles.aboutBody}>
            {ABOUT?.intro && <p className={styles.aboutIntro}>{ABOUT.intro}</p>}
            {ABOUT?.qaStreamsNote && (
              <p className={styles.aboutQa}>
                {ABOUT.qaStreamsNote}{' '}
                <Link to="/qa-portfolio" className={styles.inlineLink}>
                  QA Portfolio
                </Link>
              </p>
            )}
          </div>
        </EditableSection>
      </motion.section>

      {/* Player + chat */}
      <motion.div variants={fadeUp} className={styles.playerBlock}>
        <div className={styles.playerActions}>
          <a
            href={TWITCH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.followBtn}
          >
            Follow on Twitch
          </a>
          {isMobile && (
            <button
              type="button"
              className={styles.chatToggle}
              onClick={() => setShowChat((v) => !v)}
              aria-expanded={showChat}
            >
              {showChat ? 'HIDE CHAT' : 'SHOW CHAT'}
            </button>
          )}
        </div>

        <div
          className={`${styles.playerSection} ${!chatVisible ? styles.playerSectionNoChat : ''}`}
        >
          <div className={styles.playerWrapper}>
            <iframe
              className={styles.player}
              src={`https://player.twitch.tv/?channel=${TWITCH_CHANNEL}&parent=${parentDomain}&muted=true`}
              allowFullScreen
              title="Twitch Stream"
            />
          </div>
          {chatVisible && (
            <div className={styles.chatWrapper}>
              <iframe
                className={styles.chat}
                src={`https://www.twitch.tv/embed/${TWITCH_CHANNEL}/chat?parent=${parentDomain}&darkpopout`}
                title="Twitch Chat"
              />
            </div>
          )}
        </div>
      </motion.div>

      {/* When I stream */}
      <motion.section variants={fadeUp} className={styles.scheduleSection}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> WHEN I STREAM
        </h2>
        <EditableSection collection="livestream" dataKey="scheduleNote" singleton>
          {SCHEDULE_NOTE && <p className={styles.scheduleNote}>{SCHEDULE_NOTE}</p>}
        </EditableSection>
        {TIMEZONE && (
          <EditableSection collection="livestream" dataKey="timezone" singleton>
            <p className={styles.timezoneNote}>{TIMEZONE}</p>
          </EditableSection>
        )}
        <EditableSection collection="livestream" dataKey="schedule">
          {SCHEDULE.length > 0 ? (
            <div className={styles.scheduleGrid}>
              {SCHEDULE.map((slot, i) => (
                <div key={slot.day} className={styles.scheduleCard}>
                  <h4 className={styles.scheduleDay}>
                    {slot.day.toUpperCase()}
                    <EditableItemControls index={i} />
                  </h4>
                  <p className={styles.scheduleTime}>{slot.time}</p>
                  <p className={styles.scheduleGame}>{slot.game}</p>
                </div>
              ))}
            </div>
          ) : null}
        </EditableSection>
      </motion.section>

      {/* Highlights */}
      <motion.section variants={fadeUp} className={styles.highlightsSection}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> STREAM HIGHLIGHTS
        </h2>
        <EditableSection collection="livestream" dataKey="highlights">
          {HIGHLIGHTS.length > 0 ? (
            <div className={styles.highlightsGrid}>
              {HIGHLIGHTS.map((item) => {
                const fullIndex = HIGHLIGHTS.findIndex((h) => h.id === item.id);
                return (
                  <HighlightCard
                    key={item.id}
                    item={item}
                    fullIndex={fullIndex}
                    onOpen={() => setLightbox(item)}
                  />
                );
              })}
            </div>
          ) : (
            <p className={styles.emptyNote}>No highlights yet.</p>
          )}
        </EditableSection>
      </motion.section>

      {/* Stream loadout */}
      {STREAM_LOADOUT.length > 0 && (
        <motion.section variants={fadeUp} className={styles.loadoutSection}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>&gt;</span> STREAM LOADOUT
          </h2>
          <EditableSection collection="livestream" dataKey="streamLoadout">
            <ul className={styles.loadoutList}>
              {STREAM_LOADOUT.map((item, i) => (
                <li key={`${item.label}-${i}`} className={styles.loadoutItem}>
                  <span className={styles.loadoutLabel}>
                    {item.label}
                    <EditableItemControls index={i} />
                  </span>
                  <span className={styles.loadoutValue}>
                    <LoadoutLink url={item.url}>{item.value}</LoadoutLink>
                  </span>
                </li>
              ))}
            </ul>
          </EditableSection>
        </motion.section>
      )}

      {/* Chat rules & commands */}
      <motion.section variants={fadeUp} className={styles.rulesSection}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> CHAT
        </h2>
        <div className={styles.rulesGrid}>
          <div className={styles.rulesBlock}>
            <h3 className={styles.rulesSubheading}>Rules</h3>
            <EditableSection collection="livestream" dataKey="chatRules">
              {CHAT_RULES.length > 0 ? (
                <ul className={styles.rulesList}>
                  {CHAT_RULES.map((rule, i) => (
                    <li key={i} className={styles.rulesListItem}>
                      {rule.text}
                      <EditableItemControls index={i} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyNote}>No chat rules yet.</p>
              )}
            </EditableSection>
          </div>
          <div className={styles.rulesBlock}>
            <h3 className={styles.rulesSubheading}>Commands</h3>
            <EditableSection collection="livestream" dataKey="chatCommands">
              {CHAT_COMMANDS.length > 0 ? (
                <dl className={styles.commandsList}>
                  {CHAT_COMMANDS.map((cmd, i) => (
                    <div key={cmd.command || i} className={styles.commandRow}>
                      <dt className={styles.commandName}>
                        {cmd.command}
                        <EditableItemControls index={i} />
                      </dt>
                      <dd className={styles.commandDesc}>{cmd.description}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className={styles.emptyNote}>No chat commands yet.</p>
              )}
            </EditableSection>
          </div>
        </div>
      </motion.section>

      {/* Highlights lightbox */}
      <AnimatePresence>
        {lightbox && (
          <HighlightLightbox
            item={lightbox}
            parentDomain={parentDomain}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
