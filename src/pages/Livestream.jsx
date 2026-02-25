import { motion } from 'framer-motion';
import styles from './Livestream.module.css';

const TWITCH_CHANNEL = 'your_twitch_username';
const PARENT_DOMAIN = window.location.hostname;

const SCHEDULE = [
  { day: 'Monday', time: '20:00 — 23:00', game: 'Variety' },
  { day: 'Wednesday', time: '20:00 — 23:00', game: 'QA Streams' },
  { day: 'Friday', time: '21:00 — 00:00', game: 'Community Night' },
  { day: 'Saturday', time: '15:00 — 18:00', game: 'Retro Games' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export default function Livestream() {
  return (
    <motion.div
      className={styles.container}
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Twitch Player */}
      <motion.div variants={fadeUp} className={styles.playerSection}>
        <div className={styles.playerWrapper}>
          <iframe
            className={styles.player}
            src={`https://player.twitch.tv/?channel=${TWITCH_CHANNEL}&parent=${PARENT_DOMAIN}&muted=true`}
            allowFullScreen
            title="Twitch Stream"
          />
        </div>
        <div className={styles.chatWrapper}>
          <iframe
            className={styles.chat}
            src={`https://www.twitch.tv/embed/${TWITCH_CHANNEL}/chat?parent=${PARENT_DOMAIN}&darkpopout`}
            title="Twitch Chat"
          />
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className={styles.channelInfo}>
        <p className={styles.channelNote}>
          Replace <code>your_twitch_username</code> in the source code with your
          actual Twitch channel name.
        </p>
      </motion.div>

      {/* Schedule */}
      <motion.section variants={fadeUp} className={styles.scheduleSection}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>&gt;</span> STREAM SCHEDULE
        </h2>
        <div className={styles.scheduleGrid}>
          {SCHEDULE.map((slot) => (
            <div key={slot.day} className={styles.scheduleCard}>
              <h4 className={styles.scheduleDay}>{slot.day.toUpperCase()}</h4>
              <p className={styles.scheduleTime}>{slot.time}</p>
              <p className={styles.scheduleGame}>{slot.game}</p>
            </div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}
